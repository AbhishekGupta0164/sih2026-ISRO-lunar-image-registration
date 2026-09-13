"""Thin-plate-spline residual warp — default final geometric model when >=12 well-spread GCPs are available.

Owner: P3/P4
"""
from __future__ import annotations

import logging
import numpy as np
from scipy.interpolate import RBFInterpolator
import cv2

_log = logging.getLogger("selene.warp.tps")


def _remove_duplicate_points(pts: np.ndarray, tolerance: float = 1e-3) -> np.ndarray:
    """Remove duplicate or near-duplicate points from a point set.
    
    Args:
        pts: (N, 2) array of points
        tolerance: Minimum spatial separation between points
        
    Returns:
        Array of unique points with indices
    """
    if len(pts) == 0:
        return pts
    
    # Round to tolerance and find unique rows
    rounded = np.round(pts / tolerance) * tolerance
    _, unique_indices = np.unique(rounded, axis=0, return_index=True)
    unique_indices = np.sort(unique_indices)
    return pts[unique_indices]


def _check_point_geometry(pts: np.ndarray) -> dict:
    """Check geometric properties of control points for TPS stability.
    
    Args:
        pts: (N, 2) array of points
        
    Returns:
        Dictionary with geometry diagnostics
    """
    if len(pts) < 3:
        return {
            "valid": False,
            "reason": "insufficient_points",
            "n_points": len(pts),
            "collinear": None,
            "convex_hull_area": 0.0,
        }
    
    # Check for collinearity using SVD
    centered = pts - pts.mean(axis=0)
    _, s, _ = np.linalg.svd(centered)
    rank_deficient = s[-1] < 1e-6 * s[0] if len(s) > 1 else False
    
    # Compute convex hull area
    from scipy.spatial import ConvexHull
    try:
        hull = ConvexHull(pts)
        hull_area = float(hull.volume)  # In 2D, volume is area
    except Exception:
        hull_area = 0.0
    
    return {
        "valid": not rank_deficient and hull_area > 100.0,
        "reason": None if not rank_deficient else "collinear",
        "n_points": len(pts),
        "collinear": rank_deficient,
        "convex_hull_area": hull_area,
    }


class ThinPlateSpline:
    """Thin-Plate Spline non-rigid 2D transformation."""

    def __init__(self, src_pts: np.ndarray, dst_pts: np.ndarray, smoothing: float = 0.0):
        """Fit TPS mapping from dst_pts (reference coordinates) to src_pts (source coordinates) for backward warping.
        
        Args:
            src_pts: (N, 2) source coordinates
            dst_pts: (N, 2) destination/reference coordinates
            smoothing: Regularization parameter (0 = exact interpolation)
            
        Raises:
            ValueError: If points are degenerate (collinear, duplicates, insufficient spread)
        """
        # Remove duplicates first
        unique_mask = np.ones(len(dst_pts), dtype=bool)
        if len(dst_pts) > 1:
            rounded_dst = np.round(dst_pts / 1e-3) * 1e-3
            _, unique_indices = np.unique(rounded_dst, axis=0, return_index=True)
            unique_mask = np.zeros(len(dst_pts), dtype=bool)
            unique_mask[unique_indices] = True
        
        self.dst_pts = dst_pts[unique_mask].astype(np.float64)
        self.src_pts = src_pts[unique_mask].astype(np.float64)
        
        # Check geometry
        geom = _check_point_geometry(self.dst_pts)
        if not geom["valid"]:
            raise ValueError(f"TPS control points are degenerate: {geom['reason']}, n={geom['n_points']}, hull_area={geom['convex_hull_area']:.1f}")
        
        # Try with small smoothing if scientifically justified for numerical stability
        try:
            self.rbf = RBFInterpolator(
                self.dst_pts,
                self.src_pts,
                kernel="thin_plate_spline",
                smoothing=smoothing,
            )
        except np.linalg.LinAlgError as e:
            # Try with increased smoothing for stability
            _log.warning(f"TPS failed with smoothing={smoothing}, trying smoothing=0.01: {e}")
            try:
                self.rbf = RBFInterpolator(
                    self.dst_pts,
                    self.src_pts,
                    kernel="thin_plate_spline",
                    smoothing=0.01,
                )
            except np.linalg.LinAlgError as e2:
                raise ValueError(f"TPS singular matrix even with smoothing: {e2}") from e2

    def transform_points(self, pts: np.ndarray) -> np.ndarray:
        """Map target coordinates to source coordinates."""
        return self.rbf(pts.astype(np.float64)).astype(np.float32)

    def warp_image(
        self,
        img: np.ndarray,
        output_shape: tuple[int, int] | None = None,
        grid_step: int = 4,
    ) -> np.ndarray:
        """Backward warp img onto output_shape using thin-plate spline interpolation."""
        h, w = output_shape if output_shape is not None else img.shape[:2]

        # Fast approximate grid sampling + linear remap to avoid calculating millions of RBFs
        sample_ys = np.arange(0, h, grid_step, dtype=np.float32)
        sample_xs = np.arange(0, w, grid_step, dtype=np.float32)
        grid_x, grid_y = np.meshgrid(sample_xs, sample_ys)
        grid_pts = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)

        src_coords = self.transform_points(grid_pts)
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
) -> np.ndarray:
    """Convenience wrapper for TPS image warping.
    
    Returns:
        Warped image, or None if TPS fails due to degenerate points.
    """
    try:
        tps = ThinPlateSpline(src_pts, dst_pts)
        return tps.warp_image(img, output_shape)
    except (ValueError, np.linalg.LinAlgError) as e:
        _log.warning(f"TPS warp failed: {e}")
        return None
