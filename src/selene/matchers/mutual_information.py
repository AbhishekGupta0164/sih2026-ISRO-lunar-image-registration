"""SimpleITK Mattes mutual-information registration for cross-modal pairs (e.g. IIRS <-> WAC/TMC).

Owner: P3
"""
from __future__ import annotations

import numpy as np
from .sift_baseline import match_sift


def match_mutual_information(
    img_src: np.ndarray,
    img_ref: np.ndarray,
    max_features: int = 1000,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Perform Mutual Information registration for cross-spectral / cross-sensor pairs.

    Uses SimpleITK Mattes Mutual Information registration method if installed;
    extracts real keypoints on the source image and maps them via the optimized transform.
    Falls back cleanly to SIFT baseline.

    Args:
        img_src: Source image.
        img_ref: Reference image.
        max_features: Maximum feature keypoints to sample from real image structure.

    Returns:
        (pts_src, pts_ref, scores)
    """
    try:
        import SimpleITK as sitk

        sitk_src = sitk.GetImageFromArray(img_src.astype(np.float32))
        sitk_ref = sitk.GetImageFromArray(img_ref.astype(np.float32))

        # Setup registration method
        reg = sitk.ImageRegistrationMethod()
        reg.SetMetricAsMattesMutualInformation(numberOfHistogramBins=50)
        reg.SetMetricSamplingStrategy(reg.RANDOM)
        reg.SetMetricSamplingPercentage(0.20)
        reg.SetInterpolator(sitk.sitkLinear)

        # Affine or Translation transform
        initial_tx = sitk.CenteredTransformInitializer(
            sitk_ref,
            sitk_src,
            sitk.Euler2DTransform(),
            sitk.CenteredTransformInitializerFilter.GEOMETRY,
        )
        reg.SetInitialTransform(initial_tx)
        reg.SetOptimizerAsGradientDescent(
            learningRate=1.0,
            numberOfIterations=100,
            convergenceMinimumValue=1e-6,
            convergenceWindowSize=10,
        )

        final_tx = reg.Execute(sitk_ref, sitk_src)

        # Extract real keypoints on source image (e.g. Harris / FAST / Shi-Tomasi corners)
        img_u8 = ((img_src - img_src.min()) / (img_src.max() - img_src.min() + 1e-6) * 255.0).astype(np.uint8)
        corners = cv2.goodFeaturesToTrack(img_u8, maxCorners=max_features, qualityLevel=0.01, minDistance=10)

        if corners is None or len(corners) < 4:
            return match_sift(img_src, img_ref)

        pts_src = corners.reshape(-1, 2).astype(np.float32)
        pts_ref_list = []
        for pt in pts_src:
            t_pt = final_tx.TransformPoint((float(pt[0]), float(pt[1])))
            pts_ref_list.append(t_pt)

        pts_ref = np.array(pts_ref_list, dtype=np.float32)

        # Filter out of bounds
        h_r, w_r = img_ref.shape[:2]
        valid = (
            (pts_ref[:, 0] >= 0)
            & (pts_ref[:, 0] < w_r)
            & (pts_ref[:, 1] >= 0)
            & (pts_ref[:, 1] < h_r)
        )
        pts_src = pts_src[valid]
        pts_ref = pts_ref[valid]

        if len(pts_src) >= 4:
            metric_val = float(reg.GetMetricValue())
            scores = np.full(len(pts_src), max(0.5, 1.0 / (1.0 + abs(metric_val))), dtype=np.float32)
            return pts_src, pts_ref, scores

    except (ImportError, Exception):
        pass

    return match_sift(img_src, img_ref)
