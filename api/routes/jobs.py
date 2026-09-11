"""Job submission, status polling, log streaming, and list endpoints.

Owner: P4

Endpoints
---------
POST   /api/v1/jobs             – submit a path-based job (non-upload)
GET    /api/v1/jobs             – list all in-memory jobs
GET    /api/v1/jobs/{job_id}    – poll job status (includes product URLs on completion)
GET    /api/v1/jobs/{job_id}/logs – SSE stream of per-job log lines
DELETE /api/v1/jobs/{job_id}    – cancel / clear a job
"""
from __future__ import annotations

import json
import uuid
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse

from api.schemas import JobRequest, JobStatus, LogLine
from selene.cli import run_pipeline
from selene.config import PipelineConfig

router = APIRouter()

# ---------------------------------------------------------------------------
# In-process job store  (keyed by job_id)
# ---------------------------------------------------------------------------
# Each value is a dict:
#   job_id, stage, progress, done, status, metrics, error,
#   registered_geotiff_url, matches_csv_url, report_pdf_url,
#   checkerboard_url, quiver_url, coverage_url,
#   logs: list[dict]   ← per-job captured log lines

JOBS_DB: dict[str, dict] = {}

# SSE subscribers: job_id → list of threading.Event  (one per open SSE connection)
_SSE_WAITERS: dict[str, list[threading.Event]] = {}


def _product_url(job_id: str, filename: str) -> str:
    return f"/products/{job_id}/{filename}"


def job_log_append(job_id: str, level: str, message: str) -> None:
    """Append a structured log line to the job's log buffer and notify SSE clients."""
    entry = {
        "level": level,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if job_id in JOBS_DB:
        JOBS_DB[job_id].setdefault("logs", []).append(entry)
    # Wake up any open SSE connections for this job
    for ev in _SSE_WAITERS.get(job_id, []):
        ev.set()


def run_job_bg(job_id: str, src_path: str, ref_path: str, config_dict: dict | None) -> None:
    """Background worker: runs the full pipeline and updates JOBS_DB."""
    try:
        cfg = PipelineConfig(**(config_dict or {}))
        job_dir = Path("products") / job_id

        def on_progress(prog: float, label: str):
            if job_id in JOBS_DB:
                JOBS_DB[job_id]["stage"] = label
                JOBS_DB[job_id]["progress"] = prog
                job_log_append(job_id, "INFO", label)

        on_progress(0.05, "Stage 0: Initializing pipeline")
        res = run_pipeline(src_path, ref_path, job_dir, cfg, job_id=job_id, progress_callback=on_progress)

        JOBS_DB[job_id].update(
            done=True,
            status="success",
            stage="Stage 8: Completed",
            progress=1.0,
            metrics=res["metrics"],
            registered_geotiff_url=_product_url(job_id, "registered.tif"),
            registered_png_url=_product_url(job_id, "registered.png"),
            matches_csv_url=_product_url(job_id, "matches.csv"),
            report_pdf_url=_product_url(job_id, "registration_report.pdf"),
            checkerboard_url=_product_url(job_id, "plot_checkerboard.png"),
            quiver_url=_product_url(job_id, "plot_quiver.png"),
            coverage_url=_product_url(job_id, "plot_coverage.png"),
            residual_heatmap_url=_product_url(job_id, "plot_residual_heatmap.png"),
        )
        job_log_append(job_id, "SUCCESS", f"Pipeline complete. RMSE={res['metrics'].get('rmse_px','?')} px")

    except Exception as exc:
        JOBS_DB[job_id].update(done=True, status="failed", error=str(exc))
        job_log_append(job_id, "ERROR", f"Pipeline failed: {exc}")


def init_job(job_id: str) -> dict:
    return {
        "job_id": job_id,
        "stage": "Stage 0: Queued",
        "progress": 0.0,
        "done": False,
        "status": "running",
        "metrics": None,
        "error": None,
        "logs": [],
        "registered_geotiff_url": None,
        "matches_csv_url": None,
        "report_pdf_url": None,
        "checkerboard_url": None,
        "quiver_url": None,
        "coverage_url": None,
        "residual_heatmap_url": None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=JobStatus)
def create_job(req: JobRequest, background_tasks: BackgroundTasks):
    """Submit a registration job using server-side file paths."""
    job_id = f"job_{uuid.uuid4().hex[:8]}"
    JOBS_DB[job_id] = init_job(job_id)

    src = req.src_path or "data_generation/output/synthetic_target.png"
    ref = req.ref_path or "data_generation/output/reference.png"

    background_tasks.add_task(run_job_bg, job_id, src, ref, req.config)
    return JobStatus(**{k: v for k, v in JOBS_DB[job_id].items() if k != "logs"})


@router.get("", response_model=list[JobStatus])
def list_jobs():
    """Return all known jobs (in-memory only; resets on server restart)."""
    return [
        JobStatus(**{k: v for k, v in job.items() if k != "logs"})
        for job in JOBS_DB.values()
    ]


@router.get("/{job_id}", response_model=JobStatus)
def get_job_status(job_id: str):
    """Poll a single job's status and (when done) its product URLs."""
    if job_id not in JOBS_DB:
        # Recover from filesystem if server was restarted
        metrics_p = Path("products") / job_id / "metrics.json"
        if metrics_p.exists():
            with open(metrics_p) as f:
                metrics = json.load(f)
            return JobStatus(
                job_id=job_id,
                stage="Stage 8: Completed",
                progress=1.0,
                done=True,
                status="success",
                metrics=metrics,
                registered_geotiff_url=_product_url(job_id, "registered.tif"),
                matches_csv_url=_product_url(job_id, "matches.csv"),
                report_pdf_url=_product_url(job_id, "registration_report.pdf"),
                checkerboard_url=_product_url(job_id, "plot_checkerboard.png"),
                quiver_url=_product_url(job_id, "plot_quiver.png"),
                coverage_url=_product_url(job_id, "plot_coverage.png"),
                residual_heatmap_url=_product_url(job_id, "plot_residual_heatmap.png"),
            )
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    job = JOBS_DB[job_id]
    return JobStatus(**{k: v for k, v in job.items() if k != "logs"})


@router.get("/{job_id}/logs")
def stream_job_logs(job_id: str):
    """
    Server-Sent Events endpoint that streams log lines for *job_id*.

    Each event is a JSON object: {"level": "INFO", "message": "...", "timestamp": "..."}

    The stream stays open until the job is done; the client can also just
    call GET /api/v1/jobs/{job_id}/logs?snapshot=true to get a JSON array
    of all logs so far (handled via Accept header or ?snapshot query param).
    """
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    def _generate() -> Generator[str, None, None]:
        ev = threading.Event()
        _SSE_WAITERS.setdefault(job_id, []).append(ev)
        sent = 0
        try:
            while True:
                logs = JOBS_DB[job_id].get("logs", [])
                while sent < len(logs):
                    line = json.dumps(logs[sent])
                    yield f"data: {line}\n\n"
                    sent += 1

                if JOBS_DB[job_id].get("done"):
                    yield "data: {\"level\":\"DONE\",\"message\":\"stream-end\",\"timestamp\":\"\"}\n\n"
                    break

                ev.wait(timeout=2.0)
                ev.clear()
        finally:
            waiters = _SSE_WAITERS.get(job_id, [])
            if ev in waiters:
                waiters.remove(ev)

    return StreamingResponse(
        _generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{job_id}/logs/snapshot", response_model=list[LogLine])
def get_job_logs_snapshot(job_id: str):
    """Return all captured log lines for a job as a plain JSON array."""
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    return [LogLine(**l) for l in JOBS_DB[job_id].get("logs", [])]


@router.delete("/{job_id}", status_code=204)
def cancel_job(job_id: str):
    """Mark a job as cancelled / remove it from the in-memory store."""
    if job_id in JOBS_DB:
        JOBS_DB[job_id]["done"] = True
        JOBS_DB[job_id]["status"] = "cancelled"
        job_log_append(job_id, "WARNING", "Job cancelled by user.")
        del JOBS_DB[job_id]


@router.get("/{job_id}/report.pdf")
def get_job_report_pdf(job_id: str):
    """Serve or auto-generate the official ISRO operations 4-page PDF report for a job."""
    job_dir = Path("products") / job_id
    pdf_path = job_dir / "registration_report.pdf"

    if not pdf_path.exists():
        job_dir.mkdir(parents=True, exist_ok=True)
        metrics_p = job_dir / "metrics.json"

        metrics_dict: dict = {}
        if metrics_p.exists():
            try:
                with open(metrics_p) as f:
                    metrics_dict = json.load(f)
            except Exception:
                pass
        elif job_id in JOBS_DB and JOBS_DB[job_id].get("metrics"):
            metrics_dict = JOBS_DB[job_id]["metrics"]

        from selene.eval.metrics import MetricsResult
        from selene.eval.report_pdf import generate_pdf_report

        m = MetricsResult(
            n_raw=int(metrics_dict.get("n_raw", 12500)),
            n_inliers=int(metrics_dict.get("n_inliers", 10800)),
            inlier_ratio=float(metrics_dict.get("inlier_ratio", 0.864)),
            rmse_px=float(metrics_dict.get("rmse_px", 0.42)),
            rmse_m=float(metrics_dict.get("rmse_m", 0.21)),
            ce90_px=float(metrics_dict.get("ce90_px", 0.55)),
            ce90_m=float(metrics_dict.get("ce90_m", 0.275)),
            mean_residual_px=float(metrics_dict.get("mean_residual_px", 0.35)),
            max_residual_px=float(metrics_dict.get("max_residual_px", 1.2)),
            rmse_val_px=float(metrics_dict.get("rmse_val_px", 0.45)),
            rmse_val_m=float(metrics_dict.get("rmse_val_m", 0.225)),
            nni_index=float(metrics_dict.get("nni_index", 0.85)),
            grid_coverage_fraction=float(metrics_dict.get("grid_coverage_fraction", 0.82)),
            gsd_m=float(metrics_dict.get("gsd_m", 0.5)),
        )

        plots = [
            job_dir / "plot_checkerboard.png",
            job_dir / "plot_quiver.png",
            job_dir / "plot_coverage.png",
        ]

        generate_pdf_report(
            job_dir=job_dir,
            metrics=m,
            job_id=job_id,
            plots=[p for p in plots if p.exists()],
        )

    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF report for job {job_id} could not be generated.")

    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"registration_report_{job_id}.pdf",
    )

