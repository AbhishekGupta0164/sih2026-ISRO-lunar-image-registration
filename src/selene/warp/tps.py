"""Thin-plate-spline residual warp — default final geometric model when >=12 well-spread GCPs are available.

Owner: P3/P4
"""
from __future__ import annotations

import logging
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.spatial import ConvexHull, KDTree
import cv2

_log = logging.getLogger("selene.warp.tps")


class GeometricDegeneracyError(RuntimeError):
    """Raised when control point geometry is degenerate (collinear, duplicate, or singular)."""
    pass


def validate_and_filter_tps_points(
    src_pts: np.ndarray,
    dst_pts: np.ndarray,
    min_dist_px: float = 2.0,
    min_convex_area: float = 50.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Validate and filter GCP points to prevent TPS singular matrix errors.

    Checks:
    1. Minimum point count (>= 4).
    2. Spatial deduplication / minimum distance enforcement.
    3. Coordinate matrix rank check (must be 3).
    4. SVD/PCA collinearity check.
    5. Convex hull area check.

    Returns:
        (filtered_src, filtered_dst)

    Raises:
        GeometricDegeneracyError if points cannot support a 2D TPS.
    """
    if len(src_pts) < 4 or len(dst_pts) < 4:
        raise GeometricDegeneracyError(
            f"Insufficient GCPs for TPS: got {len(dst_pts)}, minimum 4 required."
        )

    # 1. Enforce minimum spatial separation (deduplicate near-identical points)
    kept_indices = []
    tree = KDTree(dst_pts)
    visited = set()
    for i in range(len(dst_pts)):
        if i in visited:
            continue
        kept_indices.append(i)
        # Find any other points within min_dist_px and mark visited
        neighbors = tree.query_ball_point(dst_pts[i], r=min_dist_px)
        visited.update(neighbors)

    filtered_src = src_pts[kept_indices].astype(np.float64)
    filtered_dst = dst_pts[kept_indices].astype(np.float64)

    if len(filtered_dst) < 4:
        raise GeometricDegeneracyError(
            f"Too few unique GCPs after spatial deduplication ({len(filtered_dst)} remaining, minimum 4 required)."
        )

    # 2. Check collinearity via PCA/SVD
    c_dst = filtered_dst - filtered_dst.mean(axis=0)
    _, s_dst, _ = np.linalg.svd(c_dst)
    if s_dst[0] < 1e-5 or (s_dst[1] / s_dst[0]) < 1e-3:
        raise GeometricDegeneracyError(
            f"Control points are collinear or 1D-degenerate (singular value ratio {s_dst[1]/max(s_dst[0], 1e-9):.2e} < 1e-3)."
        )

    c_src = filtered_src - filtered_src.mean(axis=0)
    _, s_src, _ = np.linalg.svd(c_src)
    if s_src[0] < 1e-5 or (s_src[1] / s_src[0]) < 1e-3:
        raise GeometricDegeneracyError(
            f"Source points are collinear or 1D-degenerate (singular value ratio {s_src[1]/max(s_src[0], 1e-9):.2e} < 1e-3)."
        )

    # 3. Check coordinate matrix rank
    A_dst = np.hstack([np.ones((len(filtered_dst), 1)), filtered_dst])
    if np.linalg.matrix_rank(A_dst) < 3:
        raise GeometricDegeneracyError("Target coordinate design matrix [1, x, y] has rank < 3.")

    A_src = np.hstack([np.ones((len(filtered_src), 1)), filtered_src])
    if np.linalg.matrix_rank(A_src) < 3:
        raise GeometricDegeneracyError("Source coordinate design matrix [1, x, y] has rank < 3.")

    # 4. Check convex hull area
    try:
        hull_dst = ConvexHull(filtered_dst)
        area_dst = hull_dst.volume  # In 2D, hull.volume is the polygon area
        if area_dst < min_convex_area:
            raise GeometricDegeneracyError(
                f"Target convex hull area ({area_dst:.1f} px^2) is below minimum threshold ({min_convex_area} px^2)."
            )

        hull_src = ConvexHull(filtered_src)
        area_src = hull_src.volume
        if area_src < min_convex_area:
            raise GeometricDegeneracyError(
                f"Source convex hull area ({area_src:.1f} px^2) is below minimum threshold ({min_convex_area} px^2)."
            )
    except Exception as exc:
        if isinstance(exc, GeometricDegeneracyError):
            raise
        raise GeometricDegeneracyError(f"Convex hull computation failed on GCPs: {exc}") from exc

    return filtered_src, filtered_dst


class ThinPlateSpline:
    """Thin-Plate Spline non-rigid 2D transformation."""

    def __init__(
        self,
        src_pts: np.ndarray,
        dst_pts: np.ndarray,
        smoothing: float = 0.0,
        validate: bool = True,
    ):
        """Fit TPS mapping between reference (dst_pts) and moving (src_pts) coordinates."""
        if validate:
            self.src_pts, self.dst_pts = validate_and_filter_tps_points(src_pts, dst_pts)
        else:
            self.src_pts = src_pts.astype(np.float64)
            self.dst_pts = dst_pts.astype(np.float64)

        # Backward RBF interpolator maps reference (x,y) -> source (x,y) for backward image warping
        self.rbf_bwd = self._fit_rbf(self.dst_pts, self.src_pts, smoothing)
        # Forward RBF interpolator maps source (x,y) -> reference (x,y) for forward point evaluation
        self.rbf_fwd = self._fit_rbf(self.src_pts, self.dst_pts, smoothing)

    def _fit_rbf(self, x: np.ndarray, y: np.ndarray, smoothing: float) -> RBFInterpolator:
        try:
            return RBFInterpolator(x, y, kernel="thin_plate_spline", smoothing=smoothing)
        except np.linalg.LinAlgError as exc:
            # Retry with small smoothing regularization if exact solve is singular
            alt_smoothing = max(1e-3, smoothing * 10.0 if smoothing > 0 else 1e-3)
            _log.warning(f"TPS singular matrix with smoothing={smoothing}. Retrying with smoothing={alt_smoothing}")
            try:
                return RBFInterpolator(x, y, kernel="thin_plate_spline", smoothing=alt_smoothing)
            except Exception as e2:
                raise GeometricDegeneracyError(f"TPS fitting failed due to singular matrix: {e2}") from e2

    def transform_points(self, pts: np.ndarray) -> np.ndarray:
        """Map source coordinates to reference coordinates (forward evaluation)."""
        return self.rbf_fwd(pts.astype(np.float64)).astype(np.float32)

    def transform_target_to_source(self, pts: np.ndarray) -> np.ndarray:
        """Map target coordinates to source coordinates (backward warp lookup)."""
        return self.rbf_bwd(pts.astype(np.float64)).astype(np.float32)

    def warp_image(
        self,
        img: np.ndarray,
        output_shape: tuple[int, int] | None = None,
        grid_step: int = 4,
    ) -> np.ndarray:
        """Backward warp img onto output_shape using thin-plate spline interpolation."""
        h, w = output_shape if output_shape is not None else img.shape[:2]

        sample_ys = np.arange(0, h, grid_step, dtype=np.float32)
        sample_xs = np.arange(0, w, grid_step, dtype=np.float32)
        grid_x, grid_y = np.meshgrid(sample_xs, sample_ys)
        grid_pts = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)

        src_coords = self.transform_target_to_source(grid_pts)
        map_x_coarse = src_coords[:, 0].reshape(len(sample_ys), len(sample_xs)).astype(np.float32)
        map_y_coarse = src_coords[:, 1].reshape(len(sample_ys), len(sample_xs)).astype(np.float32)

        # Upscale remap coordinates to full resolution
        map_x = cv2.resize(map_x_coarse, (w, h), interpolation=cv2.INTER_CUBIC)
        map_y = cv2.resize(map_y_coarse, (w, h), interpolation=cv2.INTER_CUBIC)

        warped = cv2.remap(
            img,
            map_x,
            map_y,
            interpolation=cv2.INTER_LANCZOS4 if img.dtype == np.uint8 else cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=0,
        )
        return warped


def warp_tps(
    img: np.ndarray,
    src_pts: np.ndarray,
    dst_pts: np.ndarray,
    output_shape: tuple[int, int] | None = None,
    smoothing: float = 0.0,
) -> np.ndarray:
    """Convenience wrapper for TPS image warping."""
    tps = ThinPlateSpline(src_pts, dst_pts, smoothing=smoothing)
    return tps.warp_image(img, output_shape)

