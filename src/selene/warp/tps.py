"""Thin-plate-spline residual warp — default final geometric model when >=12 well-spread GCPs are available.

Owner: P3/P4
"""
from __future__ import annotations

import numpy as np
from scipy.interpolate import RBFInterpolator
import cv2


class ThinPlateSpline:
    """Thin-Plate Spline non-rigid 2D transformation."""

    def __init__(self, src_pts: np.ndarray, dst_pts: np.ndarray, smoothing: float = 0.0):
        """Fit TPS mapping from dst_pts (reference coordinates) to src_pts (source coordinates) for backward warping."""
        self.dst_pts = dst_pts.astype(np.float64)
        self.src_pts = src_pts.astype(np.float64)
        # RBF interpolator maps reference (x,y) -> source (x,y)
        self.rbf = RBFInterpolator(
            self.dst_pts,
            self.src_pts,
            kernel="thin_plate_spline",
            smoothing=smoothing,
        )

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
    """Convenience wrapper for TPS image warping."""
    tps = ThinPlateSpline(src_pts, dst_pts)
    return tps.warp_image(img, output_shape)
