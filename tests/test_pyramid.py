"""Tests for multi-scale GSD pyramid builder."""
import pytest
import numpy as np
from selene.geometry.pyramid import build_gsd_pyramid, match_coarse_to_fine_pyramid
from selene.ingest.pair import Pair
from selene.config import PipelineConfig


def test_gsd_pyramid_halving():
    img = np.ones((512, 512), dtype=np.float32)
    pyramid = build_gsd_pyramid(img, gsd_m=0.5, max_levels=3)

    assert len(pyramid) == 3
    # coarsest level first
    assert pyramid[0][1] == 2.0  # 0.5 * 2 * 2
    assert pyramid[0][0].shape == (128, 128)
    # native resolution last
    assert pyramid[-1][1] == 0.5
    assert pyramid[-1][0].shape == (512, 512)


def test_coarse_to_fine_pyramid_matching():
    img_ref = np.random.uniform(0, 1, (256, 256)).astype(np.float32)
    img_mov = np.random.uniform(0, 1, (128, 128)).astype(np.float32)
    pair = Pair.from_paths("ref.tif", "mov.tif",
                           ref_label={"map_scale": 0.5},
                           mov_label={"map_scale": 2.0})
    config = PipelineConfig()

    def dummy_matcher(src, ref, pair, config):
        pts_src = np.array([[10.0, 10.0], [20.0, 20.0], [30.0, 30.0], [40.0, 40.0]], dtype=np.float32)
        pts_ref = np.array([[12.0, 11.0], [22.0, 21.0], [32.0, 31.0], [42.0, 41.0]], dtype=np.float32)
        scores = np.ones(4, dtype=np.float32)
        return pts_src, pts_ref, scores, "sift"

    pts_s, pts_r, scores, matcher_name = match_coarse_to_fine_pyramid(
        img_mov, img_ref, pair, config, dummy_matcher
    )

    assert len(pts_s) == 4
    assert matcher_name.startswith("pyramid_")
    np.testing.assert_allclose(pts_s, [[10.0, 10.0], [20.0, 20.0], [30.0, 30.0], [40.0, 40.0]])
    np.testing.assert_allclose(pts_r, [[12.0, 11.0], [22.0, 21.0], [32.0, 31.0], [42.0, 41.0]])


