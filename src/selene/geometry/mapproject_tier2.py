"""DEFAULT geometry backend: estimate an initial affine/RPC transform
from the PDS footprint + sun metadata and crop/warp the reference mosaic
to match.  No external planetary toolkit required.

Owner: P1
"""
from __future__ import annotations

import numpy as np


MOON_RADIUS_M = 1_737_400.0   # IAU mean radius


def affine_from_footprint(
    footprint_corners: list[tuple[float, float]],
    shape: tuple[int, int],
) -> np.ndarray:
    """Estimate a 3×3 pixel→world affine matrix from four corner coordinates.

    Args:
        footprint_corners: Four (lon_deg, lat_deg) tuples in order
                           TL → TR → BR → BL (clockwise from top-left).
        shape:             Image (height, width) in pixels.

    Returns:
        (3, 3) float64 affine matrix mapping pixel (col, row, 1) →
        selenographic (x_m, y_m, 1).
    """
    h, w = shape
    pixel_corners = np.array(
        [[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float64
    )
    # Convert (lon, lat) degrees → approximate metres on a sphere
    world_rad = np.deg2rad(np.array(footprint_corners, dtype=np.float64))
    world_m = world_rad * MOON_RADIUS_M   # (lon_m, lat_m) per row

    # Solve: world_m = P @ A   where P = [col, row, 1]
    ones = np.ones((4, 1), dtype=np.float64)
    P = np.hstack([pixel_corners, ones])   # (4, 3)
    A, _, _, _ = np.linalg.lstsq(P, world_m, rcond=None)   # (3, 2)

    T = np.eye(3, dtype=np.float64)
    T[0, :2] = A[:2, 0]
    T[0, 2] = A[2, 0]
    T[1, :2] = A[:2, 1]
    T[1, 2] = A[2, 1]
    return T


def crop_reference_to_pair(
    ref_array: np.ndarray,
    ref_transform: object | None,
    mov_footprint_wkt: str,
) -> tuple[np.ndarray, object | None, tuple[float, float, float, float] | None]:
    """Crop the reference image to the bounding box of the moving image footprint.

    Updates the affine transform to account for pixel coordinate offsets (c1, r1).

    Args:
        ref_array:         Reference image array (H × W float32).
        ref_transform:     rasterio.Affine transform for the reference raster.
        mov_footprint_wkt: WKT POLYGON of the moving image footprint.

    Returns:
        (cropped_array, updated_transform, bounds_tuple)
    """
    if not mov_footprint_wkt:
        return ref_array, ref_transform, None

    try:
        from shapely import wkt as shapely_wkt
        import rasterio.transform as rt
        from rasterio.transform import Affine

        geom = shapely_wkt.loads(mov_footprint_wkt)
        minx, miny, maxx, maxy = geom.bounds

        if ref_transform is not None:
            # rowcol returns (rows, cols) for each (x, y) pair
            rows, cols = rt.rowcol(
                ref_transform,
                [minx, maxx],
                [miny, maxy],
            )
            r1 = max(0, min(rows))
            r2 = min(ref_array.shape[0], max(rows))
            c1 = max(0, min(cols))
            c2 = min(ref_array.shape[1], max(cols))
            if r2 > r1 and c2 > c1:
                cropped = ref_array[r1:r2, c1:c2]
                new_transform = ref_transform * Affine.translation(c1, r1)
                return cropped, new_transform, (minx, miny, maxx, maxy)
    except Exception:
        pass

    return ref_array, ref_transform, None

