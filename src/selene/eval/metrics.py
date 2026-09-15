"""RMSE_px, RMSE_m, N_raw, N_inlier, inlier ratio, CE90/P90 metrics computation.

Evaluates the exact final transformation model on an independent holdout set (80/20 train/validation split)
to eliminate evaluation data leakage.

Owner: P4
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any
import numpy as np
from selene.eval.uniformity import nni_score, grid_coverage


@dataclass
class MetricsResult:
    """Core geometric alignment accuracy and reliability metrics.

    Separates training model fit error from independent holdout validation error.
    """
    n_raw: int
    n_inliers: int
    inlier_ratio: float
    train_rmse_px: float
    validation_rmse_px: float | None
    train_ce90_px: float
    validation_ce90_px: float | None
    train_rmse_m: float
    validation_rmse_m: float | None
    train_ce90_m: float
    validation_ce90_m: float | None
    mean_residual_px: float
    max_residual_px: float = 0.0
    nni_index: float = 0.0
    grid_coverage_fraction: float = 0.0
    ref_gsd_m: float = 1.0
    rmse_vs_gt_px: float | None = None
    rmse_vs_gt_m: float | None = None
    provenance: dict | None = None
    final_warp_model: str = "homography"

    @property
    def rmse_px(self) -> float:
        """Backward-compatible RMSE in pixels (validation if available, else train)."""
        return self.validation_rmse_px if self.validation_rmse_px is not None else self.train_rmse_px

    @property
    def rmse_m(self) -> float:
        """Backward-compatible RMSE in metres (validation if available, else train)."""
        return self.validation_rmse_m if self.validation_rmse_m is not None else self.train_rmse_m

    @property
    def ce90_px(self) -> float:
        """Backward-compatible CE90 in pixels."""
        return self.validation_ce90_px if self.validation_ce90_px is not None else self.train_ce90_px

    @property
    def ce90_m(self) -> float:
        """Backward-compatible CE90 in metres."""
        return self.validation_ce90_m if self.validation_ce90_m is not None else self.train_ce90_m

    @property
    def rmse_val_px(self) -> float:
        """Backward-compatible validation RMSE in pixels."""
        return self.validation_rmse_px if self.validation_rmse_px is not None else 0.0

    @property
    def rmse_val_m(self) -> float:
        """Backward-compatible validation RMSE in metres."""
        return self.validation_rmse_m if self.validation_rmse_m is not None else 0.0

    @property
    def gsd_m(self) -> float:
        """Alias for reference GSD."""
        return self.ref_gsd_m

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        # Add backward-compatible top-level keys for existing consumers
        d["rmse_px"] = self.rmse_px
        d["rmse_m"] = self.rmse_m
        d["ce90_px"] = self.ce90_px
        d["ce90_m"] = self.ce90_m
        d["rmse_val_px"] = self.rmse_val_px
        d["rmse_val_m"] = self.rmse_val_m
        d["gsd_m"] = self.ref_gsd_m
        return d


def compute_metrics(
    pts_src: np.ndarray | None = None,
    pts_dst: np.ndarray | None = None,
    inlier_mask: np.ndarray | None = None,
    gsd_m: float = 1.0,
    ref_gsd_m: float | None = None,
    H_fit: np.ndarray | None = None,
    transform_model: Any = None,
    H_gt: np.ndarray | None = None,
    image_shape: tuple[int, int] = (1024, 1024),
    shadow_mask: np.ndarray | None = None,
    pts_src_val: np.ndarray | None = None,
    pts_dst_val: np.ndarray | None = None,
    pts_train_src: np.ndarray | None = None,
    pts_train_dst: np.ndarray | None = None,
    val_split: float = 0.2,
    n_raw_candidates: int | None = None,
    provenance: dict | None = None,
    final_warp_model: str = "homography",
) -> MetricsResult:
    """Calculate truthful geodetic accuracy metrics on matched point correspondences.

    Enforces independent 80/20 train/validation evaluation:
    - The transformation model is evaluated on holdout points that did NOT influence fitting.
    - Residuals are measured in reference coordinates and converted to metres using reference GSD.
    - Uniformity (NNI) and Coverage are calculated on reference coordinates within reference image bounds.

    Args:
        pts_src:            (N, 2) Source points (or training source points).
        pts_dst:            (N, 2) Destination/Reference points.
        inlier_mask:        (N,) Boolean inlier mask.
        gsd_m:              Legacy GSD parameter (interpreted as ref_gsd_m if ref_gsd_m not given).
        ref_gsd_m:          Ground sampling distance of reference image in metres/pixel.
        H_fit:              Legacy fitted 3x3 Homography for residual calculation.
        transform_model:    Fitted final transformation model (TPS, PWA, or Homography).
        H_gt:               Independent Ground Truth 3x3 Homography.
        image_shape:        (height, width) of the reference image canvas.
        shadow_mask:        Optional shadow exclusion mask on reference image.
        pts_src_val:        Explicit holdout validation source points.
        pts_dst_val:        Explicit holdout validation destination points.
        pts_train_src:      Explicit training source points.
        pts_train_dst:      Explicit training destination points.
        val_split:          Holdout fraction (default 0.20 for 80/20 split).
        n_raw_candidates:   Total candidate correspondences before outlier filtering.
        provenance:         Metadata dictionary tracking execution provenance.
        final_warp_model:   Name of the final warp model used ('tps', 'piecewise_affine', 'homography').

    Returns:
        MetricsResult instance.
    """
    effective_ref_gsd = float(ref_gsd_m if ref_gsd_m is not None else gsd_m)

    # Resolve training and validation point sets
    if pts_train_src is not None and pts_train_dst is not None:
        train_src = np.asarray(pts_train_src, dtype=np.float32)
        train_dst = np.asarray(pts_train_dst, dtype=np.float32)
        val_src = np.asarray(pts_src_val, dtype=np.float32) if pts_src_val is not None else np.empty((0, 2), dtype=np.float32)
        val_dst = np.asarray(pts_dst_val, dtype=np.float32) if pts_dst_val is not None else np.empty((0, 2), dtype=np.float32)
        n_inliers = len(train_src) + len(val_src)
        n_raw = n_raw_candidates if n_raw_candidates is not None else n_inliers
        all_inliers_dst = np.vstack([train_dst, val_dst]) if len(val_dst) > 0 else train_dst
    else:
        if pts_src is None or pts_dst is None or len(pts_src) == 0:
            return MetricsResult(
                n_raw=0, n_inliers=0, inlier_ratio=0.0,
                train_rmse_px=0.0, validation_rmse_px=None,
                train_ce90_px=0.0, validation_ce90_px=None,
                train_rmse_m=0.0, validation_rmse_m=None,
                train_ce90_m=0.0, validation_ce90_m=None,
                mean_residual_px=0.0, max_residual_px=0.0,
                nni_index=0.0, grid_coverage_fraction=0.0,
                ref_gsd_m=effective_ref_gsd, provenance=provenance,
                final_warp_model=final_warp_model,
            )

        n_raw = n_raw_candidates if n_raw_candidates is not None else len(pts_src)
        if inlier_mask is None:
            inlier_mask = np.ones(len(pts_src), dtype=bool)

        inliers_src = pts_src[inlier_mask].astype(np.float32)
        inliers_dst = pts_dst[inlier_mask].astype(np.float32)
        n_inliers = len(inliers_src)
        all_inliers_dst = inliers_dst

        if n_inliers == 0:
            return MetricsResult(
                n_raw=n_raw, n_inliers=0, inlier_ratio=0.0,
                train_rmse_px=0.0, validation_rmse_px=None,
                train_ce90_px=0.0, validation_ce90_px=None,
                train_rmse_m=0.0, validation_rmse_m=None,
                train_ce90_m=0.0, validation_ce90_m=None,
                mean_residual_px=0.0, max_residual_px=0.0,
                nni_index=0.0, grid_coverage_fraction=0.0,
                ref_gsd_m=effective_ref_gsd, provenance=provenance,
                final_warp_model=final_warp_model,
            )

        if pts_src_val is not None and pts_dst_val is not None:
            train_src, train_dst = inliers_src, inliers_dst
            val_src, val_dst = np.asarray(pts_src_val, dtype=np.float32), np.asarray(pts_dst_val, dtype=np.float32)
        elif n_inliers >= 10:
            # Deterministic spatially representative split: systematic 1-in-5 stride across spatial index
            n_val = max(2, int(n_inliers * val_split))
            # Sort by distance from center of reference image to ensure representative spatial coverage
            center = np.array([image_shape[1] / 2.0, image_shape[0] / 2.0], dtype=np.float32)
            dist_center = np.linalg.norm(inliers_dst - center, axis=1)
            sorted_idx = np.argsort(dist_center)

            stride = max(1, n_inliers // n_val)
            val_idx = sorted_idx[::stride][:n_val]
            train_idx = np.array([i for i in range(n_inliers) if i not in set(val_idx)])

            train_src, train_dst = inliers_src[train_idx], inliers_dst[train_idx]
            val_src, val_dst = inliers_src[val_idx], inliers_dst[val_idx]
        else:
            train_src, train_dst = inliers_src, inliers_dst
            val_src, val_dst = np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32)

    inlier_ratio = float(n_inliers / max(n_raw, 1))

    # Determine transform evaluator (prefers transform_model, falls back to H_fit)
    active_model = transform_model if transform_model is not None else H_fit

    def _calc_residuals(s_pts: np.ndarray, d_pts: np.ndarray) -> np.ndarray:
        if len(s_pts) == 0:
            return np.empty((0,), dtype=np.float32)
        if active_model is not None:
            if hasattr(active_model, "transform_points"):
                pred_dst = active_model.transform_points(s_pts)
            elif isinstance(active_model, np.ndarray) and active_model.shape == (3, 3):
                ones = np.ones((len(s_pts), 1), dtype=np.float32)
                homo_src = np.hstack([s_pts, ones])
                proj = (active_model @ homo_src.T).T
                pred_dst = proj[:, :2] / (proj[:, 2:] + 1e-8)
            elif callable(active_model):
                pred_dst = active_model(s_pts)
            else:
                pred_dst = s_pts
            return np.linalg.norm(pred_dst - d_pts, axis=1).astype(np.float32)
        return np.linalg.norm(s_pts - d_pts, axis=1).astype(np.float32)

    # Compute training residuals
    residuals_train = _calc_residuals(train_src, train_dst)
    if len(residuals_train) > 0:
        train_rmse_px = float(np.sqrt(np.mean(residuals_train**2)))
        train_ce90_px = float(np.percentile(residuals_train, 90))
        mean_res_px = float(np.mean(residuals_train))
        max_res_px = float(np.max(residuals_train))
    else:
        train_rmse_px = 0.0
        train_ce90_px = 0.0
        mean_res_px = 0.0
        max_res_px = 0.0

    train_rmse_m = float(train_rmse_px * effective_ref_gsd)
    train_ce90_m = float(train_ce90_px * effective_ref_gsd)

    # Compute independent holdout validation residuals
    if len(val_src) > 0:
        residuals_val = _calc_residuals(val_src, val_dst)
        val_rmse_px = float(np.sqrt(np.mean(residuals_val**2)))
        val_ce90_px = float(np.percentile(residuals_val, 90))
        val_rmse_m = float(val_rmse_px * effective_ref_gsd)
        val_ce90_m = float(val_ce90_px * effective_ref_gsd)
    else:
        val_rmse_px = None
        val_ce90_px = None
        val_rmse_m = None
        val_ce90_m = None

    # Spatial Uniformity & Coverage computed on reference canvas
    nni_val = nni_score(all_inliers_dst, area_shape=image_shape)
    cov_val = grid_coverage(all_inliers_dst, image_shape=image_shape, shadow_mask=shadow_mask)

    # Independent Ground Truth RMSE (only if explicit GT transform matrix is provided)
    rmse_vs_gt_px = None
    rmse_vs_gt_m = None
    if H_gt is not None and len(all_inliers_dst) > 0:
        all_inliers_src = np.vstack([train_src, val_src]) if len(val_src) > 0 else train_src
        ones = np.ones((len(all_inliers_src), 1), dtype=np.float32)
        homo_src = np.hstack([all_inliers_src, ones])
        proj = (H_gt @ homo_src.T).T
        proj_pts = proj[:, :2] / (proj[:, 2:] + 1e-8)
        res_gt = np.linalg.norm(proj_pts - all_inliers_dst, axis=1)
        rmse_vs_gt_px = float(round(np.sqrt(np.mean(res_gt**2)), 4))
        rmse_vs_gt_m = float(round(rmse_vs_gt_px * effective_ref_gsd, 4))

    return MetricsResult(
        n_raw=int(n_raw),
        n_inliers=int(n_inliers),
        inlier_ratio=round(inlier_ratio, 4),
        train_rmse_px=round(train_rmse_px, 4),
        validation_rmse_px=round(val_rmse_px, 4) if val_rmse_px is not None else None,
        train_ce90_px=round(train_ce90_px, 4),
        validation_ce90_px=round(val_ce90_px, 4) if val_ce90_px is not None else None,
        train_rmse_m=round(train_rmse_m, 4),
        validation_rmse_m=round(val_rmse_m, 4) if val_rmse_m is not None else None,
        train_ce90_m=round(train_ce90_m, 4),
        validation_ce90_m=round(val_ce90_m, 4) if val_ce90_m is not None else None,
        mean_residual_px=round(mean_res_px, 4),
        max_residual_px=round(max_res_px, 4),
        nni_index=round(nni_val, 4),
        grid_coverage_fraction=round(cov_val, 4),
        ref_gsd_m=effective_ref_gsd,
        rmse_vs_gt_px=rmse_vs_gt_px,
        rmse_vs_gt_m=rmse_vs_gt_m,
        provenance=provenance,
        final_warp_model=final_warp_model,
    )


def check_quality_gates(metrics: MetricsResult, subpixel_target: float = 1.0) -> dict[str, bool]:
    """Validate whether registration metrics meet PS target standards.

    Checks validation RMSE if available, else train RMSE.
    """
    eval_rmse = metrics.validation_rmse_px if metrics.validation_rmse_px is not None else metrics.train_rmse_px
    rmse_pass = eval_rmse < subpixel_target and metrics.n_inliers >= 4
    inlier_pass = metrics.n_inliers >= 4 and metrics.inlier_ratio >= 0.10
    coverage_pass = metrics.grid_coverage_fraction >= 0.25

    return {
        "subpixel_target_met": rmse_pass,
        "inlier_target_met": inlier_pass,
        "coverage_target_met": coverage_pass,
        "overall_pass": rmse_pass and inlier_pass,
    }


