"""Central pydantic settings for the SELENE-MATCH pipeline.

Owner: P1 (Geometry & Ingest), consumed by every stage.
Freeze this schema early — every module below imports from here.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel


class PipelineConfig(BaseModel):
    """Knobs that get written to products/<job>/config.yaml for reproducibility."""

    # ── Paths ──────────────────────────────────────────────────────────────────
    products_dir: Path = Path("products")
    data_dir: Path = Path("data")
    seed: int = 42

    # ── Uniformity / GCP sampling (Stage 5–6) ─────────────────────────────────
    grid_cells: int = 8                      # NxN grid for spatial coverage check
    min_gcp_spacing_px: float = 15.0         # minimum distance between two GCPs
    magsac_threshold_m: float = 5.0          # MAGSAC++ reprojection threshold (m)
    max_gcps: int = 200                      # cap on GCPs fed to warp

    # ── Pyramid (Stage 1 geometry support) ────────────────────────────────────
    max_pyramid_levels: int = 5

    # ── Gate thresholds (Stage 3/4) ───────────────────────────────────────────
    sun_azimuth_flip_deg: float = 60.0       # Δaz above this → crater-graph path
    overlap_min_fraction: float = 0.15       # minimum footprint overlap to process

    # ── Matcher selection ──────────────────────────────────────────────────────
    matcher: Literal[
        "auto", "sift", "loftr", "xfeat", "lightglue", "phase_corr", "mutual_info", "crater_graph"
    ] = "auto"
    allow_deep_matchers: bool = True
    # Runtime device for learned matcher backends. Classical matchers ignore it.
    # Kept here so callers such as benchmark.py can use the same pipeline
    # configuration rather than patching matcher internals.
    device: Literal["cpu", "cuda", "mps"] = "cpu"

    # ── Warp model ─────────────────────────────────────────────────────────────
    warp_model: Literal["tps", "piecewise_affine", "homography"] = "tps"
    min_gcps_for_tps: int = 12               # fallback to homography if fewer GCPs

    # ── Sub-pixel refinement ───────────────────────────────────────────────────
    lk_patch_size: int = 21
    lk_max_iter: int = 30
    lk_eps: float = 0.01


def load_config(path: str | Path | None = None) -> PipelineConfig:
    """Load config from a YAML file, or return library defaults if *path* is None."""
    if path is None:
        return PipelineConfig()
    import yaml  # PyYAML, already in environment.yml

    with open(path) as fh:
        data = yaml.safe_load(fh) or {}
    return PipelineConfig(**data)
