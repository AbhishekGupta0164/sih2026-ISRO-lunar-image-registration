"""Pydantic request/response models for the SELENE-MATCH API.

Owner: P4
"""
from __future__ import annotations

from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class JobRequest(BaseModel):
    src_path: Optional[str] = None
    ref_path: Optional[str] = None
    pair_id: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class JobStatus(BaseModel):
    job_id: str
    stage: str
    progress: float
    done: bool
    status: str = "running"
    metrics: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    # Product URLs populated after completion
    registered_geotiff_url: Optional[str] = None
    registered_png_url: Optional[str] = None
    matches_csv_url: Optional[str] = None
    report_pdf_url: Optional[str] = None
    checkerboard_url: Optional[str] = None
    quiver_url: Optional[str] = None
    coverage_url: Optional[str] = None
    residual_heatmap_url: Optional[str] = None


class RegisterResponse(BaseModel):
    job_id: str
    status: str
    metrics: Dict[str, Any]
    registered_geotiff_url: str
    registered_png_url: Optional[str] = None
    matches_csv_url: str
    report_pdf_url: str
    checkerboard_url: str
    quiver_url: str
    coverage_url: str
    residual_heatmap_url: str


class SamplePair(BaseModel):
    id: str
    modality_src: str
    modality_ref: str
    sun_delta_deg: float
    gsd_ratio: float
    description: str


class LogLine(BaseModel):
    level: str          # "INFO" | "WARNING" | "ERROR" | "SUCCESS"
    message: str
    timestamp: str      # ISO-format from loguru
