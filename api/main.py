"""FastAPI application entrypoint.

Owner: P4
Run: uvicorn api.main:app --reload --port 8000
"""
import sys
from pathlib import Path

# Ensure src/ is in sys.path so 'selene' is always importable
_src = Path(__file__).resolve().parent.parent / "src"
if _src.exists() and str(_src) not in sys.path:
    sys.path.insert(0, str(_src))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import torch  # Import at top-level to prevent segfaults in Uvicorn thread-pool workers

from api.routes import jobs, samples, register, generate

app = FastAPI(
    title="SELENE-MATCH API",
    version="0.1.0",
    description="Multi-modal, sun-angle and scale-invariant lunar image registration service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes under /api/v1 to match the frontend contract
app.include_router(jobs.router,     prefix="/api/v1/jobs",    tags=["jobs"])
app.include_router(samples.router,  prefix="/api/v1/samples", tags=["samples"])
app.include_router(register.router,  prefix="/api/v1",         tags=["register"])
app.include_router(generate.router,  prefix="/api/v1",         tags=["generate"])

# Mount products directory as static files for download/viewing
products_path = Path("products")
products_path.mkdir(parents=True, exist_ok=True)
app.mount("/products", StaticFiles(directory=str(products_path)), name="products")

# Mount synthetic generated data output directory for UI display
synthetic_path = Path("data_generation/output")
synthetic_path.mkdir(parents=True, exist_ok=True)
app.mount("/synthetic", StaticFiles(directory=str(synthetic_path)), name="synthetic")


from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
def root_portal():
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SELENE-MATCH API Portal</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', sans-serif;
            background: #0b0f19;
            color: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            background: #111827;
            border: 1px solid #1f2937;
            border-radius: 16px;
            padding: 40px;
            max-width: 560px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
            text-align: center;
        }
        .badge {
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
            border: 1px solid rgba(16, 185, 129, 0.3);
        }
        h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; color: #ffffff; }
        p { color: #9ca3af; font-size: 14px; margin-bottom: 28px; line-height: 1.5; }
        .grid { display: grid; gap: 12px; }
        .btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #1f2937;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 20px;
            border-radius: 10px;
            font-weight: 500;
            font-size: 14px;
            border: 1px solid #374151;
            transition: all 0.2s ease;
        }
        .btn:hover { background: #374151; border-color: #4b5563; transform: translateY(-1px); }
        .btn-primary { background: #2563eb; border-color: #3b82f6; }
        .btn-primary:hover { background: #1d4ed8; }
        .arrow { opacity: 0.7; }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">● API System Online (v0.1.0)</div>
        <h1>SELENE-MATCH Backend API</h1>
        <p>Multi-modal, illumination and scale-invariant lunar image registration microservice.</p>
        <div class="grid">
            <a href="http://localhost:5173" class="btn btn-primary">
                <span>Launch UI Workbench</span>
                <span class="arrow">➜</span>
            </a>
            <a href="/docs" class="btn">
                <span>Interactive Swagger OpenAPI Docs</span>
                <span class="arrow">↗</span>
            </a>
            <a href="/api/v1/health" class="btn">
                <span>API Health Check Endpoint</span>
                <span class="arrow">↗</span>
            </a>
        </div>
    </div>
</body>
</html>"""


@app.get("/health")
@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "service": "SELENE-MATCH API",
        "version": "0.1.0",
        "documentation": "/docs",
        "health": "/api/v1/health"
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    from fastapi import Response
    return Response(status_code=204)


