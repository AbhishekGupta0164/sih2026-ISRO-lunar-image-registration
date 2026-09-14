"""Build a k-NN neighbour graph (illumination-invariant distances/angles) per image and match graphs across source/reference. 8-20 good crater pairs already constrain an affine on a TMC tile.

Owner: P2
"""
from __future__ import annotations

import numpy as np
from scipy.spatial import KDTree
from .detector import Crater


def build_crater_graph(
    craters: list[Crater],
    k: int = 5,
) -> dict:
    """Construct a geometric invariant graph descriptor for detected craters.

    For each crater, computes relative distances and angles to its k nearest neighbours,
    which are invariant to global illumination shifts.

    Args:
        craters: List of Crater objects.
        k: Number of nearest neighbours.

    Returns:
        Dict containing centers, radii, and invariant descriptors.
    """
    if len(craters) < 3:
        return {"centers": np.empty((0, 2)), "radii": np.empty((0,)), "descriptors": np.empty((0,))}

    centers = np.array([[c.cx, c.cy] for c in craters], dtype=np.float32)
    radii = np.array([c.r for c in craters], dtype=np.float32)

    k_eff = min(k + 1, len(craters))
    tree = KDTree(centers)
    dists, indices = tree.query(centers, k=k_eff)

    # Invariant features: relative distance ratios and radius ratios to neighbours (padded to fixed length k)
    descriptors = []
    for i in range(len(craters)):
        nbr_idx = indices[i, 1:]
        nbr_dists = dists[i, 1:]
        r_ratios = radii[nbr_idx] / (radii[i] + 1e-4)
        d_ratios = nbr_dists / (radii[i] + 1e-4)
        r_sorted = np.sort(r_ratios)
        d_sorted = np.sort(d_ratios)
        if len(r_sorted) < k:
            r_sorted = np.pad(r_sorted, (0, k - len(r_sorted)), constant_values=0.0)
            d_sorted = np.pad(d_sorted, (0, k - len(d_sorted)), constant_values=0.0)
        feat = np.concatenate([r_sorted[:k], d_sorted[:k]])
        descriptors.append(feat)

    return {
        "centers": centers,
        "radii": radii,
        "descriptors": np.array(descriptors, dtype=np.float32),
    }


def match_crater_graphs(
    graph_src: dict,
    graph_ref: dict,
    dist_threshold: float = 0.5,
    max_radius_ratio_dev: float = 0.4,
) -> tuple[np.ndarray, np.ndarray]:
    """Match crater graph descriptors between source and reference scenes.

    Enforces:
    1. Mutual 1-to-1 nearest neighbor verification (src->ref AND ref->src).
    2. Maximum descriptor distance threshold.
    3. Radius ratio consistency: crater size proportions must be physically plausible.

    Args:
        graph_src: Graph dict from source image containing 'centers', 'radii', 'descriptors'.
        graph_ref: Graph dict from reference image containing 'centers', 'radii', 'descriptors'.
        dist_threshold: Maximum normalized feature distance for matching.
        max_radius_ratio_dev: Maximum allowed relative deviation from median radius ratio.

    Returns:
        (pts_src, pts_ref) arrays of shape (M, 2) of verified matching crater coordinates.
    """
    desc_src = graph_src.get("descriptors")
    desc_ref = graph_ref.get("descriptors")
    radii_src = graph_src.get("radii")
    radii_ref = graph_ref.get("radii")
    centers_src = graph_src.get("centers")
    centers_ref = graph_ref.get("centers")

    if (
        desc_src is None
        or desc_ref is None
        or len(desc_src) < 3
        or len(desc_ref) < 3
        or centers_src is None
        or centers_ref is None
    ):
        return np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32)

    # 1. Forward query: src -> ref
    tree_ref = KDTree(desc_ref)
    dists_fwd, matches_fwd = tree_ref.query(desc_src, k=1)

    # 2. Backward query: ref -> src for mutual 1-to-1 consistency
    tree_src = KDTree(desc_src)
    dists_bwd, matches_bwd = tree_src.query(desc_ref, k=1)

    # 3. Find mutual matches within distance threshold
    mutual_src_idx = []
    mutual_ref_idx = []
    for i, j in enumerate(matches_fwd):
        if dists_fwd[i] < dist_threshold:
            if matches_bwd[j] == i and dists_bwd[j] < dist_threshold:
                mutual_src_idx.append(i)
                mutual_ref_idx.append(j)

    if len(mutual_src_idx) < 3:
        return np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32)

    mutual_src_idx = np.array(mutual_src_idx, dtype=int)
    mutual_ref_idx = np.array(mutual_ref_idx, dtype=int)

    # 4. Radius consistency verification if radii available
    if radii_src is not None and radii_ref is not None:
        r_s = radii_src[mutual_src_idx]
        r_r = radii_ref[mutual_ref_idx]
        ratios = r_s / (r_r + 1e-6)
        med_ratio = np.median(ratios)
        if med_ratio > 0:
            rel_dev = np.abs(ratios - med_ratio) / med_ratio
            valid_ratio = rel_dev <= max_radius_ratio_dev
            mutual_src_idx = mutual_src_idx[valid_ratio]
            mutual_ref_idx = mutual_ref_idx[valid_ratio]

    pts_src = centers_src[mutual_src_idx]
    pts_ref = centers_ref[mutual_ref_idx]

    return pts_src.astype(np.float32), pts_ref.astype(np.float32)
