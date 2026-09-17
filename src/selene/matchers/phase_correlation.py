"""FFT-based phase correlation for translation priors and coarse alignment.

Owner: P3
"""
from __future__ import annotations

import numpy as np
import cv2
from skimage.registration import phase_cross_correlation
from .sift_baseline import match_sift


def match_phase_correlation(
    img_src: np.ndarray,
    img_ref: np.ndarray,
    upsample_factor: int = 10,
    max_features: int = 2000,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute translation prior via FFT Phase Cross-Correlation and extract real feature matches.

    Phase correlation estimates the global translation (dy, dx). The source image is coarsely
    shifted by this prior, and actual local feature correspondences (SIFT) are extracted
    and mapped back to native source pixel coordinates.

    NEVER generates synthetic regular grid points.

    Args:
        img_src: Source moving image.
        img_ref: Reference fixed image.
        upsample_factor: Sub-pixel FFT upsampling factor.
        max_features: Maximum SIFT features to detect on shifted image.

    Returns:
        (pts_src, pts_ref, scores)
    """
    try:
        def _to_2d(im: np.ndarray) -> np.ndarray:
            if im.ndim == 3:
                im = im.mean(axis=-1)
            return im.astype(np.float32)

        src_f = _to_2d(img_src)
        ref_f = _to_2d(img_ref)

        # Resample src_f to ref_f shape for phase correlation if shapes differ
        if src_f.shape != ref_f.shape:
            src_eval = cv2.resize(src_f, (ref_f.shape[1], ref_f.shape[0]), interpolation=cv2.INTER_LINEAR)
            scale_y = ref_f.shape[0] / src_f.shape[0]
            scale_x = ref_f.shape[1] / src_f.shape[1]
        else:
            src_eval = src_f
            scale_y = 1.0
            scale_x = 1.0

        # Calculate global shift: shift = (dy, dx) such that ref ~ src_eval shifted
        shift, error, _ = phase_cross_correlation(
            ref_f,
            src_eval,
            upsample_factor=upsample_factor,
        )
        dy_eval, dx_eval = float(shift[0]), float(shift[1])
        # Convert shift to original source coordinates
        dy = dy_eval / scale_y
        dx = dx_eval / scale_x

        # Apply translation prior: shift img_src by (dx, dy)
        h_s, w_s = src_f.shape[:2]
        M_shift = np.array([[1.0, 0.0, dx], [0.0, 1.0, dy]], dtype=np.float32)
        shifted_src = cv2.warpAffine(
            src_f,
            M_shift,
            (w_s, h_s),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT,
        )

        # Extract real feature correspondences between shifted source and reference
        pts_s_shifted, pts_r, scores = match_sift(shifted_src, ref_f, n_features=max_features)

        if len(pts_s_shifted) >= 4:
            # Map coordinates on shifted image back to native source image coordinates:
            # (x_shifted, y_shifted) = (x_src + dx, y_src + dy) => (x_src, y_src) = (x_shifted - dx, y_shifted - dy)
            pts_src = pts_s_shifted.copy()
            pts_src[:, 0] -= dx
            pts_src[:, 1] -= dy

            # Filter points that fall within valid source image boundaries
            valid = (
                (pts_src[:, 0] >= 0)
                & (pts_src[:, 0] < w_s)
                & (pts_src[:, 1] >= 0)
                & (pts_src[:, 1] < h_s)
            )
            pts_src = pts_src[valid]
            pts_ref = pts_r[valid]
            scores = scores[valid]

            if len(pts_src) >= 4:
                return pts_src.astype(np.float32), pts_ref.astype(np.float32), scores.astype(np.float32)

    except Exception:
        pass

    return match_sift(img_src, img_ref)

