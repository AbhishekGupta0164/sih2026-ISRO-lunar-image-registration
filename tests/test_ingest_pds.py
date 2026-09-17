"""Unit tests for PDS3 binary reader, PDS4 XML reader, and canonical raster reading."""
from __future__ import annotations

from pathlib import Path
import numpy as np
import pytest

from selene.ingest.pds_reader import (
    read_pds3,
    read_pds4,
    read_raster_canonical,
    _parse_pds3_label_text,
)


def test_pds3_label_parsing():
    """PDS3 label parser must extract key-value parameters."""
    label_txt = """
    PDS_VERSION_ID = PDS3
    RECORD_TYPE = FIXED_LENGTH
    RECORD_BYTES = 512
    FILE_RECORDS = 100
    ^IMAGE = 2
    SPACECRAFT_NAME = "CHANDRAYAAN-2"
    INSTRUMENT_ID = "OHRC"
    LINES = 64
    LINE_SAMPLES = 64
    SAMPLE_BITS = 16
    SCALING_FACTOR = 0.5
    OFFSET = 10.0
    END
    """
    params = _parse_pds3_label_text(label_txt)
    assert params["RECORD_BYTES"] == 512
    assert params["RECORD_TYPE"] == "FIXED_LENGTH"
    assert params["LINES"] == 64
    assert params["LINE_SAMPLES"] == 64
    assert params["SAMPLE_BITS"] == 16
    assert params["SCALING_FACTOR"] == 0.5
    assert params["OFFSET"] == 10.0


def test_pds3_synthetic_binary_read(tmp_path: Path):
    """Write synthetic PDS3 file with header record and binary image, verify reading."""
    pds_file = tmp_path / "test_pds3.img"
    record_bytes = 256
    lines = 32
    samples = 32

    # Create synthetic 16-bit big-endian raster
    np.random.seed(42)
    raw_data = (np.random.rand(lines, samples) * 1000).astype(">u2")

    # Construct PDS3 label fitting in 1 record (padded with spaces)
    label_body = (
        f"PDS_VERSION_ID = PDS3\r\n"
        f"RECORD_TYPE = FIXED_LENGTH\r\n"
        f"RECORD_BYTES = {record_bytes}\r\n"
        f"^IMAGE = 2\r\n"
        f"OBJECT = IMAGE\r\n"
        f"  LINES = {lines}\r\n"
        f"  LINE_SAMPLES = {samples}\r\n"
        f"  SAMPLE_BITS = 16\r\n"
        f"  SAMPLE_TYPE = MSB_INTEGER\r\n"
        f"END_OBJECT = IMAGE\r\n"
        f"END\r\n"
    )
    pad_len = record_bytes - (len(label_body) % record_bytes)
    full_header = label_body + (" " * pad_len)

    with open(pds_file, "wb") as f:
        f.write(full_header.encode("ascii"))
        f.write(raw_data.tobytes())

    arr, meta = read_pds3(pds_file)
    assert arr.shape == (lines, samples)
    assert arr.dtype == np.float32
    # Output should be normalized [0, 1]
    assert 0.0 <= arr.min() <= arr.max() <= 1.0

    # Also verify canonical reader handles it
    arr_c, crs_c, trans_c, meta_c = read_raster_canonical(pds_file)
    assert arr_c.shape == (lines, samples)
    assert meta_c["format"] == "PDS3"


def test_pds4_synthetic_xml_read(tmp_path: Path):
    """Write synthetic PDS4 XML label and binary raster, verify reading."""
    bin_file = tmp_path / "data.bin"
    xml_file = tmp_path / "data.xml"
    lines = 16
    samples = 16

    data = np.arange(lines * samples, dtype="<f4").reshape((lines, samples))
    with open(bin_file, "wb") as f:
        f.write(data.tobytes())

    xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
    <Product_Observational xmlns="http://pds.nasa.gov/pds4/pds/v1">
        <File_Area_Observational>
            <File>
                <file_name>data.bin</file_name>
            </File>
            <Array_2D_Image>
                <offset unit="byte">0</offset>
                <axes>2</axes>
                <axis_index_order>Last Index Fastest</axis_index_order>
                <Element_Array>
                    <data_type>IEEE754MSBSingle</data_type>
                </Element_Array>
                <Axis_Array>
                    <axis_name>Line</axis_name>
                    <elements>{lines}</elements>
                    <sequence_number>1</sequence_number>
                </Axis_Array>
                <Axis_Array>
                    <axis_name>Sample</axis_name>
                    <elements>{samples}</elements>
                    <sequence_number>2</sequence_number>
                </Axis_Array>
            </Array_2D_Image>
        </File_Area_Observational>
    </Product_Observational>
    """
    with open(xml_file, "w") as f:
        f.write(xml_content)

    arr, meta = read_pds4(xml_file)
    assert arr.shape == (lines, samples)
    assert arr.dtype == np.float32
    assert "xml_file" in meta

    # Also verify canonical reader handles it
    arr_c, crs_c, trans_c, meta_c = read_raster_canonical(xml_file)
    assert arr_c.shape == (lines, samples)
    assert meta_c["format"] == "PDS4"
