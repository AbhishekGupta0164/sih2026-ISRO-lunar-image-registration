"""Unified transformation model fitting with robust fallback cascade.

Cascade:
1. TPS (if requested and >= min_gcps_for_tps non-degenerate points)
2. Piecewise Affine (if requested or TPS falls back, and >= 4 non-degenerate points)
3. Homography (if requested or PWA falls back, and >= 4 points)
4. RegistrationFailureError (if all models fail)

NEVER returns an unwarped image as a successful registration.
"""
from __future__ import annotations

import logging
from typing import Any
import numpy as np
import cv2

from selene.warp.tps import ThinPlateSpline, GeometricDegeneracyError
from selene.warp.piecewise_affine import PiecewiseAffineTransform

_log = logging.getLogger("selene.warp.model_fit")


class RegistrationFailureError(RuntimeError):
    """Raised when all registration transformation models fail."""
    pass


class HomographyTransform:
    """Projective 3x3 homography transformation model."""

    def __init__(self, H: np.ndarray):
        self.H = H.astype(np.float64)

    def transform_points(self, pts: np.ndarray) -> np.ndarray:
        """Map source coordinates to reference coordinates."""
        pts = np.asarray(pts, dtype=np.float32)
        if len(pts) == 0:
            return pts.copy()
        ones = np.ones((len(pts), 1), dtype=np.float32)
        homo = np.hstack([pts, ones])
        proj = (self.H @ homo.T).T
        return (proj[:, :2] / (proj[:, 2:] + 1e-8)).astype(np.float32)

    def warp_image(self, img: np.ndarray, output_shape: tuple[int, int]) -> np.ndarray:
        h, w = output_shape
        return cv2.warpPerspective(img, self.H, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=0)


def fit_final_transformation(
    pts_src: np.ndarray,
    pts_dst: np.ndarray,
    requested_model: str = "tps",
    min_gcps_for_tps: int = 12,
    output_shape: tuple[int, int] | None = None,
) -> tuple[Any, str, str | None]:
    """Fit the exact final transformation model on training GCPs with fallback cascade.

    Args:
        pts_src: Source coordinates on training set.
        pts_dst: Reference coordinates on training set.
        requested_model: 'tps', 'piecewise_affine', or 'homography'.
        min_gcps_for_tps: Minimum non-degenerate GCPs needed for TPS.
        output_shape: (height, width) of reference image canvas.

    Returns:
        (fitted_model, actual_model_name, fallback_reason)
    """
    pts_src = np.asarray(pts_src, dtype=np.float32)
    pts_dst = np.asarray(pts_dst, dtype=np.float32)
    n_pts = len(pts_src)

    if n_pts < 4:
        raise RegistrationFailureError(
            f"Registration failed: insufficient training GCPs ({n_pts} points, minimum 4 required)."
        )

    fallback_reason: str | None = None

    # --- 1. Try TPS if requested ---
    if requested_model == "tps":
        if n_pts >= min_gcps_for_tps:
            try:
                tps_model = ThinPlateSpline(pts_src, pts_dst, smoothing=0.0)
                return tps_model, "tps", None
            except (GeometricDegeneracyError, Exception) as exc:
                fallback_reason = f"TPS failed ({exc}); falling back to piecewise_affine"
                _log.warning(fallback_reason)
        else:
            fallback_reason = (
                f"Insufficient training points for TPS ({n_pts} < {min_gcps_for_tps}); "
                "falling back to piecewise_affine"
            )
            _log.info(fallback_reason)

    # --- 2. Try Piecewise Affine ---
    if requested_model in ("tps", "piecewise_affine") or fallback_reason is not None:
        try:
            pwa_model = PiecewiseAffineTransform(pts_src, pts_dst, output_shape=output_shape)
            actual_name = "piecewise_affine"
            return pwa_model, actual_name, fallback_reason
        except (GeometricDegeneracyError, Exception) as exc:
            prev_reason = f"{fallback_reason} -> " if fallback_reason else ""
            fallback_reason = f"{prev_reason}Piecewise affine failed ({exc}); falling back to homography"
            _log.warning(fallback_reason)

    # --- 3. Try Homography ---
    try:
        H, inlier_mask = cv2.findHomography(pts_src, pts_dst, cv2.RANSAC, 5.0)
        if H is not None and getattr(H, "shape", None) == (3, 3):
            det = float(np.linalg.det(H))
            if np.isfinite(det) and abs(det) > 1e-8:
                homo_model = HomographyTransform(H)
                return homo_model, "homography", fallback_reason
            else:
                prev_reason = f"{fallback_reason} -> " if fallback_reason else ""
                fallback_reason = f"{prev_reason}Homography matrix is singular (det={det:.2e})"
        else:
            prev_reason = f"{fallback_reason} -> " if fallback_reason else ""
            fallback_reason = f"{prev_reason}cv2.findHomography returned None"
    except Exception as exc:
        prev_reason = f"{fallback_reason} -> " if fallback_reason else ""
        fallback_reason = f"{prev_reason}cv2.findHomography raised error ({exc})"

    # --- 4. Total Failure Path ---
    raise RegistrationFailureError(
        f"Geometric registration failed: all transformation models (TPS, Piecewise Affine, Homography) "
        f"could not be fitted. Cause: {fallback_reason}"
    )
