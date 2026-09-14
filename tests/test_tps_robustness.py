"""Unit tests for Thin Plate Spline (TPS) robustness, degeneracy checks, and fallback cascade."""
from __future__ import annotations

import pytest
import numpy as np
import cv2

from selene.warp.tps import (
    ThinPlateSpline,
    warp_tps,
    validate_and_filter_tps_points,
    GeometricDegeneracyError,
)
from selene.warp.piecewise_affine import PiecewiseAffineTransform
from selene.warp.model_fit import fit_final_transformation, RegistrationFailureError, HomographyTransform


def test_tps_perfect_identity():
    """TPS on identical points should yield identity mapping."""
    grid = np.array([
        [100.0, 100.0], [300.0, 100.0], [500.0, 100.0],
        [100.0, 300.0], [300.0, 300.0], [500.0, 300.0],
        [100.0, 500.0], [300.0, 500.0], [500.0, 500.0],
        [200.0, 400.0], [400.0, 200.0], [250.0, 250.0],
    ], dtype=np.float32)

    tps = ThinPlateSpline(grid, grid, smoothing=0.0)
    mapped = tps.transform_points(grid)
    np.testing.assert_allclose(mapped, grid, atol=1e-2)


def test_tps_affine_mapping():
    """TPS should accurately reproduce a pure affine transformation (rotation + translation)."""
    grid = np.array([
        [100.0, 100.0], [300.0, 100.0], [500.0, 100.0],
        [100.0, 300.0], [300.0, 300.0], [500.0, 300.0],
        [100.0, 500.0], [300.0, 500.0], [500.0, 500.0],
        [200.0, 400.0], [400.0, 200.0], [250.0, 250.0],
    ], dtype=np.float32)

    theta = np.radians(12.0)
    R = np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]], dtype=np.float32)
    t = np.array([25.0, -15.0], dtype=np.float32)
    dst = (grid @ R.T) + t

    tps = ThinPlateSpline(grid, dst, smoothing=0.0)
    mapped = tps.transform_points(grid)
    np.testing.assert_allclose(mapped, dst, atol=1e-2)


def test_tps_collinear_points_detected():
    """Collinear points must be flagged with GeometricDegeneracyError."""
    x = np.linspace(50, 450, 12, dtype=np.float32)
    y = 2.0 * x + 10.0  # Perfect line
    pts = np.stack([x, y], axis=1)

    with pytest.raises(GeometricDegeneracyError):
        validate_and_filter_tps_points(pts, pts)


def test_tps_insufficient_points_error():
    """Points < 4 must raise GeometricDegeneracyError."""
    pts = np.array([[10.0, 10.0], [20.0, 30.0], [40.0, 50.0]], dtype=np.float32)
    with pytest.raises(GeometricDegeneracyError):
        validate_and_filter_tps_points(pts, pts)


def test_tps_duplicate_filtering():
    """Duplicate or near-duplicate points must be filtered without crashing."""
    pts = np.array([
        [100.0, 100.0], [100.0, 100.1],  # Near duplicates
        [300.0, 100.0], [500.0, 100.0],
        [100.0, 300.0], [300.0, 300.0], [500.0, 300.0],
        [100.0, 500.0], [500.0, 500.0],
    ], dtype=np.float32)
    clean_src, clean_dst = validate_and_filter_tps_points(pts, pts, min_dist_px=2.0)
    assert len(clean_src) == len(pts) - 1
    assert len(clean_dst) == len(pts) - 1


def test_model_fit_cascade_tps_success():
    """Good 12+ points fit TPS directly."""
    src = np.array([
        [100, 100], [250, 100], [400, 100],
        [100, 250], [250, 250], [400, 250],
        [100, 400], [250, 400], [400, 400],
        [150, 200], [350, 200], [200, 350],
    ], dtype=np.float32)
    dst = src + 15.0

    model, name, fallback = fit_final_transformation(src, dst, requested_model="tps", min_gcps_for_tps=12)
    assert name == "tps"
    assert fallback is None
    assert isinstance(model, ThinPlateSpline)


def test_model_fit_cascade_tps_to_pwa_on_few_points():
    """When points are fewer than min_gcps_for_tps, cascade gracefully falls back to piecewise_affine."""
    src = np.array([
        [100, 100], [400, 100],
        [100, 400], [400, 400],
        [250, 250], [150, 300],
    ], dtype=np.float32)
    dst = src + 10.0

    model, name, fallback = fit_final_transformation(src, dst, requested_model="tps", min_gcps_for_tps=12)
    assert name == "piecewise_affine"
    assert "falling back" in fallback.lower()
    assert isinstance(model, PiecewiseAffineTransform)


def test_model_fit_cascade_collinear_failure():
    """When points are strictly collinear on a line, all 2D models fail and RegistrationFailureError is raised."""
    src = np.array([
        [100.0, 100.0], [200.0, 100.0],
        [300.0, 100.0], [400.0, 100.0],
    ], dtype=np.float32)
    dst = src + np.array([5.0, 5.0], dtype=np.float32)

    with pytest.raises(RegistrationFailureError):
        fit_final_transformation(src, dst, requested_model="piecewise_affine")


def test_model_fit_failure_on_under_4_points():
    """RegistrationFailureError is raised when fewer than 4 points exist."""
    src = np.array([[10, 10], [20, 20], [30, 30]], dtype=np.float32)
    dst = src + 5.0
    with pytest.raises(RegistrationFailureError):
        fit_final_transformation(src, dst, requested_model="tps")
