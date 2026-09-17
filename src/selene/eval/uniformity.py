"""Grid-occupancy + spacing based Coverage / Uniformity score U, shadow-aware.

Owner: P4
"""
from __future__ import annotations

import numpy as np
from scipy.spatial import KDTree


def nni_score(pts: np.ndarray, area_shape: tuple[int, int] = (1024, 1024)) -> float:
    """Compute Clark-Evans Nearest-Neighbour Index (NNI) for spatial distribution.

    Interpretation:
    - NNI around 1.0 indicates a random Poisson spatial distribution.
    - NNI > 1.0 indicates more regular spatial dispersion.
    - NNI < 1.0 indicates spatial clustering.
    Note: NNI measures nearest-neighbour distance relative to random expectation;
    it does not itself guarantee uniform whole-scene coverage.

    Args:
        pts: (N, 2) GCP coordinates in reference/image pixel space.
        area_shape: (height, width) of the bounding image area.

    Returns:
        NNI float value.
    """
    n = len(pts)
    if n < 3:
        return 0.0

    tree = KDTree(pts)
    dists, _ = tree.query(pts, k=2)
    # dist to nearest neighbor (k=2 query returns self at index 0 and 1st NN at index 1)
    nn_dists = dists[:, 1]
    r_observed = float(np.mean(nn_dists))

    area = float(area_shape[0] * area_shape[1])
    density = n / area
    r_expected = 0.5 / np.sqrt(density + 1e-8)

    return float(r_observed / r_expected)


def grid_coverage(
    pts: np.ndarray,
    image_shape: tuple[int, int] = (1024, 1024),
    grid_cells: int = 8,
    shadow_mask: np.ndarray | None = None,
) -> float:
    """Calculate fraction of valid grid cells containing at least one GCP.

    When shadow_mask is provided, cells dominated by shadows (exclusion zones)
    are excluded from the total cell count so non-illuminated terrain is not
    penalised in coverage calculation.

    Args:
        pts: (N, 2) GCP coordinates in image pixel space.
        image_shape: (height, width) of image canvas.
        grid_cells: Grid divisions per axis (e.g. 8 for 64 cells).
        shadow_mask: Optional binary shadow mask (255 = shadow, 0 = illuminated).

    Returns:
        Fraction in [0.0, 1.0] of occupied cells.
    """
    if len(pts) == 0:
        return 0.0

    h, w = image_shape
    cell_h = h / float(grid_cells)
    cell_w = w / float(grid_cells)

    # Determine candidate valid cells (excluding pure shadow cells)
    valid_cells = set()
    for cy in range(grid_cells):
        for cx in range(grid_cells):
            if shadow_mask is not None:
                y0, y1 = int(cy * cell_h), int((cy + 1) * cell_h)
                x0, x1 = int(cx * cell_w), int((cx + 1) * cell_w)
                patch = shadow_mask[y0:y1, x0:x1]
                if patch.size > 0 and np.mean(patch > 0) > 0.90:
                    # Over 90% shadow: exclude this cell as an impossible GCP zone
                    continue
            valid_cells.add((cx, cy))

    if not valid_cells:
        valid_cells = {(cx, cy) for cy in range(grid_cells) for cx in range(grid_cells)}

    occupied = set()
    for x, y in pts:
        cx = min(int(x / cell_w), grid_cells - 1)
        cy = min(int(y / cell_h), grid_cells - 1)
        if (cx, cy) in valid_cells:
            occupied.add((cx, cy))

    return float(len(occupied) / len(valid_cells))

