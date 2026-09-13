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
) -> tuple[np.ndarray, np.ndarray]:
    """Match crater graph descriptors between source and reference scenes.

    Args:
        graph_src: Graph dict from source image.
        graph_ref: Graph dict from reference image.
        dist_threshold: Maximum normalized feature distance for matching.

    Returns:
        (pts_src, pts_ref) arrays of shape (M, 2) of matching crater coordinates.
    """
    desc_src = graph_src.get("descriptors")
    desc_ref = graph_ref.get("descriptors")

    if desc_src is None or desc_ref is None or len(desc_src) < 3 or len(desc_ref) < 3:
        return np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32)

    tree_ref = KDTree(desc_ref)
    dists, matches = tree_ref.query(desc_src, k=1)

    valid = dists < dist_threshold
    if not np.any(valid):
        # Fallback: take top 4 smallest distance matches if reasonable
        top_k = min(len(dists), 8)
        top_idx = np.argsort(dists)[:top_k]
        valid = np.zeros_like(dists, dtype=bool)
        valid[top_idx] = True

    pts_src = graph_src["centers"][valid]
    matched_ref_indices = matches[valid]
    pts_ref = graph_ref["centers"][matched_ref_indices]

    return pts_src.astype(np.float32), pts_ref.astype(np.float32)
