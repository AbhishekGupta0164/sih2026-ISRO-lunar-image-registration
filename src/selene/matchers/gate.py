"""THE gate table (Stage 5): routes each tile to the right expert(s) based on modality, |delta sun-azimuth|, and GSD ratio.

Owner: P3
"""
from __future__ import annotations

import numpy as np
from selene.config import PipelineConfig
from selene.ingest.pair import Pair
from .sift_baseline import match_sift
from .lightglue_matcher import match_lightglue
from .loftr_matcher import match_loftr
from .xfeat_matcher import match_xfeat
from .phase_correlation import match_phase_correlation
from .mutual_information import match_mutual_information
from selene.craters.detector import detect_craters
from selene.craters.graph_match import build_crater_graph, match_crater_graphs
from selene.illum.phase_congruency import phase_congruency
from selene.illum.hillshade import relight
from selene.illum.census import census_transform


def select_matcher(pair: Pair, config: PipelineConfig | None = None) -> str:
    """Determine the optimal matcher strategy from image pair characteristics.

    Routing Table:
    - delta_sun_az > 60° (opposite illumination / polar) -> 'crater_graph'
    - cross-sensor (e.g. IIRS <-> TMC/WAC)               -> 'mutual_info'
    - gsd_ratio > 3.0                                   -> 'phase_corr'
    - same sensor & delta_sun_az <= 60°                 -> 'lightglue'
    - fallback                                          -> 'sift'
    """
    if config and config.matcher != "auto":
        if not getattr(config, "allow_deep_matchers", True) and config.matcher in ("loftr", "lightglue", "xfeat"):
            return "sift"
        return config.matcher

    delta_az = pair.delta_sun_az
    gsd_r = pair.gsd_ratio

    if delta_az >= (config.sun_azimuth_flip_deg if config else 60.0):
        return "crater_graph"
    elif pair.is_cross_sensor and ("IIRS" in (pair.ref_meta.sensor_id, pair.mov_meta.sensor_id)):
        return "mutual_info"
    elif gsd_r > 3.0:
        return "phase_corr"
    elif config is None or getattr(config, "allow_deep_matchers", True):
        return "lightglue"
    else:
        return "sift"


def route_and_match(
    img_src: np.ndarray,
    img_ref: np.ndarray,
    pair: Pair,
    config: PipelineConfig | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    """Execute the selected matcher expert with illumination preprocessing if needed.

    Returns:
        (pts_src, pts_ref, scores, chosen_matcher_name)
    """
    strategy = select_matcher(pair, config)
    # The registration pipeline is also used without a config in a few tests;
    # retain CPU as the safe default for those callers.
    device = config.device if config is not None else "cpu"

    if strategy == "crater_graph":
        # Preprocess with Phase Congruency or Relighting to overcome polarity flip
        craters_src = detect_craters(img_src)
        craters_ref = detect_craters(img_ref)

        g_src = build_crater_graph(craters_src)
        g_ref = build_crater_graph(craters_ref)

        pts_src, pts_ref = match_crater_graphs(g_src, g_ref)
        if len(pts_src) >= 4:
            scores = np.ones(len(pts_src), dtype=np.float32)
            return pts_src, pts_ref, scores, "crater_graph"

        # Fallback 1: Phase Congruency representation
        pc_src = phase_congruency(img_src)
        pc_ref = phase_congruency(img_ref)
        pts_s, pts_r, scores = match_sift(pc_src, pc_ref)
        if len(pts_s) >= 4:
            return pts_s, pts_r, scores, "phase_congruency_sift"

        # Fallback 2: Census Transform structural representation
        c_src = census_transform(img_src).astype(np.float32)
        c_ref = census_transform(img_ref).astype(np.float32)
        pts_s, pts_r, scores = match_sift(c_src, c_ref)
        if len(pts_s) >= 4:
            return pts_s, pts_r, scores, "census_sift"

        return match_sift(img_src, img_ref) + ("sift_fallback",)

    elif strategy == "loftr":
        pts_s, pts_r, scores = match_loftr(img_src, img_ref, device=device)
        if len(pts_s) >= 4:
            return pts_s, pts_r, scores, "loftr"
        pts_s, pts_r, scores = match_sift(img_src, img_ref)
        return pts_s, pts_r, scores, "sift_fallback"

    elif strategy == "xfeat":
        pts_s, pts_r, scores = match_xfeat(img_src, img_ref, device=device)
        if len(pts_s) >= 4:
            return pts_s, pts_r, scores, "xfeat"
        pts_s, pts_r, scores = match_sift(img_src, img_ref)
        return pts_s, pts_r, scores, "sift_fallback"

    elif strategy == "mutual_info":
        pts_s, pts_r, scores = match_mutual_information(img_src, img_ref)
        return pts_s, pts_r, scores, "mutual_info"

    elif strategy == "phase_corr":
        pts_s, pts_r, scores = match_phase_correlation(img_src, img_ref)
        return pts_s, pts_r, scores, "phase_corr"

    elif strategy == "lightglue":
        pts_s, pts_r, scores, actual_matcher = match_lightglue(img_src, img_ref, device=device)
        return pts_s, pts_r, scores, actual_matcher

    else:  # sift baseline
        pts_s, pts_r, scores = match_sift(img_src, img_ref)
        return pts_s, pts_r, scores, "sift"
