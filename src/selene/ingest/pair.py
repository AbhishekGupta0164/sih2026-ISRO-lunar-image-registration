"""The canonical ``Pair`` dataclass — the single frozen schema every other
stage reads.  Do not add fields without a 2-minute sync with P2/P3/P4
(see README architecture note).

Owner: P1
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from .metadata import ImageMetadata, extract_metadata

_log = logging.getLogger("selene.ingest.pair")


@dataclass(frozen=True)
class Pair:
    """Immutable descriptor for a (reference, moving) image pair.

    Every pipeline stage receives and returns a ``Pair``; it is the single
    data-contract between stages.

    Attributes:
        ref_path:  Absolute or relative path to the reference image.
        mov_path:  Absolute or relative path to the moving (source) image.
        ref_meta:  Sun-angle / GSD metadata for the reference image.
        mov_meta:  Sun-angle / GSD metadata for the moving image.
    """

    ref_path: Path
    mov_path: Path
    ref_meta: ImageMetadata = field(default_factory=ImageMetadata)
    mov_meta: ImageMetadata = field(default_factory=ImageMetadata)

    # ── Constructors ──────────────────────────────────────────────────────────

    @classmethod
    def from_paths(
        cls,
        ref: str | Path,
        mov: str | Path,
        ref_label: dict | None = None,
        mov_label: dict | None = None,
    ) -> "Pair":
        """Build a :class:`Pair` from file paths, optionally with raw PDS label dicts.

        Args:
            ref:       Path to reference image (GeoTIFF or PDS file).
            mov:       Path to moving image.
            ref_label: Optional raw PDS label dict for the reference.
            mov_label: Optional raw PDS label dict for the moving image.

        Returns:
            Frozen :class:`Pair` instance.
        """
        def _find_label(path: Path) -> dict:
            """Locate and load a metadata sidecar for *path*.

            Search order:
              1. Exact-stem JSON sidecar (e.g. reference.json, synthetic_target.json)
                 — must contain at least one of the recognised metadata keys
                   (sun_azimuth_deg, gsd_m, SOLAR_AZIMUTH, MAP_SCALE …).
                 ground_truth.json is intentionally skipped because it records
                 geometric transforms, not image metadata.
              2. PDS3 .lbl / .LBL label file via pvl
              3. PDS4 .xml label file via pvl
              4. Filename-inferred sensor + GSD for well-known instrument prefixes.
            """
            if not path.exists():
                return {}

            # --- 1. Exact-stem JSON sidecar ---------------------------------
            import json as _json
            _METADATA_KEYS = {
                "sun_azimuth_deg", "sun_az", "sun_elevation_deg", "sun_el",
                "gsd_m", "sensor_id",
                "SOLAR_AZIMUTH", "SUB_SOLAR_AZIMUTH", "SOLAR_ELEVATION",
                "MAP_SCALE", "PIXEL_SCALE", "INSTRUMENT_ID",
            }
            json_candidate = path.with_suffix(".json")
            if json_candidate.exists() and json_candidate.stem != "ground_truth":
                try:
                    with open(json_candidate) as f:
                        data = _json.load(f)
                    # Accept only if it carries at least one recognised metadata key
                    if isinstance(data, dict) and _METADATA_KEYS & set(data.keys()):
                        _log.debug(f"Loaded JSON sidecar: {json_candidate}")
                        return data
                except Exception:
                    pass

            # --- 2 & 3. PDS3 / PDS4 label files ----------------------------
            for ext in (".lbl", ".LBL", ".xml", ".XML"):
                candidate = path.with_suffix(ext)
                if candidate.exists():
                    try:
                        import pvl
                        lbl = dict(pvl.load(str(candidate)))
                        _log.debug(f"Loaded PDS label: {candidate}")
                        return lbl
                    except Exception:
                        pass

            # --- 4. Name-based heuristic inference --------------------------
            name_upper = path.name.upper()
            inferred: dict = {}
            if "OHRC" in name_upper:
                inferred["INSTRUMENT_ID"] = "OHRC"
                inferred["MAP_SCALE"] = 0.25
            elif "TMC" in name_upper:
                inferred["INSTRUMENT_ID"] = "TMC2"
                inferred["MAP_SCALE"] = 5.0
            elif "IIRS" in name_upper:
                inferred["INSTRUMENT_ID"] = "IIRS"
                inferred["MAP_SCALE"] = 80.0
            elif "NAC" in name_upper:
                inferred["INSTRUMENT_ID"] = "LRO_NAC"
                inferred["MAP_SCALE"] = 0.5
            elif "WAC" in name_upper:
                inferred["INSTRUMENT_ID"] = "LRO_WAC"
                inferred["MAP_SCALE"] = 100.0

            if inferred:
                _log.debug(f"Name-inferred metadata for {path.name}: {inferred}")
            return inferred

        ref_p = Path(ref)
        mov_p = Path(mov)

        ref_lbl_dict = ref_label if ref_label is not None else _find_label(ref_p)
        mov_lbl_dict = mov_label if mov_label is not None else _find_label(mov_p)

        ref_meta = extract_metadata(ref_lbl_dict)
        mov_meta = extract_metadata(mov_lbl_dict)

        # ── Verification log: always print real values so silent defaults are visible
        _log.info(
            f"ref_meta  | sensor={ref_meta.sensor_id!r:10s}  "
            f"az={ref_meta.sun_azimuth:6.1f}°  el={ref_meta.sun_elevation:5.1f}°  "
            f"gsd={ref_meta.gsd_m:.3f} m/px"
        )
        _log.info(
            f"mov_meta  | sensor={mov_meta.sensor_id!r:10s}  "
            f"az={mov_meta.sun_azimuth:6.1f}°  el={mov_meta.sun_elevation:5.1f}°  "
            f"gsd={mov_meta.gsd_m:.3f} m/px"
        )

        return cls(
            ref_path=ref_p,
            mov_path=mov_p,
            ref_meta=ref_meta,
            mov_meta=mov_meta,
        )

    # ── Derived properties ────────────────────────────────────────────────────

    @property
    def delta_sun_az(self) -> float:
        """Absolute sun-azimuth difference between reference and moving image (°)."""
        return abs(self.ref_meta.sun_azimuth - self.mov_meta.sun_azimuth)

    @property
    def gsd_ratio(self) -> float:
        """GSD ratio ≥ 1.0.  Large values mean very different spatial resolutions."""
        a, b = self.ref_meta.gsd_m, self.mov_meta.gsd_m
        if b == 0.0:
            return 1.0
        return max(a, b) / min(a, b)

    @property
    def is_cross_sensor(self) -> bool:
        """True when reference and moving images come from different instruments."""
        return self.ref_meta.sensor_id != self.mov_meta.sensor_id

    def __repr__(self) -> str:  # noqa: D105
        return (
            f"Pair(ref={self.ref_path.name!r}, mov={self.mov_path.name!r}, "
            f"Δaz={self.delta_sun_az:.1f}°, gsd_ratio={self.gsd_ratio:.2f})"
        )
