"""Unit tests for solar geometry, circular angular distance, and metadata provenance."""
from __future__ import annotations

import json
from pathlib import Path
import pytest

from selene.ingest.pair import Pair
from selene.ingest.metadata import ImageMetadata, MetadataError, extract_metadata


def test_circular_solar_azimuth_difference():
    """Circular solar azimuth must handle 360-degree wrap around correctly."""
    # 10 deg and 350 deg should have circular difference 20 deg, not 340 deg
    meta_a = ImageMetadata(sensor_id="OHRC", sun_azimuth=10.0)
    meta_b = ImageMetadata(sensor_id="OHRC", sun_azimuth=350.0)
    pair = Pair(ref_path=Path("img_a.tif"), mov_path=Path("img_b.tif"), ref_meta=meta_a, mov_meta=meta_b)
    assert abs(pair.delta_sun_az - 20.0) < 1e-4

    # 45 deg and 225 deg: exactly 180 deg
    meta_c = ImageMetadata(sensor_id="OHRC", sun_azimuth=45.0)
    meta_d = ImageMetadata(sensor_id="OHRC", sun_azimuth=225.0)
    pair2 = Pair(ref_path=Path("img_c.tif"), mov_path=Path("img_d.tif"), ref_meta=meta_c, mov_meta=meta_d)
    assert abs(pair2.delta_sun_az - 180.0) < 1e-4

    # Identical angles
    meta_e = ImageMetadata(sensor_id="OHRC", sun_azimuth=120.0)
    meta_f = ImageMetadata(sensor_id="OHRC", sun_azimuth=120.0)
    pair3 = Pair(ref_path=Path("img_e.tif"), mov_path=Path("img_f.tif"), ref_meta=meta_e, mov_meta=meta_f)
    assert abs(pair3.delta_sun_az - 0.0) < 1e-4


def test_missing_sun_azimuth_handling():
    """When solar azimuth is missing on one or both images, default fallback flags provenance."""
    meta_fallback = extract_metadata({}, strict=False, allow_approximate_fallback=True)
    assert meta_fallback.is_inferred is True
    assert meta_fallback.metadata_source == "approximate_default"
    assert meta_fallback.has_sun_azimuth is False


def test_sidecar_metadata_ingestion(tmp_path: Path):
    """Sidecar JSON files must be correctly ingested with strict provenance tracking."""
    img_path = tmp_path / "nac_01.png"
    img_path.touch()
    img_path2 = tmp_path / "nac_02.png"
    img_path2.touch()

    sidecar_path = tmp_path / "nac_01.json"
    sidecar_data = {
        "sensor_id": "LRO_NAC",
        "sun_azimuth_deg": 142.1,
        "sun_elevation_deg": 34.5,
        "gsd_m": 0.50,
    }
    with open(sidecar_path, "w") as f:
        json.dump(sidecar_data, f)

    pair = Pair.from_paths(ref=img_path, mov=img_path2)
    meta = pair.ref_meta
    assert meta.sensor_id == "LRO_NAC"
    assert abs(meta.sun_azimuth - 142.1) < 1e-3
    assert abs(meta.sun_elevation - 34.5) < 1e-3
    assert abs(meta.gsd_m - 0.50) < 1e-3
    assert meta.metadata_source == "json_sidecar"
    assert not meta.is_inferred


def test_strict_mode_validation_failure():
    """In strict mode, missing mandatory metadata raises MetadataError."""
    with pytest.raises(MetadataError):
        extract_metadata({}, strict=True)

