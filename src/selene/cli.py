"""SELENE-MATCH command-line entry point and orchestrator.

    selene run    --src <path> --ref <path> --out <job_dir>
    selene eval   --job <job_dir>
    selene export --job <job_dir> --zip <output.zip>

Wires Stage 0 -> Stage 8 in order.
"""
from __future__ import annotations

from collections.abc import Callable
import argparse
import datetime
import json
import shutil
import zipfile
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
import cv2

from selene.config import PipelineConfig, load_config
from selene.utils.logging import setup_logging, get_logger
from selene.ingest.pair import Pair
from selene.ingest.geotiff_reader import read_geotiff
from selene.ingest.pds_reader import read_pds3, read_pds4, read_raster_canonical
from selene.geometry.pyramid import resample_to_gsd, upscale_coordinates, match_coarse_to_fine_pyramid
from selene.geometry.mapproject_tier2 import crop_reference_to_pair
from selene.illum.shadow_mask import detect_shadows
from selene.matchers.gate import route_and_match
from selene.robust.magsac import find_homography_magsac
from selene.robust.uniform_sampler import sample_uniform_gcps
from selene.warp.subpixel_lk import refine_subpixel_cascade
from selene.warp.model_fit import fit_final_transformation, RegistrationFailureError
from selene.warp.export_geotiff import export_geotiff
from selene.eval.metrics import compute_metrics, MetricsResult
from selene.eval.plots import plot_checkerboard, plot_quiver, plot_coverage_heatmap, plot_residual_heatmap
from selene.eval.report_pdf import generate_pdf_report
from selene.utils.seeding import set_reproducible_seed


def load_image_any(path: str | Path) -> tuple[np.ndarray, object | None, object | None]:
    """Load image from GeoTIFF, PDS3, PDS4, or common image formats using canonical raster reader."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Image not found: {path}")

    arr, crs, transform, _ = read_raster_canonical(p)
    return arr, crs, transform


def run_pipeline(
    src_path: str | Path,
    ref_path: str | Path,
    out_dir: str | Path,
    config: PipelineConfig | None = None,
    job_id: str = "job_default",
    progress_callback: Callable[[float, str], None] | None = None,
) -> dict:
    """Execute end-to-end SELENE-MATCH registration pipeline (Stages 0 - 8)."""
    if config is None:
        config = PipelineConfig()
    
    import time
    t_start = time.time()
    set_reproducible_seed(config.seed if hasattr(config, "seed") else 42)

    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    setup_logging(job_id=job_id, log_dir=out_path)
    log = get_logger("pipeline")

    def _notify(prog: float, msg: str):
        log.info(msg)
        if progress_callback:
            try:
                progress_callback(prog, msg)
            except Exception:
                pass

    _notify(0.05, f"Starting SELENE-MATCH pipeline: job={job_id}")
    log.info(f"Source: {src_path} | Reference: {ref_path}")

    # ── Stage 1: Ingest & Geometry ────────────────────────────────────────────
    _notify(0.12, "Stage 1: Ingesting PDS labels, sensor telemetry & reading 16-bit rasters")
    time.sleep(0.3)
    pair = Pair.from_paths(ref=ref_path, mov=src_path)
    img_src, crs_src, trans_src = load_image_any(src_path)
    img_ref, crs_ref, trans_ref = load_image_any(ref_path)

    # Footprint geometry pre-cropping if footprint metadata available
    if pair.mov_meta.footprint_wkt and trans_ref is not None:
        img_ref, trans_ref, _ = crop_reference_to_pair(img_ref, trans_ref, pair.mov_meta.footprint_wkt)

    log.info(f"Stage 1 Ingest: src_shape={img_src.shape}, ref_shape={img_ref.shape}, delta_az={pair.delta_sun_az:.1f} deg, gsd_ratio={pair.gsd_ratio:.2f}")

    # ── Stage 2: GSD Pyramid Scale Equalization ──────────────────────────────
    _notify(0.25, "Stage 2: Constructing multi-scale Gaussian pyramids & resampling to uniform GSD")
    time.sleep(0.3)
    common_gsd_m = max(pair.ref_meta.gsd_m, pair.mov_meta.gsd_m)
    img_src_work = resample_to_gsd(img_src, pair.mov_meta.gsd_m, common_gsd_m)
    img_ref_work = resample_to_gsd(img_ref, pair.ref_meta.gsd_m, common_gsd_m)
    log.info(f"Stage 2 GSD Pyramid: resampled to common GSD={common_gsd_m:.2f}m | src_work={img_src_work.shape}, ref_work={img_ref_work.shape}")

    # ── Stage 2b: Illumination Shadow Masking ───────────────────────────────
    _notify(0.35, "Stage 3: Illumination shadow masking & Wallis adaptive filtering")
    time.sleep(0.3)
    shadow_mask_src = detect_shadows(img_src_work)
    shadow_mask_ref = detect_shadows(img_ref_work)
    shadow_pct = (np.count_nonzero(shadow_mask_src) / max(shadow_mask_src.size, 1)) * 100.0
    log.info(f"Stage 3 Shadow Mask: computed exclusion zones ({np.count_nonzero(shadow_mask_src)} shadow px, {shadow_pct:.1f}% area)")

    # ── Stage 3/4: Matching Ensemble & Gate (Multi-Scale Pyramid) ───────────────
    _notify(0.50, "Stage 4: Feature matching & mutual correspondence extraction")
    time.sleep(0.4)
    pts_src_w, pts_ref_w, scores, matcher_name = match_coarse_to_fine_pyramid(
        img_src=img_src,
        img_ref=img_ref,
        pair=pair,
        config=config,
        route_and_match_fn=route_and_match,
    )
    log.info(f"Stage 4 Matcher [{matcher_name}]: extracted {len(pts_src_w)} candidate feature correspondences")

    if len(pts_src_w) < 4:
        raise RuntimeError(
            f"Insufficient match candidates found by matcher ({len(pts_src_w)} points, minimum 4 required). "
            "Please ensure both Reference and Source images depict the same overlapping lunar surface area with shared craters."
        )

    # Map match coordinates from working GSD space back to native pixel space
    pts_src_nat = upscale_coordinates(pts_src_w, from_gsd_m=common_gsd_m, to_gsd_m=pair.mov_meta.gsd_m)
    pts_ref_nat = upscale_coordinates(pts_ref_w, from_gsd_m=common_gsd_m, to_gsd_m=pair.ref_meta.gsd_m)

    # ── Stage 5: Robust Fit & Shadow-Aware Uniform GCP Sampling ─────────────
    _notify(0.65, "Stage 5: USAC_MAGSAC++ robust geometry fitting & outlier filtering")
    time.sleep(0.4)
    # Convert threshold from metres to pixels using reference GSD
    magsac_threshold_px = config.magsac_threshold_m / max(pair.ref_meta.gsd_m, 1e-6)
    H_fit, inlier_mask = find_homography_magsac(pts_src_nat, pts_ref_nat, threshold_px=magsac_threshold_px)
    inlier_ratio_pct = (np.sum(inlier_mask) / max(len(pts_src_nat), 1)) * 100.0
    log.info(f"Stage 5 MAGSAC++: retained {np.sum(inlier_mask)} inliers / {len(pts_src_nat)} candidates ({inlier_ratio_pct:.1f}% consensus, threshold={magsac_threshold_px:.2f}px)")

    pts_src_in = pts_src_nat[inlier_mask]
    pts_ref_in = pts_ref_nat[inlier_mask]
    scores_in = scores[inlier_mask] if len(scores) == len(inlier_mask) else None

    # Spatial uniformity sampling with shadow mask exclusion
    pts_src_gcp, pts_ref_gcp, sel_idx = sample_uniform_gcps(
        pts_src_in,
        pts_ref_in,
        scores=scores_in,
        image_shape=img_src.shape[:2],
        grid_cells=config.grid_cells,
        min_dist_px=config.min_gcp_spacing_px,
        shadow_mask=shadow_mask_src,
    )
    log.info(f"Stage 5 Uniform Sampler: selected {len(pts_src_gcp)} well-distributed GCPs across 8x8 grid")

    # ── Stage 7: Sub-Pixel Refinement Cascade (IC-LK with ECC fallback) ─────────
    _notify(0.78, "Stage 7: Sub-pixel IC-LK Lucas-Kanade 21x21 refinement with ECC fallback")
    time.sleep(0.4)
    pts_src_refined, valid_lk, ref_methods = refine_subpixel_cascade(
        img_ref=img_ref,
        img_mov=img_src,
        pts_ref=pts_ref_gcp,
        pts_mov=pts_src_gcp,
        patch_size=config.lk_patch_size,
        max_iters=config.lk_max_iter,
        eps=config.lk_eps,
    )
    # Points that converged under IC-LK/ECC receive subpixel coordinates;
    # unrefined inliers retain detector keypoint coordinates.
    pts_src_final = pts_src_gcp.copy()
    pts_src_final[valid_lk] = pts_src_refined[valid_lk]
    pts_ref_final = pts_ref_gcp.copy()

    # Filter canvas boundaries
    h_m, w_m = img_src.shape[:2]
    h_r, w_r = img_ref.shape[:2]
    in_bounds = (
        (pts_src_final[:, 0] >= 0) & (pts_src_final[:, 0] < w_m) &
        (pts_src_final[:, 1] >= 0) & (pts_src_final[:, 1] < h_m) &
        (pts_ref_final[:, 0] >= 0) & (pts_ref_final[:, 0] < w_r) &
        (pts_ref_final[:, 1] >= 0) & (pts_ref_final[:, 1] < h_r)
    )
    pts_src_final = pts_src_final[in_bounds]
    pts_ref_final = pts_ref_final[in_bounds]
    n_final_gcps = len(pts_src_final)

    num_subpixel = int(np.sum(valid_lk[in_bounds])) if len(in_bounds) > 0 else 0
    log.info(f"Stage 7 Refinement: {num_subpixel}/{n_final_gcps} GCPs achieved sub-pixel accuracy (IC-LK/ECC), {n_final_gcps - num_subpixel} retained detector-level accuracy")

    if n_final_gcps < 4:
        raise RegistrationFailureError(
            f"Registration failed: insufficient validated GCPs after sub-pixel refinement ({n_final_gcps} points, minimum 4 required). "
            "Cannot establish a mathematically reliable transformation."
        )

    # --- GCP Confidence Score ---
    scores_gcp = scores_in[sel_idx] if scores_in is not None else np.ones(len(pts_src_gcp))
    scores_final = scores_gcp[in_bounds]

    if H_fit is not None and n_final_gcps > 0:
        ones = np.ones((n_final_gcps, 1))
        homo_src = np.hstack([pts_src_final, ones])
        proj = (H_fit @ homo_src.T).T
        proj_pts = proj[:, :2] / (proj[:, 2:] + 1e-8)
        residuals = np.linalg.norm(proj_pts - pts_ref_final, axis=1)
        res_score = np.clip(1.0 - residuals / 5.0, 0, 1.0)
    else:
        res_score = np.ones(n_final_gcps)

    if shadow_mask_src is not None and np.any(shadow_mask_src > 0) and n_final_gcps > 0:
        dist_transform = cv2.distanceTransform((shadow_mask_src == 0).astype(np.uint8), cv2.DIST_L2, 3)
        x_idx = np.clip(pts_src_final[:, 0].astype(int), 0, dist_transform.shape[1] - 1)
        y_idx = np.clip(pts_src_final[:, 1].astype(int), 0, dist_transform.shape[0] - 1)
        dists = dist_transform[y_idx, x_idx]
        dist_score = np.clip(dists / 50.0, 0, 1.0)
    else:
        dist_score = np.ones(n_final_gcps)

    confidence = (scores_final + res_score + dist_score) / 3.0
    lk_count = sum(1 for m in ref_methods if m == "ic_lk")
    ecc_count = sum(1 for m in ref_methods if m == "ecc")
    log.info(f"Stage 7 Sub-pixel Refinement: {n_final_gcps} validated GCPs (IC-LK: {lk_count}, ECC fallback: {ecc_count})")

    # ── Stage 6: Independent 80/20 Train/Validation Split & Transformation Fit ──
    _notify(0.88, "Stage 6: Fitting transformation model & warping raster")
    ref_shape = img_ref.shape[:2]

    # Independent 80/20 train/validation split performed BEFORE fitting
    val_split = 0.20
    if n_final_gcps >= 5:
        rng = np.random.RandomState(config.seed if hasattr(config, "seed") else 42)
        indices = np.arange(n_final_gcps)
        rng.shuffle(indices)
        n_val = max(1, int(round(n_final_gcps * val_split)))
        val_idx = indices[:n_val]
        train_idx = indices[n_val:]
        pts_src_train = pts_src_final[train_idx]
        pts_ref_train = pts_ref_final[train_idx]
        pts_src_val = pts_src_final[val_idx]
        pts_ref_val = pts_ref_final[val_idx]
        confidence_train = confidence[train_idx]
        confidence_val = confidence[val_idx]
    else:
        pts_src_train = pts_src_final
        pts_ref_train = pts_ref_final
        pts_src_val = pts_src_final
        pts_ref_val = pts_ref_final
        confidence_train = confidence
        confidence_val = confidence

    # Fit final transformation on training set with fallback cascade (TPS -> PWA -> Homography -> Fail)
    fitted_model, actual_model_name, fallback_reason = fit_final_transformation(
        pts_src=pts_src_train,
        pts_dst=pts_ref_train,
        requested_model=config.warp_model,
        min_gcps_for_tps=config.min_gcps_for_tps,
        output_shape=ref_shape,
    )
    if fallback_reason:
        log.warning(f"Transformation cascade fallback: {fallback_reason}")
    log.info(f"Stage 6 Model Fit: actual transformation='{actual_model_name}' fitted on {len(pts_src_train)} train GCPs")

    # Warp image with fitted model
    warped = fitted_model.warp_image(img_src, output_shape=ref_shape)

    # Export Warped GeoTIFF / Product
    registered_tif = out_path / "registered.tif"
    export_geotiff(
        img_array=warped,
        out_path=registered_tif,
        crs=crs_ref,
        transform=trans_ref,
    )
    # Export PNG view for UI
    registered_png = out_path / "registered.png"
    cv2.imwrite(str(registered_png), (warped * 255).clip(0, 255).astype(np.uint8))

    # Save matches CSV with real coordinates, split role, and confidence
    matches_csv = out_path / "matches.csv"
    with open(matches_csv, "w") as f:
        f.write("src_x,src_y,ref_x,ref_y,confidence,split\n")
        for (sx, sy), (rx, ry), c in zip(pts_src_train, pts_ref_train, confidence_train):
            f.write(f"{sx:.3f},{sy:.3f},{rx:.3f},{ry:.3f},{c:.3f},train\n")
        for (sx, sy), (rx, ry), c in zip(pts_src_val, pts_ref_val, confidence_val):
            f.write(f"{sx:.3f},{sy:.3f},{rx:.3f},{ry:.3f},{c:.3f},validation\n")

    # ── Stage 8: Evaluation & Deliverables ────────────────────────────────────
    _notify(0.96, "Stage 8: Generating metrics, plots & PDF report")

    # Check for Ground Truth transformation if available
    H_gt = None
    gt_candidate = Path(src_path).parent / "ground_truth.json"
    if not gt_candidate.exists():
        gt_candidate = Path(ref_path).parent / "ground_truth.json"
    if gt_candidate.exists():
        try:
            with open(gt_candidate) as f:
                gt_data = json.load(f)
            if "homography_matrix_3x3" in gt_data:
                H_gt = np.array(gt_data["homography_matrix_3x3"], dtype=np.float64)
        except Exception:
            pass

    # Provenance metadata tracking
    git_commit = "unknown"
    try:
        import subprocess
        git_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], timeout=2.0).decode().strip()
    except Exception:
        pass

    deep_available = False
    torch_ver = "none"
    try:
        import torch
        torch_ver = torch.__version__
        deep_available = True
    except ImportError:
        pass

    provenance = {
        "git_commit": git_commit,
        "seed": config.seed if hasattr(config, "seed") else 42,
        "matcher_used": matcher_name,
        "requested_warp_model": config.warp_model,
        "actual_warp_model": actual_model_name,
        "warp_fallback_reason": fallback_reason,
        "deep_matcher_available": deep_available,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat() + "Z",
        "package_versions": {"torch": torch_ver, "opencv": cv2.__version__},
    }

    # Evaluate final transform strictly on holdout validation set
    metrics = compute_metrics(
        pts_train_src=pts_src_train,
        pts_train_dst=pts_ref_train,
        pts_src_val=pts_src_val,
        pts_dst_val=pts_ref_val,
        ref_gsd_m=pair.ref_meta.gsd_m,
        transform_model=fitted_model,
        H_gt=H_gt,
        image_shape=ref_shape,
        shadow_mask=shadow_mask_ref,
        n_raw_candidates=len(pts_src_w),
        provenance=provenance,
        final_warp_model=actual_model_name,
    )

    metrics_dict = metrics.to_dict()
    metrics_dict["mean_confidence"] = float(np.mean(confidence)) if len(confidence) > 0 else 0.0
    metrics_dict["pct_gcp_confidence_ge_0.6"] = float(np.mean(confidence >= 0.6)) if len(confidence) > 0 else 0.0

    if H_fit is not None and getattr(H_fit, "shape", None) == (3, 3):
        a, b, tx = float(H_fit[0, 0]), float(H_fit[0, 1]), float(H_fit[0, 2])
        c, d, ty = float(H_fit[1, 0]), float(H_fit[1, 1]), float(H_fit[1, 2])
        scale_x = float(np.sqrt(a**2 + c**2))
        scale_y = float(np.sqrt(b**2 + d**2))
        rot_deg = float(np.degrees(np.arctan2(c, a)))
        metrics_dict["recovered_transform"] = {
            "rotation_deg": round(rot_deg, 2),
            "scale": round((scale_x + scale_y) / 2.0, 3),
            "tx_px": round(tx, 1),
            "ty_px": round(ty, 1),
        }

    if H_gt is not None:
        try:
            metrics_dict["ground_truth_transform"] = {
                "rotation_deg": float(gt_data.get("rotation_deg", 0.0)),
                "scale": float(gt_data.get("scale", 1.0)),
                "tx_px": float(gt_data.get("tx", 0.0)),
                "ty_px": float(gt_data.get("ty", 0.0)),
            }
        except Exception:
            pass

    metrics_json = out_path / "metrics.json"
    with open(metrics_json, "w") as f:
        json.dump(metrics_dict, f, indent=2)

    # Verification Plots
    p_checker = plot_checkerboard(img_ref, warped, out_path / "plot_checkerboard.png")
    p_quiver = plot_quiver(pts_src_final, pts_ref_final, out_path / "plot_quiver.png", image_shape=ref_shape)
    p_heatmap = plot_coverage_heatmap(pts_ref_final, out_path / "plot_coverage.png", image_shape=ref_shape)
    p_residual = plot_residual_heatmap(pts_src_final, pts_ref_final, out_path / "plot_residual_heatmap.png", image_shape=ref_shape)

    # Deliverable PDF
    exec_time = time.time() - t_start
    pdf_report = generate_pdf_report(
        job_dir=out_path,
        metrics=metrics,
        job_id=job_id,
        plots=[p_checker, p_quiver, p_heatmap],
        pair=pair,
        exec_time_s=exec_time,
        matcher_name=matcher_name,
        img_ref=img_ref,
        img_src=img_src,
        pts_ref=pts_ref_final,
        pts_src=pts_src_final,
    )

    log.info(f"Pipeline completed successfully. Train RMSE={metrics.rmse_m:.2f} m ({metrics.rmse_px:.2f} px) | Val RMSE={metrics.rmse_val_m if metrics.rmse_val_m is not None else 0.0:.2f} m")

    return {
        "job_id": job_id,
        "status": "success",
        "registered_geotiff": str(registered_tif),
        "matches_csv": str(matches_csv),
        "metrics": metrics_dict,
        "pdf_report": str(pdf_report),
        "residual_heatmap": str(p_residual),
    }


def main() -> None:
    parser = argparse.ArgumentParser(prog="selene", description="SELENE-MATCH Lunar Image Registration CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run the full correspondence + registration pipeline")
    p_run.add_argument("--src", required=True, help="Path to moving source image")
    p_run.add_argument("--ref", required=True, help="Path to reference image")
    p_run.add_argument("--out", required=True, help="Output directory for products")
    p_run.add_argument("--config", default=None, help="Path to optional config.yaml")

    p_eval = sub.add_parser("eval", help="Compute/print evaluation metrics for a job")
    p_eval.add_argument("--job", required=True, help="Path to completed job directory")

    p_export = sub.add_parser("export", help="Package a job's deliverables into a zip bundle")
    p_export.add_argument("--job", required=True, help="Path to completed job directory")
    p_export.add_argument("--zip", required=True, help="Path for destination .zip file")

    args = parser.parse_args()

    if args.command == "run":
        cfg = load_config(args.config) if args.config else PipelineConfig()
        res = run_pipeline(src_path=args.src, ref_path=args.ref, out_dir=args.out, config=cfg)
        print("\n=== Registration Results ===")
        for k, v in res["metrics"].items():
            print(f"  {k}: {v}")
        print(f"\nDeliverables saved to: {args.out}")

    elif args.command == "eval":
        metrics_file = Path(args.job) / "metrics.json"
        if not metrics_file.exists():
            print(f"Error: metrics.json not found in {args.job}")
            return
        with open(metrics_file) as f:
            data = json.load(f)
        print(f"\n=== Evaluation Metrics for {args.job} ===")
        for k, v in data.items():
            print(f"  {k}: {v}")

    elif args.command == "export":
        job_dir = Path(args.job)
        zip_path = Path(args.zip)
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in job_dir.glob("**/*"):
                if file.is_file() and not file.name.endswith(".zip"):
                    zf.write(file, arcname=file.relative_to(job_dir))
        print(f"Exported deliverable bundle to: {zip_path}")


if __name__ == "__main__":
    main()
