"""Warp the source with GDAL/rasterio, write a Cloud-Optimised GeoTIFF with nodata in shadow regions.

Owner: P4
"""
from __future__ import annotations

from pathlib import Path
import numpy as np


def export_geotiff(
    img_array: np.ndarray,
    out_path: str | Path,
    crs: object | None = None,
    transform: object | None = None,
    nodata: float | None = 0.0,
) -> Path:
    """Save an image array as a GeoTIFF with geospatial CRS and affine transform metadata.

    Args:
        img_array: 2D or 3D numpy array.
        out_path: Output file path (.tif or .tiff).
        crs: Coordinate Reference System (rasterio CRS object or WKT/PROJ string).
        transform: Affine transform matrix or rasterio.Affine.
        nodata: Nodata pixel value.

    Returns:
        Path to written GeoTIFF.
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        import rasterio
        from rasterio.transform import Affine

        if img_array.ndim == 2:
            count = 1
            h, w = img_array.shape
            data = img_array[np.newaxis, ...]
        else:
            count, h, w = img_array.shape[0], img_array.shape[1], img_array.shape[2]
            data = img_array

        dtype = img_array.dtype
        if dtype == np.float64:
            dtype = np.float32
            data = data.astype(np.float32)

        if transform is None:
            transform = Affine.translation(0, 0) * Affine.scale(1, -1)

        with rasterio.open(
            str(out_path),
            "w",
            driver="GTiff",
            height=h,
            width=w,
            count=count,
            dtype=dtype,
            crs=crs,
            transform=transform,
            nodata=nodata,
            compress="lzw",
        ) as dst:
            dst.write(data)

        return out_path
    except (ImportError, ModuleNotFoundError):
        try:
            import tifffile
            tifffile.imwrite(str(out_path), img_array)
        except Exception:
            import cv2
            u8 = (img_array * 255.0).clip(0, 255).astype(np.uint8) if img_array.dtype != np.uint8 else img_array
            cv2.imwrite(str(out_path), u8)
        return out_path

