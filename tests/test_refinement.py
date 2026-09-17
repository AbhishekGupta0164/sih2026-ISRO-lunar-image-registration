"""Unit tests for subpixel IC-LK Lucas-Kanade and ECC refinement cascade."""
from __future__ import annotations

import numpy as np
import cv2
import pytest

from selene.warp.subpixel_lk import refine_subpixel_lk, refine_subpixel_cascade


def test_ic_lk_convergence_on_subpixel_shift():
    """IC-LK should accurately converge on known sub-pixel shifts."""
    # Synthetic image with Gaussian texture (impact craters)
    h, w = 128, 128
    np.random.seed(42)
    img_ref = cv2.GaussianBlur(np.random.rand(h, w).astype(np.float32), (5, 5), 1.5)

    # Shift by known sub-pixel displacement (dx=0.35, dy=-0.42)
    true_dx, true_dy = 0.35, -0.42
    M = np.array([[1.0, 0.0, true_dx], [0.0, 1.0, true_dy]], dtype=np.float32)
    img_mov = cv2.warpAffine(img_ref, M, (w, h), flags=cv2.INTER_LINEAR)

    # Sample query points in the center
    pts_ref = np.array([[50.0, 50.0], [70.0, 70.0], [60.0, 80.0]], dtype=np.float32)
    # Start mov points with integer approximation (50, 50)
    pts_mov_init = pts_ref.copy()

    refined, valid = refine_subpixel_lk(
        img_ref=img_ref,
        img_mov=img_mov,
        pts_ref=pts_ref,
        pts_mov=pts_mov_init,
        patch_size=21,
        max_iters=30,
        eps=0.01,
    )

    assert np.all(valid)
    # Refined points on moving image should be close to pts_ref + [true_dx, true_dy]
    expected = pts_ref + np.array([true_dx, true_dy], dtype=np.float32)
    np.testing.assert_allclose(refined, expected, atol=0.15)


def test_cascade_ecc_fallback_on_noise():
    """When IC-LK struggles or condition is marginal, cascade falls back to ECC or rejects safely."""
    h, w = 64, 64
    img_ref = np.ones((h, w), dtype=np.float32) * 0.5
    img_mov = np.ones((h, w), dtype=np.float32) * 0.5

    # Flat patch has zero gradients -> should be rejected by IC-LK and ECC
    pts = np.array([[32.0, 32.0]], dtype=np.float32)
    refined, valid, methods = refine_subpixel_cascade(
        img_ref=img_ref,
        img_mov=img_mov,
        pts_ref=pts,
        pts_mov=pts,
        patch_size=15,
    )
    assert not valid[0]
    assert methods[0] == "rejected"
