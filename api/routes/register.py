"""Multipart-upload registration endpoint.

Owner: P4

POST /api/v1/register
    Accepts ref_image + mov_image file uploads, runs the full pipeline
    in the *foreground* (synchronous) and returns results immediately.

POST /api/v1/register/async
    Same upload, but dispatches the pipeline as a background job and
    returns a job_id immediately for polling via GET /api/v1/jobs/{job_id}.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from selene.cli import run_pipeline
from selene.config import PipelineConfig
from selene.ingest.validator import validate_pair
from api.routes.jobs import JOBS_DB, init_job, run_job_bg, job_log_append

router = APIRouter()


import re

def _clean_filename(raw_name: str | None, prefix: str) -> str:
    if not raw_name:
        return f"{prefix}.png"
    base = Path(raw_name).name
    # Strip invalid filesystem characters and path separators
    cleaned = re.sub(r'[\\/:*?"<>|\s()°]+', '_', base).strip('_.')
    suffix = Path(cleaned).suffix or ".png"
    stem = Path(cleaned).stem[:50]
    return f"{prefix}_{stem}{suffix}"


def _save_uploads(job_dir: Path, ref_image: UploadFile, mov_image: UploadFile) -> tuple[Path, Path]:
    """Persist uploaded files to the job directory and return their paths."""
    job_dir.mkdir(parents=True, exist_ok=True)

    ref_filename = _clean_filename(ref_image.filename, "input_ref")
    mov_filename = _clean_filename(mov_image.filename, "input_mov")

    ref_save = job_dir / ref_filename
    mov_save = job_dir / mov_filename

    ref_save.parent.mkdir(parents=True, exist_ok=True)
    mov_save.parent.mkdir(parents=True, exist_ok=True)

    with open(ref_save, "wb") as f:
        shutil.copyfileobj(ref_image.file, f)
    with open(mov_save, "wb") as f:
        shutil.copyfileobj(mov_image.file, f)

    return ref_save, mov_save



# ---------------------------------------------------------------------------
# Synchronous (blocking) register — returns results in the response body
# ---------------------------------------------------------------------------

@router.post("/register")
async def register_sync(
    ref_image: UploadFile = File(..., description="Reference (fixed) image — LRO NAC / WAC"),
    mov_image: UploadFile = File(..., description="Moving (source) image — OHRC / TMC-2 / IIRS"),
    config_json: str | None = Form(None, description="Optional JSON-encoded PipelineConfig overrides"),
):
    """Register moving image to reference image synchronously.

    Returns the full result payload (metrics + product URLs) once the pipeline
    finishes.  For large images use POST /api/v1/register/async instead.
    """
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job_dir = Path("products") / job_id

    ref_save, mov_save = _save_uploads(job_dir, ref_image, mov_image)

    val_res = validate_pair(str(ref_save), str(mov_save))
    if not val_res.valid:
        raise HTTPException(400, {"code": val_res.code, "message": val_res.message})

    # Parse optional config overrides
    cfg_kwargs: dict = {}
    if config_json:
        import json
        try:
            parsed = json.loads(config_json)
            if isinstance(parsed, dict):
                cfg_kwargs = parsed
        except Exception:
            cfg_kwargs = {}
    cfg = PipelineConfig(**cfg_kwargs)

    res = run_pipeline(
        src_path=str(mov_save),
        ref_path=str(ref_save),
        out_dir=job_dir,
        config=cfg,
        job_id=job_id,
    )
    return JSONResponse({
        "job_id": job_id,
        "status": "success",
        "metrics": res["metrics"],
        "registered_geotiff_url": f"/products/{job_id}/registered.tif",
        "registered_png_url":     f"/products/{job_id}/registered.png",
        "matches_csv_url":        f"/products/{job_id}/matches.csv",
        "report_pdf_url":         f"/products/{job_id}/registration_report.pdf",
        "checkerboard_url":       f"/products/{job_id}/plot_checkerboard.png",
        "quiver_url":             f"/products/{job_id}/plot_quiver.png",
        "coverage_url":           f"/products/{job_id}/plot_coverage.png",
        "residual_heatmap_url":   f"/products/{job_id}/plot_residual_heatmap.png",
    })


# ---------------------------------------------------------------------------
# Async (non-blocking) register — returns job_id immediately
# ---------------------------------------------------------------------------

@router.post("/register/async")
async def register_async(
    background_tasks: BackgroundTasks,
    ref_image: UploadFile = File(..., description="Reference (fixed) image"),
    mov_image: UploadFile = File(..., description="Moving (source) image"),
    config_json: str | None = Form(None),
):
    """Submit a registration job without waiting for it to complete.

    Poll GET /api/v1/jobs/{job_id} for status and product URLs.
    Stream live logs from GET /api/v1/jobs/{job_id}/logs (SSE).
    """
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    job_dir = Path("products") / job_id

    ref_save, mov_save = _save_uploads(job_dir, ref_image, mov_image)

    val_res = validate_pair(str(ref_save), str(mov_save))
    if not val_res.valid:
        raise HTTPException(400, {"code": val_res.code, "message": val_res.message})

    cfg_kwargs: dict = {}
    if config_json:
        import json
        try:
            parsed = json.loads(config_json)
            if isinstance(parsed, dict):
                cfg_kwargs = parsed
        except Exception:
            cfg_kwargs = {}

    # Register in the shared job store before launching background task
    JOBS_DB[job_id] = init_job(job_id)
    job_log_append(job_id, "INFO", f"Job {job_id} queued — ref={ref_image.filename}, mov={mov_image.filename}")

    background_tasks.add_task(
        run_job_bg, job_id, str(mov_save), str(ref_save), cfg_kwargs or None
    )

    return JSONResponse(
        {
            "job_id": job_id,
            "status": "running",
            "poll_url":  f"/api/v1/jobs/{job_id}",
            "logs_url":  f"/api/v1/jobs/{job_id}/logs",
        },
        status_code=202,
    )
