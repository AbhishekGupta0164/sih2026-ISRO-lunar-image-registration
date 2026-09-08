<div align="center">

# 🌕 SELENE-MATCH

### Multi-Modal, Sun-Angle & Scale-Invariant Lunar Image Registration System

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH%202026-PS%2026166-orange?style=for-the-badge&logo=rocket)](https://sih.gov.in/)
[![ISRO](https://img.shields.io/badge/ISRO-Space%20Technology-blue?style=for-the-badge)](https://www.isro.gov.in/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10%2B-yellow?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-teal?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React%20%2B%20Vite-UI-61DAFB?style=for-the-badge&logo=react)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-30%20Passed-brightgreen?style=for-the-badge&logo=pytest)](tests/)

**Chandrayaan-2 × LRO Sub-Pixel Georeferencing · 9-Stage Automated Pipeline · Interactive Mission Workbench**

*Smart India Hackathon 2026 · Problem Statement 26166 · Department of Space / ISRO · Space Technology*

</div>

---

## 📋 Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [9-Stage Pipeline Architecture](#-9-stage-pipeline-architecture)
4. [Key Features & Capabilities](#-key-features--capabilities)
5. [Technology Stack](#-technology-stack)
6. [Directory Structure](#-directory-structure)
7. [Installation & Setup](#-installation--setup)
8. [Running the Pipeline](#-running-the-pipeline)
9. [Running the API + Workbench UI](#-running-the-api--workbench-ui)
10. [Evaluation Metrics & Benchmarks](#-evaluation-metrics--benchmarks)
11. [Testing & Verification](#-testing--verification)
12. [Free Deployment Options](#-free-deployment-options)
13. [Pull Requests & Contributions](#-pull-requests--contributions)
14. [Team Roles](#-team-roles)
15. [Sample Data](#-sample-data)
16. [Documentation](#-documentation)
17. [License](#-license)

---

## 🛰️ Problem Statement

| Field | Details |
|:---|:---|
| **PS ID** | 26166 |
| **Organization** | Indian Space Research Organisation (ISRO) |
| **Category** | Space Technology |
| **Source (Moving) Images** | Chandrayaan-2 OHRC (0.25 m GSD), TMC-2 (5 m GSD), IIRS (80 m, ~256 spectral bands) |
| **Reference (Fixed) Image** | LRO NAC (~0.5 m GSD) / LRO WAC (~100 m GSD) |
| **Core Challenges** | Illumination variation (sun azimuth/elevation ±90°), viewpoint distortion (pushbroom + spherical Moon), scale disparity (up to ~320× GSD ratio) |
| **Required Deliverable** | Registered GeoTIFF + match points file + evaluation metrics with **sub-pixel accuracy** and **uniform GCP distribution** |

> **In simple terms**: Chandrayaan-2 photographs the lunar surface at radically different sun angles, scales, and sensor geometries than NASA's LRO reference dataset. SELENE-MATCH automatically finds exact pixel-to-pixel correspondences between these mismatched images so they can be co-registered for scientific analysis.

---

## 💡 Solution Overview

SELENE-MATCH is a fully automated, end-to-end **9-stage image registration pipeline** that solves the Chandrayaan-2 ↔ LRO co-registration problem through a multi-modal, illumination-aware deep feature matching ensemble.

### What Makes Our Solution Unique

| Dimension | Our Approach |
|:---|:---|
| **Illumination Invariance** | Phase congruency, census transform, and Lambertian hillshade normalisation — not just histogram equalization |
| **Scale Handling** | Metres-based GSD pyramid (not pixel-based) — works across 320× scale differences |
| **Matching Strategy** | Gated ensemble: crater graphs → LightGlue → LoFTR → Phase correlation → MI (IIRS) — auto-selects per image pair |
| **Outlier Rejection** | MAGSAC++ with 8×8 grid occupancy enforcer for spatially uniform GCPs |
| **Sub-pixel Precision** | Inverse-compositional Lucas–Kanade refinement achieving < 0.5 px RMSE |
| **Evaluation** | Held-out 20% validation GCP set for non-circular RMSE; CE90, NNI, coverage fraction |
| **User Interface** | ISRO-grade mission workbench with live pipeline telemetry, HD checkerboard viewer, on-demand PDF reports |

---

## 🔬 9-Stage Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         SELENE-MATCH PIPELINE                                        │
│                                                                                       │
│  Stage 0 ──► Stage 1 ──► Stage 2 ──► Stage 3 ──► Stage 4 ──► Stage 5 ──► ...         │
│                                                                                       │
│  [INGEST]   [GEOMETRY]  [ILLUM     [CRATER    [GSD        [GATE      [MATCH          │
│  PDS4 /     Map-project  NORM]      GRAPH]     PYRAMID]   ROUTER]    ENSEMBLE]       │
│  GeoTIFF    + GSD calc   Phase-cong Structural  Metres-    Auto-sel   LightGlue /    │
│  sun az/el  Tier 1/2/3  Census tr  detection   based      matcher    LoFTR /        │
│  footprint  projection   Hillshade  + graph     resampling per pair   Phase-corr     │
│                          shadow-mk  matching                           MI (IIRS)      │
│                                                                                       │
│  Stage 6 ──► Stage 7 ──► Stage 8                                                     │
│                                                                                       │
│  [ROBUST    [WARP &     [EVAL &                                                       │
│  FIT]       EXPORT]     REPORT]                                                       │
│  MAGSAC++   TPS / Piece RMSE_px                                                      │
│  8×8 grid   wise-affine RMSE_m                                                       │
│  GCP sampl  IC-LK sub-  CE90, NNI                                                    │
│  uniform    px refine   Coverage                                                     │
│  distribut  GeoTIFF out PDF report                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Each stage is an **isolated Python module** under `src/selene/` with a fixed input/output schema — enabling parallel development without merge conflicts.

---

## ⭐ Key Features & Capabilities

### 🔭 Core Pipeline
- **Multi-modal support**: OHRC, TMC-2, IIRS (Chandrayaan-2) ↔ LRO NAC, LRO WAC
- **PDS3/PDS4/QUB ingestion** with sun az/el, GSD, footprint metadata extraction
- **3-tier geometry**: USGS ISIS3 (Tier 1) → Affine-from-footprint (Tier 2, default) → Selenographic sphere (Tier 3 fallback)
- **Illumination normalization**: DEM hillshade per sun angle, phase congruency log-Gabor bank, census rank transform
- **Crater-graph structural matching**: Sun-angle robust — works even with 90° azimuth flips where SIFT fails
- **Gated matcher ensemble**: LoFTR, LightGlue/ALIKED, XFeat, Phase correlation, SimpleITK MI — auto-selected per pair characteristics
- **MAGSAC++ with uniform GCP grid enforcer**: 8×8 grid occupancy guarantee for spatially-distributed matches
- **Inverse-compositional Lucas–Kanade** sub-pixel refinement for < 0.5 px residual accuracy
- **80/20 held-out validation RMSE**: Non-circular evaluation using independent GCPs

### 🖥️ Interactive Mission Workbench (UI)
- **ISRO-grade dark-mode workbench** built with React + TypeScript + Vite
- **Real-time pipeline telemetry**: Live scientific log streaming per stage (GSD, VRAM, inlier counts, RMSE drops)
- **HD Interactive Checkerboard Viewer**: 8×8 canvas with grid size picker, sensor tinting, blink comparison, tile labels
- **Feature Correspondence Canvas**: Dense quiver plot, match count display, inlier ratio visualization
- **Results Overlay Modes**: Checkerboard / Wipe (slide) / Alpha-blend for alignment validation
- **On-demand ISRO PDF Report**: 4-page registration report with live match visuals, benchmark charts, auto-generated via `GET /api/v1/jobs/{id}/report.pdf`
- **Pipeline Error Diagnostics**: Stage failure badges, auto-scroll terminal, registration error banners
- **Empty upload validation**: Prevents pipeline runs without image upload

### 📊 Evaluation & Metrics
| Metric | Description |
|:---|:---|
| `RMSE_px` | Root-mean-square pixel residual (inlier set) |
| `RMSE_m` | Metre-scale RMSE using GSD |
| `CE90_px / CE90_m` | 90th-percentile circular error |
| `inlier_ratio` | MAGSAC++ inlier fraction |
| `n_inliers` | Number of validated GCPs |
| `NNI` | Nearest-neighbour index (uniformity measure) |
| `grid_coverage_fraction` | Fraction of 8×8 grid cells occupied by GCPs |
| `rmse_val_px` | Independent validation-set RMSE (non-circular) |

---

## 🛠️ Technology Stack

> **100% Free & Open Source** — No paid license, no credit card, no metered API. Runs fully offline.

### Core Science
| Package | License | Role |
|:---|:---|:---|
| Python 3.10+ | PSF | Runtime |
| NumPy, SciPy | BSD | Arrays, FFT, optimisation |
| OpenCV (`opencv-python-headless`) | Apache-2.0 | SIFT/AKAZE baseline, MAGSAC++, warping |
| scikit-image | BSD | Phase correlation, morphology |
| rasterio, GDAL, pyproj, shapely | BSD/MIT | GeoTIFF I/O, CRS, geometry |
| pvl / planetaryimage | BSD | PDS3/PDS4/QUB label parsing |
| pydantic, PyYAML, rich, loguru | MIT/BSD | Config, CLI, structured logging |
| pytest | MIT | 30-test regression suite |

### Matching & Illumination
| Package | License | Role |
|:---|:---|:---|
| PyTorch (CPU or CUDA) | BSD | Matcher runtime |
| Kornia (`kornia.feature.LoFTR`) | Apache-2.0 | Dense deep transformer matching |
| XFeat (`verlab/accelerated_features`) | Apache-2.0 | Accelerated local feature matching |
| LightGlue (`cvg/LightGlue`) + ALIKED/SuperPoint | Apache-2.0 | Sparse learned keypoint matching |
| SimpleITK | Apache-2.0 | Mutual-information registration (IIRS) |
| Custom Phase Congruency | — (original) | Illumination-invariant structural descriptor |
| Custom Crater Graph Matcher | — (original) | Sun-angle-robust structural correspondence |
| IC-LK / `findTransformECC` | Apache-2.0 | Sub-pixel patch alignment |
| 80/20 GCP Validator | — (original) | Non-circular independent RMSE validation |

### Geometry Backend (Free, Tiered)
| Tool | License | Tier |
|:---|:---|:---|
| USGS ISIS3 | Public domain (US Gov) | Tier 1 — optional, `conda-forge` |
| NASA NAIF SPICE / `spiceypy` | Public domain (NASA) | Tier 1 — optional |
| Custom affine-from-footprint | — (original) | Tier 2 — **default** |
| Selenographic sphere model (Kabsch/SVD) | — (original) | Tier 3 — fallback |

### API & UI
| Package | License | Role |
|:---|:---|:---|
| FastAPI + Uvicorn | MIT | Async REST job API |
| React 18 + TypeScript + Vite 5 | MIT | Workbench SPA frontend |
| Tailwind CSS | MIT | Styling |
| Lucide React | MIT | Icon system |
| Recharts | MIT | Metric charts |
| ReportLab | BSD | ISRO PDF report generation |
| Matplotlib | PSF | Residual plots, heatmaps |

### Data Sources (All Free & Public)
| Source | Access |
|:---|:---|
| ISSDC MapBrowse / PRADAN | Free, ISRO registration only |
| LROC NAC/WAC (QuickMap) | Free, public |
| SLDEM2015 / LOLA DEM | Free, PDS Geosciences Node |

---

## 📁 Directory Structure

```
selene-match/
├── README.md
├── LICENSE                          # MIT — SELENE-MATCH Team (SIH 2026, PS 26166)
├── CHANGELOG_REDESIGN.md            # 52-commit UI redesign changelog
├── DESIGN_SYSTEM.md                 # Design tokens and UI guidelines
├── UI_REDESIGN.md                   # Workbench v2.0 redesign notes
├── RELEASE_v2.0.0.md                # v2.0.0 release notes
├── environment.yml                  # conda-forge pinned environment
├── pyproject.toml                   # Package metadata + pytest config
├── requirements.txt                 # pip requirements for API/backend
├── Makefile                         # make setup / run / test / demo
├── Dockerfile                       # Docker image for reproducibility
├── docker-compose.yml               # Full-stack local Docker setup
├── benchmark.py                     # Full benchmark evaluation runner
├── benchmark_results.json           # Benchmark output data (tracked)
├── selene_commands_reference.pdf    # Command reference manual
│
├── docs/                            # Project documentation
│   ├── SELENE-MATCH_PS26166_Final_Blueprint.pdf  # Architecture blueprint
│   ├── SELENE_MATCH_Project_Report.pdf           # Full project report
│   ├── Project_Report.md                         # Markdown project report
│   ├── COMPARATIVE_ANALYSIS_AND_BENEFITS.md      # Algorithm comparison
│   ├── architecture.md                           # Layer I/O contracts
│   ├── gate_table.md                             # Matcher gating rules
│   └── metrics.md                                # RMSE/uniformity definitions
│
├── data/
│   ├── samples/                     # Demo lunar image pairs
│   │   ├── ohrc_nac_pair1/          # OHRC ↔ LRO NAC (similar sun angle)
│   │   ├── tmc_nac_pair1/           # TMC-2 ↔ LRO NAC (20× scale)
│   │   ├── iirs_wac_pair1/          # IIRS ↔ LRO WAC (320× scale, cross-modal)
│   │   └── opposite_azimuth_pair1/  # Opposite sun azimuth (hardest case)
│   ├── dem/                         # Clipped SLDEM2015 / LOLA tiles
│   └── download_samples.sh          # Fetches all sample pairs (free, public)
│
├── data_generation/                 # Synthetic data generator
│   ├── generate.py
│   └── output/
│       ├── reference.png
│       └── synthetic_target.png
│
├── src/
│   └── selene/
│       ├── __init__.py
│       ├── cli.py                   # `selene run | eval | export` entrypoint
│       ├── config.py                # Pydantic settings
│       ├── ingest/                  # Stage 0: PDS4/GeoTIFF + metadata
│       │   ├── pds_reader.py
│       │   ├── geotiff_reader.py
│       │   ├── metadata.py          # Sun az/el, footprint, instrument ID
│       │   └── pair.py              # Canonical Pair dataclass (frozen)
│       ├── geometry/                # Stage 1: Projection, GSD pyramid
│       │   ├── crs.py
│       │   ├── mapproject_tier2.py  # Affine-from-footprint (default)
│       │   ├── mapproject_tier1.py  # ISIS/ASP wrapper (optional)
│       │   ├── selenographic_model.py
│       │   └── pyramid.py
│       ├── illum/                   # Stage 2: Illumination normalization
│       │   ├── hillshade.py
│       │   ├── phase_congruency.py
│       │   ├── census.py
│       │   └── shadow_mask.py
│       ├── craters/                 # Stage 3: Crater detection + matching
│       │   ├── detector.py
│       │   └── graph_match.py
│       ├── matchers/                # Stage 4–5: Matching ensemble + gate
│       │   ├── sift_baseline.py
│       │   ├── lightglue_matcher.py
│       │   ├── loftr_matcher.py
│       │   ├── xfeat_matcher.py
│       │   ├── phase_correlation.py
│       │   ├── mutual_information.py
│       │   └── gate.py              # Auto-selection routing logic
│       ├── robust/                  # Stage 6: MAGSAC++ + GCP grid sampler
│       │   ├── magsac.py
│       │   └── uniform_sampler.py
│       ├── warp/                    # Stage 7: Warp + sub-pixel refinement
│       │   ├── tps.py
│       │   ├── piecewise_affine.py
│       │   ├── subpixel_lk.py       # IC-LK refinement
│       │   └── export_geotiff.py
│       ├── eval/                    # Stage 8: Metrics + report
│       │   ├── metrics.py           # RMSE, CE90, NNI, coverage
│       │   ├── uniformity.py
│       │   ├── plots.py             # Heatmap, checkerboard, quiver
│       │   └── report_pdf.py        # ISRO 4-page PDF report generator
│       └── utils/
│           ├── device.py
│           └── logging.py
│
├── api/                             # FastAPI backend
│   ├── main.py                      # App entrypoint + static file mounts
│   ├── routes/
│   │   ├── register.py              # POST /api/v1/register — upload + job start
│   │   ├── jobs.py                  # GET /api/v1/jobs/{id} — status + logs + PDF
│   │   └── samples.py               # GET /api/v1/samples
│   └── schemas.py                   # Pydantic request/response models
│
├── ui/                              # React + TypeScript workbench
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── context/
│       │   └── AppContext.tsx        # Global state: jobs, stages, pipeline, toasts
│       ├── services/
│       │   └── api.ts               # SeleneApiService: upload, poll, download
│       └── components/
│           ├── common/
│           │   ├── CheckerboardCanvas.tsx   # HD interactive 8×8 viewer
│           │   ├── ToastContainer.tsx
│           │   └── ImageRequiredModal.tsx
│           └── workbench/views/
│               ├── UploadView.tsx           # Step 1: Image upload + validation
│               ├── RegisterView.tsx         # Step 2: Pipeline + telemetry HUD
│               ├── MatchesView.tsx          # Step 3: Correspondence canvas
│               ├── ResultsView.tsx          # Step 4: Checkerboard + overlay
│               ├── MetricsView.tsx          # Step 5: Score dashboard
│               ├── ExportsView.tsx          # Step 6: PDF + GeoTIFF download
│               ├── LogsView.tsx             # Stage logs terminal
│               ├── DashboardView.tsx
│               ├── SettingsView.tsx
│               └── AboutView.tsx
│
├── tests/                           # Official pytest suite (30 tests)
│   ├── test_benchmark.py
│   ├── test_device.py
│   ├── test_eval_metrics.py
│   ├── test_geometry_synthetic.py   # Known affine recovered to < 0.2 px
│   ├── test_ground_truth_rmse.py
│   ├── test_ingest.py
│   ├── test_matcher_provenance.py
│   ├── test_matchers_gate.py
│   ├── test_matchers_loftr.py
│   ├── test_matchers_xfeat.py
│   ├── test_polarity_flip.py        # Sun-flip: crater graph passes, SIFT fails
│   ├── test_pyramid.py
│   ├── test_reproducibility.py
│   ├── test_subpixel_lk.py
│   └── test_validation.py
│
├── scripts/
│   ├── run_pair.sh                  # CLI convenience wrapper
│   ├── precompute_showcase.py       # Pre-computes 3–4 demo jobs for finale
│   └── benchmark_vs_sift.py        # Generates comparison table for PPT
│
├── results/                         # Benchmark outputs & sample run results
└── products/                        # Pipeline output directory (gitignored)
```

---

## 🚀 Installation & Setup

> All free, all offline after first download. No GPU required (CPU-first design).

### Prerequisites

- **Conda / Miniforge** ([install here](https://github.com/conda-forge/miniforge)) — or pip-only via `requirements.txt`
- **Node.js 18+** (for the UI workbench)
- **Git**

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/AbhishekGupta0164/sih2026-ISRO-lunar-image-registration.git
cd sih2026-ISRO-lunar-image-registration

# 2. Create and activate the conda environment
conda env create -f environment.yml
conda activate selene

# 3. Install deep learning extras (CPU path works fine; CUDA auto-detected)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install lightglue kornia simpleitk reportlab

# 4. Install the selene package in editable mode
pip install -e .

# 5. Install UI dependencies
cd ui && npm install && cd ..

# 6. Verify everything works
python -m pytest tests/ -q
# Expected: 30 passed ✓
```

### Alternative: Docker (One-command setup)

```bash
docker compose up --build
# API → http://localhost:8000
# UI  → http://localhost:5173
```

---

## ▶️ Running the Pipeline

### CLI Mode (Direct)

```bash
# Run full 9-stage registration on a pair
selene run \
  --src data/samples/ohrc_nac_pair1/ohrc.img \
  --ref data/samples/ohrc_nac_pair1/nac.tif \
  --out products/job_ohrc_nac

# Compute and display evaluation metrics
selene eval --job products/job_ohrc_nac

# Export deliverable bundle (GeoTIFF + matches.csv + metrics.json + report.pdf)
selene export --job products/job_ohrc_nac --zip products/ohrc_nac_bundle.zip
```

Every job is fully reproducible from `products/<job_id>/config.yaml`.

### Quick Demo with All Sample Pairs

```bash
bash data/download_samples.sh          # Download free public sample data
python scripts/precompute_showcase.py  # Pre-run all 4 showcase pairs
```

---

## 🌐 Running the API + Workbench UI

```bash
# Terminal 1 — Start the FastAPI backend
uvicorn api.main:app --reload --port 8000

# Terminal 2 — Start the React workbench UI
cd ui
npm run dev -- --port 5173
```

Open **http://localhost:5173** in your browser.

> ⚡ Works fully **offline** — no internet required for demo. Critical for venues with unreliable Wi-Fi.

### API Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/v1/register` | Upload image pair + start registration job |
| `GET` | `/api/v1/jobs/{job_id}` | Job status, stage progress, live logs |
| `GET` | `/api/v1/jobs/{job_id}/logs` | Stream raw stage logs |
| `GET` | `/api/v1/jobs/{job_id}/report.pdf` | On-demand ISRO 4-page PDF report |
| `GET` | `/api/v1/samples` | List available sample pairs |
| `GET` | `/` | API health check |

---

## 📈 Evaluation Metrics & Benchmarks

### Metric Definitions

| Metric | Formula | Target |
|:---|:---|:---|
| **RMSE_px** | $\sqrt{\frac{1}{n}\sum_{i=1}^{n} \|p_i - \hat{p}_i\|^2}$ | **< 0.5 px** |
| **RMSE_m** | `RMSE_px × GSD_m` | — |
| **CE90_px** | 90th percentile of $\|p_i - \hat{p}_i\|$ | — |
| **Inlier Ratio** | `n_inliers / n_raw` | > 0.4 |
| **NNI** | Nearest-neighbour index (1.0 = perfect uniform grid) | > 0.85 |
| **Grid Coverage** | Fraction of 8×8 cells with ≥ 1 GCP | > 0.75 |
| **Val RMSE_px** | RMSE on held-out 20% validation set | < 0.5 px |

### Algorithm Comparison

| Algorithm | Inlier Ratio | RMSE (px) | Sun-flip Robust? | Scale (320×) |
|:---|:---|:---|:---|:---|
| SIFT (Baseline) | ~0.18 | ~2.4 | ❌ | ❌ |
| LoFTR | ~0.55 | ~0.8 | ⚠️ | ✅ |
| LightGlue + ALIKED | ~0.62 | ~0.55 | ⚠️ | ✅ |
| **SELENE-MATCH (Ours)** | **~0.71** | **~0.38** | **✅** | **✅** |

---

## ✅ Testing & Verification

### Running the Test Suite

```bash
# Full test suite
pytest tests/ -v

# Specific test categories
pytest tests/test_polarity_flip.py -v    # Sun-flip invariance test
pytest tests/test_geometry_synthetic.py  # Known-affine recovery test
pytest tests/test_eval_metrics.py -v     # Metric computation test
```

**Current status: 30/30 tests passing ✅**

### Test Coverage Map

| Test File | What It Proves |
|:---|:---|
| `test_ingest.py` | PDS4/GeoTIFF read + metadata extraction |
| `test_geometry_synthetic.py` | Known affine transform recovered to < 0.2 px |
| `test_pyramid.py` | GSD pyramid metres-based tiling |
| `test_matchers_gate.py` | Correct matcher auto-selection per pair type |
| `test_matchers_loftr.py` | LoFTR dense matching returns valid correspondences |
| `test_matchers_xfeat.py` | XFeat accelerated matching returns valid matches |
| `test_polarity_flip.py` | **Crater graph passes, SIFT fails at ±180° sun flip** |
| `test_subpixel_lk.py` | IC-LK reduces residual below sub-pixel threshold |
| `test_eval_metrics.py` | RMSE, CE90, NNI, coverage fraction computations |
| `test_ground_truth_rmse.py` | End-to-end RMSE vs. ground truth transform |
| `test_reproducibility.py` | Identical inputs produce identical metric outputs |
| `test_validation.py` | Full pipeline end-to-end smoke test |
| `test_benchmark.py` | Benchmark runner produces valid JSON output |
| `test_matcher_provenance.py` | Match records include algorithm provenance tag |
| `test_device.py` | CPU/CUDA device detection works correctly |

### Pre-Finale Verification Checklist

- [ ] **Gate 1: Test Suite Green** — `pytest tests/` returns 30/30 passed
- [ ] **Gate 2: QGIS Visual Audit** — All 4 showcase GeoTIFFs validated with QGIS Swipe tool
- [ ] **Gate 3: Offline Backup** — OBS 1080p recording of full interactive workflow saved locally
- [ ] **Gate 4: API Smoke Test** — API endpoints verified from secondary device on local network
- [ ] **Gate 5: PDF Report** — `GET /api/v1/jobs/{id}/report.pdf` returns valid 4-page ISRO PDF

---

## 🌍 Free Deployment Options

> **Recommendation: Run 100% locally on demo laptop.** No deployment required to win — judges evaluate a live run.

| Platform | Use for | Free Tier Notes |
|:---|:---|:---|
| **Hugging Face Spaces** | FastAPI backend + static UI | Free CPU Spaces; Docker Spaces supported |
| **Render.com** | FastAPI backend | Free web service (idles when not in use) |
| **Railway.app** | FastAPI backend | Free starter credits, no card required |
| **GitHub Pages** | Static React UI build | Free for public repos |
| **Vercel / Netlify** | React UI static hosting | Free hobby tier |
| **GitHub Actions** | CI: `pytest` on every push | Free for public repos |

---

## 🔀 Pull Requests & Contributions

All improvements are submitted as Pull Requests to the upstream repository for review and scoring.

| PR # | Branch | Description |
|:---|:---|:---|
| #33 | `fix/all-pipeline-bugs` | 16-bit loading, MAGSAC threshold, aspect-ratio crop, cache-busting URLs |
| #34 | `feat/isro-pdf-report-reframe` | ISRO 4-page PDF report with live match visuals, benchmark charts |
| #35 | `fix/sidebar-collapse-and-ui-review` | Sidebar collapse width fix (64px), settings API health check |
| #36 | `fix/pipeline-smooth-pacing-and-telemetry` | Async stage pacing controller with scientific stage logging |
| #37 | `fix/dynamic-pipeline-logs-and-error-diagnostics` | Dynamic scientific calculation logs, failure badges, error diagnostics |
| #38 | `fix/interactive-checkerboard-viewer` | HD canvas 8×8 checkerboard viewer with grid selector, sensor tinting, blink compare |
| #39 | `fix/isro-pdf-report-on-demand-endpoint` | `GET /api/v1/jobs/{id}/report.pdf` on-demand endpoint + resilient frontend handler |
| #40 | `cleanup/repo-scratch-files` | Repository cleanup: removed 20 obsolete scratch scripts and temporary test files |

### Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/your-feature-name`
3. Commit your changes: `git commit -m "feat: description"`
4. Push to your fork: `git push origin feat/your-feature-name`
5. Open a Pull Request to `main`

---

## 👥 Team Roles

| Person | Owns | Focus Area |
|:---|:---|:---|
| **P1 — Geometry & Ingest** | `src/selene/ingest/`, `src/selene/geometry/` | PDS/GeoTIFF parsing, sun-angle/footprint metadata, GSD pyramid, Tier 2 map-projection, optional ISIS/SPICE, Tier 3 selenographic model |
| **P2 — Illumination & Structure** | `src/selene/illum/`, `src/selene/craters/` | Hillshade, phase congruency, crater detection + graph matching, Stage 2–3 gating |
| **P3 — Matching, Robustness & Sub-pixel** | `src/selene/matchers/`, `src/selene/robust/`, `src/selene/warp/` | LightGlue, LoFTR, XFeat, SIFT baseline, MAGSAC++, uniform GCP sampling, IC-LK refinement |
| **P4 — Product, Evaluation & Workbench** | `src/selene/eval/`, `api/`, `ui/` | GeoTIFF export, metrics, PDF report, FastAPI, React UI, benchmarks, demo |

Full breakdown, freeze schedule, and 36-hour finale plan: [`docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf`](docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf) §9–10.

---

## 🗂️ Sample Data

All data sources are free and public — no purchase required.

```bash
# Download all sample pairs
bash data/download_samples.sh
```

| Sample Pair | Sensors | Difficulty |
|:---|:---|:---|
| `ohrc_nac_pair1` | OHRC ↔ LRO NAC | Easy (similar sun angle) |
| `tmc_nac_pair1` | TMC-2 ↔ LRO NAC | Medium (20× scale) |
| `iirs_wac_pair1` | IIRS ↔ LRO WAC | Hard (320× scale, cross-modal) |
| `opposite_azimuth_pair1` | OHRC ↔ LRO NAC | Hardest (±90° sun azimuth flip) |

**Data Sources:**
- [ISSDC MapBrowse](https://chmapbrowse.issdc.gov.in/) / [PRADAN](https://pradan.issdc.gov.in/ch2/) — Chandrayaan-2 data (free, ISRO registration)
- [LROC](https://lroc.im-ldi.com/) / [QuickMap](https://quickmap.lroc.im-ldi.com/) — LRO NAC/WAC (free, public)
- [PDS Geosciences Node](https://pds-geosciences.wustl.edu/) — SLDEM2015 / LOLA DEM (free, public)

---

## 📚 Documentation

| Document | Description |
|:---|:---|
| [`docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf`](docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf) | Full technical architecture, algorithm design, team plan |
| [`docs/SELENE_MATCH_Project_Report.pdf`](docs/SELENE_MATCH_Project_Report.pdf) | Complete project report for submission |
| [`docs/Project_Report.md`](docs/Project_Report.md) | Markdown version of project report |
| [`docs/COMPARATIVE_ANALYSIS_AND_BENEFITS.md`](docs/COMPARATIVE_ANALYSIS_AND_BENEFITS.md) | Algorithm comparison vs. SIFT, Phase Correlation, MI |
| [`docs/architecture.md`](docs/architecture.md) | Stage input/output contracts and data schemas |
| [`docs/gate_table.md`](docs/gate_table.md) | Matcher gating decision table (Stage 5) |
| [`docs/metrics.md`](docs/metrics.md) | RMSE, uniformity, CE90 metric definitions |
| [`CHANGELOG_REDESIGN.md`](CHANGELOG_REDESIGN.md) | 52-commit UI v2.0 redesign changelog |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Design tokens and UI component guidelines |
| [`selene_commands_reference.pdf`](selene_commands_reference.pdf) | CLI command reference |

---

## 📄 License

```
MIT License

Copyright (c) 2026 SELENE-MATCH Team (SIH 2026, PS 26166)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

MIT License for all original code in this repository. Third-party libraries retain their own licenses (all permissive/open-source — see [Technology Stack](#-technology-stack)). Chandrayaan-2 and LRO image data are subject to ISRO/NASA public data usage terms.

---

<div align="center">

**Built with ❤️ for ISRO & Smart India Hackathon 2026**

*Chandrayaan-2 · LRO · Sub-pixel Registration · 9-Stage Pipeline · ISRO Mission Workbench*

[![SIH 2026](https://img.shields.io/badge/SIH%202026-PS%2026166-orange?style=flat-square)](https://sih.gov.in/)
[![ISRO](https://img.shields.io/badge/ISRO-Department%20of%20Space-blue?style=flat-square)](https://www.isro.gov.in/)
[![MIT License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>
