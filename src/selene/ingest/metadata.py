"""Extract sun azimuth/elevation, incidence angle, footprint polygon,
instrument id from PDS labels or JSON sidecars.

Key resolution order for each field:
  1. JSON sidecar keys  (sun_azimuth_deg / sun_elevation_deg / gsd_m / sensor_id)
  2. PDS3 keys          (SOLAR_AZIMUTH / SUB_SOLAR_AZIMUTH / MAP_SCALE / INSTRUMENT_ID)
  3. PDS4 keys          (solar_azimuth / sub_solar_azimuth / map_scale / instrument_id)
  4. Hard fallback      (only when strict=False)

Owner: P1
"""
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import dataclass
from typing import Any

# Sentinel — distinct from None so we can detect "key not found"
_MISSING = object()


class MetadataError(ValueError):
    """Raised when critical scientific metadata is missing or invalid."""
    pass


@dataclass
class ImageMetadata:
    """All per-image metadata needed by every downstream stage."""

    sun_azimuth: float = 90.0       # degrees, clockwise from North
    sun_elevation: float = 45.0     # degrees above horizon
    gsd_m: float = 5.0              # ground sampling distance (metres / pixel)
    sensor_id: str = "UNKNOWN"      # e.g. "OHRC", "TMC2", "LRO_NAC", "IIRS"
    footprint_wkt: str = ""         # WKT POLYGON of image footprint (lon/lat)
    incidence_angle: float = 45.0   # solar incidence angle (degrees from nadir)
    is_inferred: bool = False       # True if deduced from filename or fallback defaults
    metadata_source: str = "authoritative"  # e.g. "json_sidecar", "pds_label", "filename_inferred", "approximate_default"
    has_gsd: bool = True
    has_sun_azimuth: bool = True


def extract_metadata(
    label: dict[str, Any],
    strict: bool = False,
    allow_approximate_fallback: bool = False,
) -> ImageMetadata:
    """Extract sun geometry, GSD and sensor from a PDS or JSON sidecar label dict.

    Handles PVL ``Quantity`` objects (which carry a ``.value`` attribute),
    plain Python scalars, and JSON sidecar keys produced by the synthetic
    data generator (e.g. ``sun_azimuth_deg``).

    Args:
        label: Raw label dict — from ``pvl.load()``, ``json.load()``, or
               a manually-constructed dict with injected PDS keys.
        strict: When True, raise :exc:`MetadataError` if sun azimuth or GSD
                cannot be resolved. Use this for real PDS files where
                silent defaults would corrupt the gate routing decision.
        allow_approximate_fallback: If True and metadata is missing, allow
                demo/approximate defaults but flag is_inferred=True and
                metadata_source="approximate_default".

    Returns:
        Populated :class:`ImageMetadata`.
    """

    def _get(*keys: str) -> Any:
        """Try each key (and its upper/lower variants) in order; return sentinel if none match."""
        for key in keys:
            for k in (key, key.upper(), key.lower()):
                v = label.get(k)
                if v is not None:
                    return v.value if hasattr(v, "value") else v
        return _MISSING

    is_inferred = bool(label.get("_is_inferred", False))
    metadata_source = label.get("_metadata_source", "authoritative" if not is_inferred else "filename_inferred")

    # ── Sun azimuth ───────────────────────────────────────────────────────────
    # JSON sidecar: sun_azimuth_deg | PDS3: SOLAR_AZIMUTH | PDS4: solar_azimuth
    sun_az_raw = _get(
        "sun_azimuth_deg", "sun_az", "SOLAR_AZIMUTH", "SUB_SOLAR_AZIMUTH",
        "solar_azimuth", "sub_solar_azimuth"
    )
    has_sun_az = sun_az_raw is not _MISSING
    if not has_sun_az:
        if strict or not allow_approximate_fallback:
            raise MetadataError(
                "Sun azimuth not found in metadata label. "
                "Searched: sun_azimuth_deg, sun_az, SOLAR_AZIMUTH, SUB_SOLAR_AZIMUTH, solar_azimuth. "
                "Explicit sun angle is required for scientific illumination routing."
            )
        sun_az_raw = 90.0
        is_inferred = True
        metadata_source = "approximate_default"
    sun_az = float(sun_az_raw)

    # ── Sun elevation ─────────────────────────────────────────────────────────
    # JSON sidecar: sun_elevation_deg | PDS3: SOLAR_ELEVATION | PDS4: solar_elevation
    sun_el_raw = _get(
        "sun_elevation_deg", "sun_el", "SOLAR_ELEVATION", "SUB_SOLAR_ELEVATION",
        "solar_elevation", "sub_solar_elevation"
    )
    if sun_el_raw is _MISSING:
        if strict or not allow_approximate_fallback:
            raise MetadataError(
                "Sun elevation not found in metadata label. "
                "Searched: sun_elevation_deg, sun_el, SOLAR_ELEVATION, SUB_SOLAR_ELEVATION"
            )
        sun_el_raw = 45.0
        is_inferred = True
        if metadata_source == "authoritative":
            metadata_source = "approximate_default"
    sun_el = float(sun_el_raw)

    incidence_raw = _get("incidence_angle", "INCIDENCE_ANGLE", "incidence_angle_deg")
    incidence = float(incidence_raw) if incidence_raw is not _MISSING else round(90.0 - sun_el, 2)

    # ── Ground sampling distance ───────────────────────────────────────────────
    # JSON sidecar: gsd_m | PDS3: MAP_SCALE / PIXEL_SCALE | PDS4: map_scale
    gsd_raw = _get("gsd_m", "MAP_SCALE", "PIXEL_SCALE", "IMAGE_SCALE", "map_scale", "pixel_scale")
    has_gsd = gsd_raw is not _MISSING
    if not has_gsd:
        if strict or not allow_approximate_fallback:
            raise MetadataError(
                "Ground Sampling Distance (GSD) not found in metadata label. "
                "Searched: gsd_m, MAP_SCALE, PIXEL_SCALE, IMAGE_SCALE, map_scale, pixel_scale. "
                "Accurate GSD is required for metric-scale registration."
            )
        gsd_raw = 5.0
        is_inferred = True
        metadata_source = "approximate_default"
    gsd = float(gsd_raw)
    if gsd > 1000:          # value was in km/px — convert to m/px
        gsd *= 1_000.0

    # ── Sensor identifier ──────────────────────────────────────────────────────
    # JSON sidecar: sensor_id | PDS3: INSTRUMENT_ID | PDS4: instrument_id
    sensor_raw = _get("sensor_id", "INSTRUMENT_ID", "SENSOR_ID", "instrument_id")
    if sensor_raw is _MISSING:
        sensor_raw = "UNKNOWN"
        if not is_inferred and allow_approximate_fallback:
            metadata_source = "approximate_default"
    sensor = str(sensor_raw).strip().strip('"').strip("'")

    # ── Footprint (best-effort; many labels lack this) ─────────────────────────
    footprint_raw = _get(
        "FOOTPRINT_GEOMETRY", "FOOTPRINT_POINT_LATITUDE",
        "footprint_geometry", "footprint_wkt"
    )
    footprint = str(footprint_raw) if footprint_raw is not _MISSING else ""

    return ImageMetadata(
        sun_azimuth=sun_az,
        sun_elevation=sun_el,
        gsd_m=gsd,
        sensor_id=sensor,
        footprint_wkt=footprint,
        incidence_angle=incidence,
        is_inferred=is_inferred,
        metadata_source=metadata_source,
        has_gsd=has_gsd,
        has_sun_azimuth=has_sun_az,
    )
