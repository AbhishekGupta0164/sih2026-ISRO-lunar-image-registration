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
    dist_threshold: float = 0.8,
) -> tuple[np.ndarray, np.ndarray]:
    """Match crater graph descriptors between source and reference scenes.
    
    Uses mutual nearest-neighbour filtering to enforce one-to-one matching.
    
    Args:
        graph_src: Graph dict from source image.
        graph_ref: Graph dict from reference image.
        dist_threshold: Maximum normalized feature distance for matching (default 0.8).

    Returns:
        (pts_src, pts_ref) arrays of shape (M, 2) of matching crater coordinates.
    """
    desc_src = graph_src.get("descriptors")
    desc_ref = graph_ref.get("descriptors")

    if desc_src is None or desc_ref is None or len(desc_src) < 3 or len(desc_ref) < 3:
        return np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32)

    # Forward matching: src -> ref
    tree_ref = KDTree(desc_ref)
    dists_fwd, matches_fwd = tree_ref.query(desc_src, k=1)
    
    # Reverse matching: ref -> src (for mutual NN check)
    tree_src = KDTree(desc_src)
    dists_rev, matches_rev = tree_src.query(desc_ref, k=1)
    
    # Mutual nearest-neighbour filtering: i matches j AND j matches i
    mutual_valid = np.zeros(len(desc_src), dtype=bool)
    for i in range(len(desc_src)):
        j = matches_fwd[i]
        if j < len(desc_ref) and matches_rev[j] == i:
            if dists_fwd[i] < dist_threshold:
                mutual_valid[i] = True
    
    # If not enough mutual matches, relax to forward-only with threshold
    n_mutual = np.sum(mutual_valid)
    if n_mutual < 4:
        valid = dists_fwd < dist_threshold
        # Sort by distance and take best matches
        sorted_idx = np.argsort(dists_fwd)
        n_take = max(8, min(len(sorted_idx), int(len(desc_src) * 0.5)))
        valid = np.zeros_like(dists_fwd, dtype=bool)
        valid[sorted_idx[:n_take]] = True
    else:
        valid = mutual_valid

    pts_src = graph_src["centers"][valid]
    matched_ref_indices = matches_fwd[valid]
    pts_ref = graph_ref["centers"][matched_ref_indices]

    return pts_src.astype(np.float32), pts_ref.astype(np.float32)
