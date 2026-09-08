"""Classical SIFT + FLANN/BF + Lowe ratio test. Kept ONLY as 'Baseline A' for comparison.

Owner: P3
"""
from __future__ import annotations

import numpy as np
import cv2


def match_sift(
    img_src: np.ndarray,
    img_ref: np.ndarray,
    ratio_thresh: float = 0.75,
    max_features: int = 2000,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract and match SIFT keypoints with Lowe's ratio test.

    Args:
        img_src: Source image (2D uint8 or float32).
        img_ref: Reference image (2D uint8 or float32).
        ratio_thresh: Lowe's second nearest neighbor ratio threshold.
        max_features: Maximum SIFT keypoints to detect.

    Returns:
        (pts_src, pts_ref, scores) as float32 arrays.
    """
    def _to_u8(img):
        if img.dtype == np.uint8:
            return img
        norm = (img - img.min()) / (img.max() - img.min() + 1e-6)
        return (norm * 255.0).astype(np.uint8)

    src_u8 = _to_u8(img_src)
    ref_u8 = _to_u8(img_ref)

    def _run_sift(s_img, r_img, r_thresh, n_feat):
        sift = cv2.SIFT_create(nfeatures=n_feat)
        kp1, des1 = sift.detectAndCompute(s_img, None)
        kp2, des2 = sift.detectAndCompute(r_img, None)
        if des1 is None or des2 is None or len(kp1) < 2 or len(kp2) < 2:
            return [], [], []
        matcher = cv2.BFMatcher(cv2.NORM_L2)
        knn_matches = matcher.knnMatch(des1, des2, k=2)
        g_src, g_ref, sc = [], [], []
        for m_tuple in knn_matches:
            if len(m_tuple) == 2:
                m, n = m_tuple
                if m.distance < r_thresh * n.distance:
                    g_src.append(kp1[m.queryIdx].pt)
                    g_ref.append(kp2[m.trainIdx].pt)
                    sc.append(1.0 - (m.distance / (n.distance + 1e-6)))
        return g_src, g_ref, sc

    good_src, good_ref, scores = _run_sift(src_u8, ref_u8, ratio_thresh, max_features)

    # Adaptive fallback for difficult planetary contrast / illumination differences
    if len(good_src) < 4:
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        src_clahe = clahe.apply(src_u8)
        ref_clahe = clahe.apply(ref_u8)
        fallback_features = max(max_features, 5000)
        fallback_ratio = min(ratio_thresh + 0.08, 0.85)
        good_src, good_ref, scores = _run_sift(src_clahe, ref_clahe, fallback_ratio, fallback_features)

    if not good_src:
        return np.empty((0, 2), dtype=np.float32), np.empty((0, 2), dtype=np.float32), np.empty((0,), dtype=np.float32)

    return (
        np.array(good_src, dtype=np.float32),
        np.array(good_ref, dtype=np.float32),
        np.array(scores, dtype=np.float32),
    )

