"""POST /api/v1/generate — Run the synthetic pair data-generation pipeline.

Accepts an optional base image upload plus transform parameters, runs
data_generation/generate_synthetic_pair.py, and returns URLs to the
generated reference.png + synthetic_target.png + ground_truth.json.

Owner: P1
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# The canonical output directory shared with the /synthetic static mount
SYNTH_DIR = Path("data_generation/output")

router = APIRouter()


@router.post("/generate", summary="Generate a synthetic registration pair from a base image")
async def generate_pair(
    base_image: Annotated[UploadFile | None, File(description="Optional base lunar image (PNG/TIFF/JPG). Leave empty for procedural generation.")] = None,
    rotation_deg: Annotated[float, Form(description="Rotation angle in degrees")] = 7.0,
    scale: Annotated[float, Form(description="Scale factor (e.g. 0.92)")] = 0.92,
    tx: Annotated[float, Form(description="X translation in pixels")] = 35.0,
    ty: Annotated[float, Form(description="Y translation in pixels")] = 20.0,
    gamma: Annotated[float, Form(description="Illumination gamma value (e.g. 0.7)")] = 0.7,
    target_width: Annotated[int, Form(description="Output image width in pixels")] = 1024,
    target_height: Annotated[int, Form(description="Output image height in pixels")] = 1024,
) -> JSONResponse:
    """
    Run the synthetic pair generation pipeline.

    1. Saves the uploaded base image (if provided) to a temp file.
    2. Calls generate_synthetic_pair.create_synthetic_pair() with the
       supplied transform parameters.
    3. Returns URLs for the generated images and ground-truth JSON.
    """
    # Validate parameters
    if not (0.0 < scale <= 3.0):
        raise HTTPException(status_code=422, detail="scale must be in (0, 3]")
    if not (-90.0 <= rotation_deg <= 90.0):
        raise HTTPException(status_code=422, detail="rotation_deg must be in [-90, 90]")
    if not (0.1 <= gamma <= 3.0):
        raise HTTPException(status_code=422, detail="gamma must be in [0.1, 3.0]")
    if not (64 <= target_width <= 4096 and 64 <= target_height <= 4096):
        raise HTTPException(status_code=422, detail="target dimensions must be in [64, 4096]")

    # Save uploaded image to a temp path if provided
    input_image_path: str | None = None
    tmp_dir: tempfile.TemporaryDirectory | None = None

    if base_image is not None and base_image.filename:
        tmp_dir = tempfile.TemporaryDirectory()
        suffix = Path(base_image.filename).suffix or ".png"
        tmp_path = Path(tmp_dir.name) / f"base_image{suffix}"
        content = await base_image.read()
        tmp_path.write_bytes(content)
        input_image_path = str(tmp_path)

    try:
        # Import here to avoid circular imports at module load time
        from data_generation.generate_synthetic_pair import create_synthetic_pair

        gt_data = create_synthetic_pair(
            input_image_path=input_image_path,
            output_dir=str(SYNTH_DIR),
            target_size=(target_width, target_height),
            rotation_deg=rotation_deg,
            scale=scale,
            tx=tx,
            ty=ty,
            gamma=gamma,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc
    finally:
        if tmp_dir is not None:
            tmp_dir.cleanup()

    # GEN-2 fix: append timestamp to bust browser cache — static filenames are
    # always reference.png / synthetic_target.png so without this the browser
    # serves the previous generation's images.
    import time
    ts = int(time.time() * 1000)
    return JSONResponse({
        "status": "success",
        "reference_image_url":  f"/synthetic/reference.png?t={ts}",
        "source_image_url":     f"/synthetic/synthetic_target.png?t={ts}",
        "ground_truth_url":     f"/synthetic/ground_truth.json?t={ts}",
        "reference_name":       "reference.png",
        "source_name":          "synthetic_target.png",
        "ground_truth":         gt_data,
        "params": {
            "rotation_deg":   rotation_deg,
            "scale":          scale,
            "tx":             tx,
            "ty":             ty,
            "gamma":          gamma,
            "target_width":   target_width,
            "target_height":  target_height,
            "used_base_image": base_image.filename if base_image else None,
        },
    })
