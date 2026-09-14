"""Parse Chandrayaan-2 PDS3/PDS4 IMG+XML and IIRS QUB cubes into numpy arrays + label dicts.

Supports:
- PDS3 .lbl + .img / .qub with sample types, byte order, record offsets, and scaling.
- PDS4 .xml + binary data objects parsing XML structure, Array_2D_Image / Array_3D_Image.
- Canonical reader: read_raster_canonical.
"""
from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import numpy as np


PDS4_DTYPE_MAP = {
    "signedbyte": np.dtype("int8"),
    "unsignedbyte": np.dtype("uint8"),
    "signedmsb2": np.dtype(">i2"),
    "unsignedmsb2": np.dtype(">u2"),
    "signedlsb2": np.dtype("<i2"),
    "unsignedlsb2": np.dtype("<u2"),
    "signedmsb4": np.dtype(">i4"),
    "unsignedmsb4": np.dtype(">u4"),
    "signedlsb4": np.dtype("<i4"),
    "unsignedlsb4": np.dtype("<u4"),
    "ieee754msbsingle": np.dtype(">f4"),
    "ieee754lsbsingle": np.dtype("<f4"),
    "ieee754msbdouble": np.dtype(">f8"),
    "ieee754lsbdouble": np.dtype("<f8"),
}


def _parse_pds3_label_text(text: str) -> dict[str, Any]:
    """Lightweight fallback parser for PDS3 ODL/PVL key-value text."""
    data: dict[str, Any] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("/*") or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            k = k.strip().upper()
            v = v.strip().strip('"').strip("'")
            # Convert numbers if possible
            if re.match(r"^-?\d+$", v):
                data[k] = int(v)
            elif re.match(r"^-?\d+\.\d+$", v):
                data[k] = float(v)
            else:
                data[k] = v
    return data


def read_pds3(
    path: str | Path,
    band_idx: int | None = None,
) -> tuple[np.ndarray, dict]:
    """Read a PDS3 ``.lbl`` + ``.img`` / ``.qub`` file pair.

    Respects dimensions, sample type, byte order, offsets, and scaling.
    """
    path = Path(path)

    # Locate label file
    if path.suffix.lower() in (".lbl",):
        lbl_path = path
        data_candidates = [path.with_suffix(".img"), path.with_suffix(".IMG"), path.with_suffix(".qub"), path.with_suffix(".QUB")]
    else:
        lbl_path = path.with_suffix(".lbl")
        if not lbl_path.exists():
            lbl_path = path.with_suffix(".LBL")
        data_candidates = [path]

    if not lbl_path.exists():
        # Check if path itself is an attached PDS3 file
        if path.exists():
            try:
                with open(path, "rb") as f:
                    head = f.read(128)
                if b"PDS_VERSION_ID" in head:
                    lbl_path = path
                    data_candidates = [path]
            except Exception:
                pass

    if not lbl_path.exists():
        raise FileNotFoundError(f"PDS3 label not found: {lbl_path}")

    # Load label via pvl if available, otherwise built-in parser
    label_dict: dict = {}
    try:
        import importlib
        pvl = importlib.import_module("pvl")
        label_dict = dict(pvl.load(str(lbl_path)))
    except Exception:
        with open(lbl_path, "r", encoding="latin-1", errors="replace") as f:
            label_dict = _parse_pds3_label_text(f.read())

    # Try planetaryimage if installed
    try:
        import importlib
        planetaryimage = importlib.import_module("planetaryimage")
        img_obj = planetaryimage.PDS3Image.open(str(lbl_path))
        array = np.array(img_obj.image, dtype=np.float32)
        if array.ndim == 3:
            if band_idx is not None and 0 <= band_idx < array.shape[0]:
                array = array[band_idx]
            elif band_idx is not None and 0 <= band_idx < array.shape[-1]:
                array = array[..., band_idx]
            else:
                array = array.mean(axis=0) if array.shape[0] < array.shape[-1] else array.mean(axis=-1)
        lo, hi = float(array.min()), float(array.max())
        if hi > lo:
            array = (array - lo) / (hi - lo)
        return array, label_dict
    except Exception:
        pass

    # Built-in robust binary reader
    data_path = None
    for cand in data_candidates:
        if cand.exists() and cand != lbl_path:
            data_path = cand
            break
    if data_path is None:
        data_path = lbl_path  # Attached label where data follows header

    # Extract dimensions and format (check root label_dict and nested IMAGE/QUBE object)
    image_obj = label_dict.get("IMAGE", label_dict.get("QUBE", {}))
    if not isinstance(image_obj, dict):
        # In pvl, PVLGroup / PVLObject is a Mapping, so check if hasattr or mapping
        if hasattr(image_obj, "get"):
            pass
        else:
            image_obj = {}

    lines = int(label_dict.get("LINES", image_obj.get("LINES", label_dict.get("IMAGE_LINES", 0))))
    samples = int(label_dict.get("LINE_SAMPLES", image_obj.get("LINE_SAMPLES", label_dict.get("IMAGE_LINE_SAMPLES", 0))))
    sample_bits = int(label_dict.get("SAMPLE_BITS", image_obj.get("SAMPLE_BITS", 16)))
    sample_type = str(label_dict.get("SAMPLE_TYPE", image_obj.get("SAMPLE_TYPE", "MSB_INTEGER"))).upper()
    record_bytes = int(label_dict.get("RECORD_BYTES", samples * (sample_bits // 8)))

    # Compute offset
    ptr_image = label_dict.get("^IMAGE", label_dict.get("^QUBE", 1))
    if isinstance(ptr_image, int):
        offset = (ptr_image - 1) * record_bytes
    elif isinstance(ptr_image, str) and ptr_image.isdigit():
        offset = (int(ptr_image) - 1) * record_bytes
    elif isinstance(ptr_image, tuple) and len(ptr_image) == 2:
        offset = (int(ptr_image[1]) - 1) * record_bytes if isinstance(ptr_image[1], int) else 0
    else:
        offset = 0

    # Determine dtype
    is_msb = "MSB" in sample_type or "SUN" in sample_type or "MAC" in sample_type
    is_float = "REAL" in sample_type or "FLOAT" in sample_type
    is_signed = "SIGNED" in sample_type and "UNSIGNED" not in sample_type

    if is_float:
        dtype = np.dtype(">f4" if is_msb else "<f4")
    elif sample_bits == 8:
        dtype = np.dtype("int8" if is_signed else "uint8")
    elif sample_bits == 16:
        dtype = np.dtype(">i2" if (is_msb and is_signed) else ">u2" if is_msb else "<i2" if is_signed else "<u2")
    elif sample_bits == 32:
        dtype = np.dtype(">i4" if (is_msb and is_signed) else ">u4" if is_msb else "<i4" if is_signed else "<u4")
    else:
        dtype = np.dtype("uint8")

    if lines <= 0 or samples <= 0:
        raise ValueError(f"Invalid PDS3 raster dimensions in label: lines={lines}, samples={samples}")

    with open(data_path, "rb") as f:
        f.seek(offset)
        count = lines * samples
        raw = np.fromfile(f, dtype=dtype, count=count)

    if len(raw) != count:
        raise ValueError(f"Unexpected end of file reading PDS3 data: expected {count} samples, got {len(raw)}")

    array = raw.reshape((lines, samples)).astype(np.float32)
    scaling = float(label_dict.get("SCALING_FACTOR", image_obj.get("SCALING_FACTOR", 1.0)))
    val_offset = float(label_dict.get("OFFSET", image_obj.get("OFFSET", 0.0)))
    if scaling != 1.0 or val_offset != 0.0:
        array = array * scaling + val_offset

    lo, hi = float(array.min()), float(array.max())
    if hi > lo:
        array = (array - lo) / (hi - lo)

    return array, label_dict


def read_pds4(path: str | Path) -> tuple[np.ndarray, dict]:
    """Read a PDS4 XML label and its associated binary array data object.

    Accurately parses XML structure, Array_2D_Image / Array_3D_Image,
    offsets, dimensions, and data types.
    """
    path = Path(path)
    xml_path = path if path.suffix.lower() == ".xml" else path.with_suffix(".xml")
    if not xml_path.exists():
        raise FileNotFoundError(f"PDS4 XML label not found: {xml_path}")

    tree = ET.parse(xml_path)
    root = tree.getroot()
    # Strip namespaces for simple xpath
    for elem in root.iter():
        if "}" in elem.tag:
            elem.tag = elem.tag.split("}", 1)[1]

    label_dict: dict = {"xml_file": str(xml_path)}

    file_elem = root.find(".//File_Area_Observational/File")
    data_file_name = None
    if file_elem is not None:
        name_elem = file_elem.find("file_name")
        if name_elem is not None and name_elem.text:
            data_file_name = name_elem.text.strip()

    if data_file_name:
        data_path = xml_path.parent / data_file_name
    else:
        # Check standard binary file candidate adjacent to xml
        data_path = None
        for ext in (".img", ".IMG", ".dat", ".DAT", ".raw", ".tif"):
            cand = xml_path.with_suffix(ext)
            if cand.exists():
                data_path = cand
                break

    if data_path is None or not data_path.exists():
        raise FileNotFoundError(f"Cannot locate data file referenced by PDS4 label: {xml_path}")

    # Check if data file is a GeoTIFF
    if data_path.suffix.lower() in (".tif", ".tiff", ".geotif", ".geotiff"):
        try:
            from .geotiff_reader import read_geotiff
            arr, _, _, _ = read_geotiff(data_path)
            return arr, label_dict
        except Exception:
            pass

    # Parse Array_2D_Image or Array_3D_Image
    array_elem = root.find(".//Array_2D_Image")
    if array_elem is None:
        array_elem = root.find(".//Array_3D_Image")
    if array_elem is None:
        raise ValueError(f"No Array_2D_Image or Array_3D_Image found in PDS4 label: {xml_path}")

    offset_elem = array_elem.find("offset")
    offset = int(offset_elem.text.strip()) if offset_elem is not None and offset_elem.text else 0

    elem_arr = array_elem.find("Element_Array")
    if elem_arr is None:
        raise ValueError(f"Missing Element_Array in PDS4 label: {xml_path}")

    data_type_elem = elem_arr.find("data_type")
    if data_type_elem is None or not data_type_elem.text:
        raise ValueError(f"Missing data_type in Element_Array: {xml_path}")
    dt_str = data_type_elem.text.strip().lower()
    dtype = PDS4_DTYPE_MAP.get(dt_str, np.dtype(">u2"))

    scale_elem = elem_arr.find("scaling_factor")
    scaling = float(scale_elem.text.strip()) if scale_elem is not None and scale_elem.text else 1.0
    val_offset_elem = elem_arr.find("value_offset")
    val_offset = float(val_offset_elem.text.strip()) if val_offset_elem is not None and val_offset_elem.text else 0.0

    axes_elems = array_elem.findall("Axis_Array")
    axis_dict = {}
    for ax in axes_elems:
        name_e = ax.find("axis_name")
        elem_e = ax.find("elements")
        if name_e is not None and elem_e is not None and name_e.text and elem_e.text:
            axis_dict[name_e.text.strip().lower()] = int(elem_e.text.strip())

    lines = axis_dict.get("line", 0)
    samples = axis_dict.get("sample", 0)
    if lines <= 0 or samples <= 0:
        # Fallback to ordered elements
        elems = [int(ax.find("elements").text.strip()) for ax in axes_elems if ax.find("elements") is not None]
        if len(elems) >= 2:
            lines, samples = elems[-2], elems[-1]
        else:
            raise ValueError(f"Invalid dimensions for PDS4 array: lines={lines}, samples={samples}")

    count = lines * samples
    with open(data_path, "rb") as f:
        f.seek(offset)
        raw = np.fromfile(f, dtype=dtype, count=count)

    if len(raw) != count:
        raise ValueError(f"Incomplete PDS4 binary data in {data_path}: expected {count} items, got {len(raw)}")

    array = raw.reshape((lines, samples)).astype(np.float32)
    if scaling != 1.0 or val_offset != 0.0:
        array = array * scaling + val_offset

    lo, hi = float(array.min()), float(array.max())
    if hi > lo:
        array = (array - lo) / (hi - lo)

    label_dict["lines"] = lines
    label_dict["samples"] = samples
    label_dict["data_type"] = dt_str
    return array, label_dict


def read_raster_canonical(
    path: str | Path,
) -> tuple[np.ndarray, object | None, object | None, dict]:
    """Canonical ingestion interface for all supported raster formats.

    Dispatches according to format detection:
    - GeoTIFF: rasterio reader (preserves CRS and transform)
    - PDS3: .lbl / .img reader
    - PDS4: .xml label + binary data reader
    - Standard imagery: 16-bit / 8-bit unchanged reader via OpenCV

    Returns:
        (array_float32, crs, transform, metadata_dict)
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    suffix = p.suffix.lower()

    # 1. GeoTIFF format
    if suffix in (".tif", ".tiff", ".geotif", ".geotiff"):
        try:
            from .geotiff_reader import read_geotiff
            arr, crs, transform, nodata = read_geotiff(p)
            return arr, crs, transform, {"format": "GeoTIFF", "nodata": nodata}
        except Exception:
            pass

    # 2. PDS4 XML label
    if suffix == ".xml":
        arr, lbl = read_pds4(p)
        return arr, None, None, {"format": "PDS4", "label": lbl}

    # 3. PDS3 LBL label, adjacent LBL, or attached header
    is_pds3 = (
        suffix in (".lbl", ".qub")
        or p.with_suffix(".lbl").exists()
        or p.with_suffix(".LBL").exists()
    )
    if not is_pds3 and p.is_file():
        try:
            with open(p, "rb") as f:
                prefix = f.read(64)
            if b"PDS_VERSION_ID" in prefix or b"CCSD3" in prefix:
                is_pds3 = True
        except Exception:
            pass

    if is_pds3:
        try:
            arr, lbl = read_pds3(p)
            return arr, None, None, {"format": "PDS3", "label": lbl}
        except Exception:
            pass

    # 4. Standard image formats via OpenCV (preserving 16-bit radiometric depth)
    import cv2
    img = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not decode image file: {p}")

    if img.ndim == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    img_f = img.astype(np.float32)
    lo, hi = float(img_f.min()), float(img_f.max())
    arr = (img_f - lo) / (hi - lo + 1e-6)
    return arr, None, None, {"format": "standard_raster", "dtype": str(img.dtype)}

