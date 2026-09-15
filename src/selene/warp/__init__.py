"""Warp package: non-rigid geometric transformations (TPS, Piecewise-Affine), sub-pixel LK refinement, and GeoTIFF exporter.

Owner: P3/P4
"""
from .tps import ThinPlateSpline, warp_tps, GeometricDegeneracyError, validate_and_filter_tps_points
from .piecewise_affine import PiecewiseAffineTransform, piecewise_affine_warp
from .subpixel_lk import refine_subpixel_lk, refine_subpixel_ecc, refine_subpixel_cascade
from .model_fit import fit_final_transformation, HomographyTransform, RegistrationFailureError
from .export_geotiff import export_geotiff

__all__ = [
    "ThinPlateSpline",
    "warp_tps",
    "GeometricDegeneracyError",
    "validate_and_filter_tps_points",
    "PiecewiseAffineTransform",
    "piecewise_affine_warp",
    "refine_subpixel_lk",
    "refine_subpixel_ecc",
    "refine_subpixel_cascade",
    "fit_final_transformation",
    "HomographyTransform",
    "RegistrationFailureError",
    "export_geotiff",
]

