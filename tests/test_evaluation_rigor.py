"""Unit tests for scientific evaluation rigor, 80/20 train/val split, and reference GSD scaling."""
from __future__ import annotations

import numpy as np
import pytest

from selene.eval.metrics import compute_metrics, MetricsResult
from selene.warp.model_fit import HomographyTransform
from selene.eval.uniformity import nni_score, grid_coverage


def test_independent_validation_evaluation():
    """Metrics must evaluate final transform model strictly on holdout validation points."""
    # Source points (train + val)
    pts_train_src = np.array([[10, 10], [50, 10], [10, 50], [50, 50]], dtype=np.float32)
    # Target shift: +5px in x, +10px in y
    pts_train_dst = pts_train_src + np.array([5.0, 10.0], dtype=np.float32)

    # Validation holdout points with a known intentional displacement: +7px in x, +10px in y (2px extra in x)
    pts_val_src = np.array([[20, 20], [40, 40]], dtype=np.float32)
    pts_val_dst = pts_val_src + np.array([7.0, 10.0], dtype=np.float32)

    # True model fits the training set exactly (+5, +10)
    H_perfect = np.array([
        [1.0, 0.0, 5.0],
        [0.0, 1.0, 10.0],
        [0.0, 0.0, 1.0],
    ], dtype=np.float64)
    model = HomographyTransform(H_perfect)

    res = compute_metrics(
        pts_train_src=pts_train_src,
        pts_train_dst=pts_train_dst,
        pts_src_val=pts_val_src,
        pts_dst_val=pts_val_dst,
        ref_gsd_m=0.50,
        transform_model=model,
    )

    # Training RMSE should be 0.0
    assert abs(res.train_rmse_px) < 1e-3
    assert abs(res.train_rmse_m) < 1e-3

    # Validation holdout RMSE should be exactly 2.0 px (or 1.0 m with 0.5m GSD)
    assert res.validation_rmse_px is not None
    assert abs(res.validation_rmse_px - 2.0) < 1e-3
    assert abs(res.validation_rmse_m - 1.0) < 1e-3


def test_reference_gsd_conversion():
    """Pixel residuals multiplied by reference GSD should yield metric error."""
    pts_train_src = np.array([[0, 0], [100, 0], [0, 100], [100, 100]], dtype=np.float32)
    # 4.0 pixel residual in reference canvas
    pts_train_dst = pts_train_src + np.array([4.0, 0.0], dtype=np.float32)

    # Identity transform (no translation) -> residual is 4.0 px
    H_ident = np.eye(3, dtype=np.float64)
    model = HomographyTransform(H_ident)

    ref_gsd = 0.25  # 0.25 m/px
    res = compute_metrics(
        pts_train_src=pts_train_src,
        pts_train_dst=pts_train_dst,
        ref_gsd_m=ref_gsd,
        transform_model=model,
    )

    assert abs(res.train_rmse_px - 4.0) < 1e-3
    assert abs(res.train_rmse_m - (4.0 * ref_gsd)) < 1e-3


def test_ce90_accuracy():
    """CE90 should represent 90th percentile circular residual."""
    # 10 points with known residuals: 9 points with 1.0px residual, 1 outlier with 10.0px
    pts_src = np.zeros((10, 2), dtype=np.float32)
    pts_dst = np.zeros((10, 2), dtype=np.float32)
    pts_dst[:9, 0] = 1.0
    pts_dst[9, 0] = 10.0

    H_ident = np.eye(3, dtype=np.float64)
    model = HomographyTransform(H_ident)

    res = compute_metrics(
        pts_train_src=pts_src,
        pts_train_dst=pts_dst,
        ref_gsd_m=1.0,
        transform_model=model,
    )

    # 90th percentile should be between 1.0 and 10.0, close to 1.9
    assert res.train_ce90_px >= 1.0
    assert res.train_ce90_px < 10.0


def test_uniformity_nni_and_coverage():
    """NNI and grid coverage must be within valid mathematical bounds."""
    np.random.seed(42)
    # Randomly distribute 50 points over 1000x1000 canvas
    pts = np.random.uniform(50, 950, (50, 2)).astype(np.float32)

    nni = nni_score(pts, area_shape=(1000, 1000))
    assert 0.0 < nni < 3.0  # Plausible NNI range

    cov = grid_coverage(pts, image_shape=(1000, 1000), grid_cells=8)
    assert 0.0 < cov <= 1.0
