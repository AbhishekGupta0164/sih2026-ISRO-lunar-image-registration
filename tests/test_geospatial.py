"""Unit tests for geospatial consistency, GeoTIFF export, and reference cropping."""
from __future__ import annotations

from pathlib import Path
import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")
from rasterio.transform import from_origin

from selene.warp.export_geotiff import export_geotiff
from selene.geometry.mapproject_tier2 import crop_reference_to_pair


def test_geotiff_export_roundtrip(tmp_path: Path):
    """Exported GeoTIFF must preserve shape, CRS, and affine transform."""
    out_file = tmp_path / "test_out.tif"
    data = (np.random.rand(64, 64) * 255).astype(np.float32)
    transform = from_origin(1000.0, 2000.0, 0.5, 0.5)
    crs = "EPSG:32643"

    export_geotiff(
        img_array=data,
        out_path=out_file,
        crs=crs,
        transform=transform,
    )

    assert out_file.exists()
    with rasterio.open(out_file) as src:
        assert src.shape == (64, 64)
        assert src.crs is not None
        assert src.transform == transform
        read_data = src.read(1)
        np.testing.assert_allclose(read_data, data, atol=1e-3)


def test_crop_reference_to_pair_affine_update():
    """Cropping reference image to footprint must adjust transform translation."""
    img = np.zeros((100, 100), dtype=np.float32)
    orig_transform = from_origin(0.0, 100.0, 1.0, 1.0)

    # Footprint covering x: 20 to 60, y: 30 to 70
    footprint_wkt = "POLYGON ((20 30, 60 30, 60 70, 20 70, 20 30))"

    cropped, new_transform, bounds = crop_reference_to_pair(img, orig_transform, footprint_wkt)
    assert cropped.shape[0] < 100
    assert cropped.shape[1] < 100
    assert new_transform != orig_transform
