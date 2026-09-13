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
from typing import Any

# Sentinel — distinct from None so we can detect "key not found"
_MISSING = object()


@dataclass
class ImageMetadata:
    """All per-image metadata needed by every downstream stage."""

    sun_azimuth: float = 90.0       # degrees, clockwise from North
    sun_elevation: float = 45.0     # degrees above horizon
    gsd_m: float = 5.0              # ground sampling distance (metres / pixel)
    sensor_id: str = "UNKNOWN"      # e.g. "OHRC", "TMC2", "LRO_NAC", "IIRS"
    footprint_wkt: str = ""         # WKT POLYGON of image footprint (lon/lat)
    incidence_angle: float = 45.0   # solar incidence angle (degrees from nadir)


def extract_metadata(label: dict[str, Any], strict: bool = False) -> ImageMetadata:
    """Extract sun geometry, GSD and sensor from a PDS or JSON sidecar label dict.

    Handles PVL ``Quantity`` objects (which carry a ``.value`` attribute),
    plain Python scalars, and JSON sidecar keys produced by the synthetic
    data generator (e.g. ``sun_azimuth_deg``).

    Args:
        label:  Raw label dict — from ``pvl.load()``, ``json.load()``, or
                a manually-constructed dict with injected PDS keys.
        strict: When True, raise :exc:`KeyError` if sun azimuth or GSD
                cannot be resolved.  Use this for real PDS files where
                silent defaults would corrupt the gate routing decision.
                When False (default), falls back to 90° / 45° / 5 m to
                keep the pipeline runnable on incomplete labels.

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

    # ── Sun azimuth ───────────────────────────────────────────────────────────
    # JSON sidecar: sun_azimuth_deg | PDS3: SOLAR_AZIMUTH | PDS4: solar_azimuth
    sun_az_raw = _get("sun_azimuth_deg", "sun_az", "SOLAR_AZIMUTH", "SUB_SOLAR_AZIMUTH",
                      "solar_azimuth", "sub_solar_azimuth")
    if sun_az_raw is _MISSING:
        if strict:
            raise KeyError(
                "Sun azimuth not found in label. "
                "Searched: sun_azimuth_deg, sun_az, SOLAR_AZIMUTH, SUB_SOLAR_AZIMUTH"
            )
        sun_az_raw = 90.0
    sun_az = float(sun_az_raw)

    # ── Sun elevation ─────────────────────────────────────────────────────────
    # JSON sidecar: sun_elevation_deg | PDS3: SOLAR_ELEVATION | PDS4: solar_elevation
    sun_el_raw = _get("sun_elevation_deg", "sun_el", "SOLAR_ELEVATION", "SUB_SOLAR_ELEVATION",
                      "solar_elevation", "sub_solar_elevation")
    if sun_el_raw is _MISSING:
        if strict:
            raise KeyError(
                "Sun elevation not found in label. "
                "Searched: sun_elevation_deg, sun_el, SOLAR_ELEVATION, SUB_SOLAR_ELEVATION"
            )
        sun_el_raw = 45.0
    sun_el = float(sun_el_raw)

    incidence_raw = _get("incidence_angle", "INCIDENCE_ANGLE")
    incidence = float(incidence_raw) if incidence_raw is not _MISSING else round(90.0 - sun_el, 2)

    # ── Ground sampling distance ───────────────────────────────────────────────
    # JSON sidecar: gsd_m | PDS3: MAP_SCALE / PIXEL_SCALE | PDS4: map_scale
    gsd_raw = _get("gsd_m", "MAP_SCALE", "PIXEL_SCALE", "IMAGE_SCALE", "map_scale", "pixel_scale")
    if gsd_raw is _MISSING:
        if strict:
            raise KeyError(
                "GSD not found in label. "
                "Searched: gsd_m, MAP_SCALE, PIXEL_SCALE, IMAGE_SCALE"
            )
        gsd_raw = 5.0
    gsd = float(gsd_raw)
    if gsd > 1000:          # value was in km/px — convert to m/px
        gsd *= 1_000.0

    # ── Sensor identifier ──────────────────────────────────────────────────────
    # JSON sidecar: sensor_id | PDS3: INSTRUMENT_ID | PDS4: instrument_id
    sensor_raw = _get("sensor_id", "INSTRUMENT_ID", "SENSOR_ID", "instrument_id")
    if sensor_raw is _MISSING:
        sensor_raw = "UNKNOWN"
    sensor = str(sensor_raw).strip().strip('"').strip("'")

    # ── Footprint (best-effort; many labels lack this) ─────────────────────────
    footprint_raw = _get("FOOTPRINT_GEOMETRY", "FOOTPRINT_POINT_LATITUDE",
                         "footprint_geometry", "footprint_wkt")
    footprint = str(footprint_raw) if footprint_raw is not _MISSING else ""

    return ImageMetadata(
        sun_azimuth=sun_az,
        sun_elevation=sun_el,
        gsd_m=gsd,
        sensor_id=sensor,
        footprint_wkt=footprint,
        incidence_angle=incidence,
    )
