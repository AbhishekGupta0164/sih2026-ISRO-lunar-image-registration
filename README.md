# SELENE-MATCH

**Multi-modal, Sun-Angle and Scale-Invariant Lunar Image Correspondence**  
*Smart India Hackathon 2026 · PS 26166 · ISRO / Department of Space · Space Technology*

SELENE-MATCH finds sub-pixel, uniformly-distributed correspondence between Chandrayaan-2 optical
images (**OHRC**, **TMC-2**, **IIRS**) and a lunar reference image (**LRO NAC / WAC**), across large
differences in sun angle, viewpoint and scale (up to ~320×). It outputs a registered raster, a match-point
file, and evaluation metrics (RMSE, inlier count, inlier ratio, coverage score).

> **UI Redesign Update**: The frontend workbench has been completely redesigned with a clean, high-contrast scientific UI aesthetic inspired by ISRO/NASA workbench standards. See [`UI_REDESIGN.md`](UI_REDESIGN.md) for full details.

---

## 1. Table of Contents

1. [Problem Recap](#2-problem-recap)
2. [Architecture](#3-architecture)
3. [Tech Stack — 100% Free / Open Source](#4-tech-stack--100-free--open-source)
4. [Directory Structure](#5-directory-structure)
5. [Installation](#6-installation)
6. [Running the Pipeline](#7-running-the-pipeline)
7. [Running the API + Workbench UI](#8-running-the-api--workbench-ui)
8. [Testing & Demo Verification Software](#9-testing--demo-verification-software)
9. [Free Deployment Options](#10-free-deployment-options)
10. [Team Roles](#11-team-roles)
11. [Sample Data](#12-sample-data)
12. [License](#13-license)

---

## 2. Problem Recap

| | |
|---|---|
| **PS ID** | 26166 |
| **Source (moving) images** | Chandrayaan-2 OHRC (0.25 m), TMC-2 (5 m), IIRS (80 m, ~256 bands) |
| **Reference (fixed) image** | LRO NAC (~0.5 m) / LRO WAC (~100 m) |
| **Challenges** | Illumination (sun azimuth/elevation), viewpoint (pushbroom + spherical Moon), scale (up to ~320×) |
| **Deliverable** | Registered product + match points + evaluation metrics, sub-pixel accuracy, uniform match distribution |

Full technical rationale, algorithm design, and roadmap are in
[`docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf`](docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf).

---

## 3. Architecture

```
Ingest (PDS4/GeoTIFF + metadata + sun angles)
        │
        ▼
Geometry (map-projection / selenographic sphere model, GSD pyramid in metres)
        │
        ▼
Illumination normalisation (hillshade / phase congruency / census transform)
        │
        ▼
Gated matcher ensemble (crater graph, LightGlue, phase-correlation, mutual information)
        │
        ▼
Robust fit + uniform GCP sampling (MAGSAC++, 8×8 grid occupancy)
        │
        ▼
Warp (piecewise affine / thin-plate spline) → GeoTIFF
        │
        ▼
Sub-pixel refinement (inverse-compositional Lucas–Kanade)
        │
        ▼
Product export + Evaluation dashboard (RMSE, inliers, inlier ratio, coverage)
```

Each stage is an isolated Python package under `src/selene/` with a fixed input/output contract
(see `docs/architecture.md`), so four people can build in parallel without merge conflicts.

---

## 4. Tech Stack — 100% Free / Open Source

Every package below is free (MIT / BSD / Apache-2.0 / GPL) and runs fully offline on a laptop.
No paid license, subscription, or metered API is used anywhere in the pipeline.

### Core science
| Package | License | Role |
|---|---|---|
| Python 3.11 | PSF | Runtime |
| NumPy, SciPy | BSD | Arrays, FFT, optimisation |
| OpenCV (`opencv-python-headless`) | Apache-2.0 | SIFT/AKAZE baseline, warping, MAGSAC++ |
| scikit-image | BSD | Phase correlation, morphology |
| rasterio, GDAL, pyproj, shapely | BSD/MIT/X11 | GeoTIFF I/O, CRS, geometry |
| pvl / planetaryimage | BSD | PDS3/PDS4 label & QUB parsing |
| pydantic, PyYAML, rich, loguru | MIT/BSD | Config, CLI, logging |
| pytest | MIT | Testing |

### Matching & illumination
| Package | License | Role |
|---|---|---|
| PyTorch (CPU or CUDA) | BSD | Matcher runtime |
| Kornia (`kornia.feature.LoFTR`) | Apache-2.0 | LoFTR dense deep feature matching |
| XFeat (`verlab/accelerated_features`) | Apache-2.0 | Accelerated local feature matching |
| LightGlue (`cvg/LightGlue`) + ALIKED/SuperPoint weights | Apache-2.0 | Sparse learned matching |
| SimpleITK | Apache-2.0 | Mutual-information registration (IIRS branch) |
| Custom Census Transform / Phase-congruency | — (your code) | Illumination-invariant structural representation |
| Custom crater-detector + graph matcher | — (your code) | Sun-angle-robust structural matching |
| Pre-warped IC-LK & ECC (`findTransformECC`) | Apache-2.0 | Sub-pixel patch alignment |
| 80/20 Train/Validation GCP Evaluator | — (your code) | Independent non-circular RMSE validation |

### Geometry backend (all free, tiered so nobody is blocked)
| Tool | License | Tier |
|---|---|---|
| USGS ISIS3 | permissive (public domain, US Gov) | Tier 1, optional, install via `conda-forge` |
| NASA Ames Stereo Pipeline (ASP) | Apache-2.0 | Tier 1, optional |
| NAIF SPICE / `spiceypy` | public domain (NASA) | Tier 1, optional |
| Custom affine-from-footprint | — (your code) | Tier 2, default |
| Selenographic sphere model (Kabsch/SVD) | — (your code) | Tier 3, fallback |

### Product / UI
| Package | License | Role |
|---|---|---|
| FastAPI + Uvicorn | MIT | Job API |
| React + TypeScript + Vite | MIT | Workbench UI |
| Recharts or Plotly.js (open-source core) | MIT | Charts |
| ReportLab / Matplotlib | BSD | Auto-generated PDF report |

### Data sources (all free, public, ISRO/NASA)
| Source | Cost |
|---|---|
| ISSDC MapBrowse / PRADAN (`chmapbrowse.issdc.gov.in`, `pradan.issdc.gov.in/ch2/`) | Free, registration only |
| LROC NAC/WAC (`lroc.im-ldi.com`, `quickmap.lroc.im-ldi.com`) | Free, public |
| SLDEM2015 / LOLA DEM | Free, public (PDS Geosciences Node) |

**Nothing in this list requires a credit card.** The only optional cost is electricity for a GPU you
already own — a discrete GPU is never required, only helpful for the dense-matcher stretch goal.

---

## 5. Directory Structure

```
selene-match/
├── README.md
├── LICENSE                        # MIT
├── environment.yml                # conda-forge env, pinned versions
├── pyproject.toml
├── .gitignore
├── Makefile                       # make setup / run / test / demo
├── docker-compose.yml             # optional, free — local reproducibility only
│
├── docs/
│   ├── SELENE-MATCH_PS26166_Final_Blueprint.pdf
│   ├── architecture.md            # layer contracts (Pair / Match / Product schemas)
│   ├── gate_table.md              # matcher gating rules, Stage 5
│   ├── metrics.md                 # RMSE / inlier / uniformity definitions
│   └── ppt/
│       └── SELENE-MATCH_10slide.pptx
│
├── data/
│   ├── samples/                   # 4 pre-cleared demo pairs (small, git-lfs or download script)
│   │   ├── ohrc_nac_pair1/
│   │   ├── tmc_nac_pair1/
│   │   ├── iirs_wac_pair1/
│   │   └── opposite_azimuth_pair1/
│   ├── dem/                       # clipped SLDEM2015 / LOLA tiles
│   └── download_samples.sh        # pulls sample data from PRADAN/LROC (free, public)
│
├── src/
│   └── selene/
│       ├── __init__.py
│       ├── cli.py                 # `selene run | eval | export`
│       ├── config.py              # pydantic settings
│       │
│       ├── ingest/                # P1
│       │   ├── __init__.py
│       │   ├── pds_reader.py      # PDS3/PDS4/QUB reader
│       │   ├── geotiff_reader.py
│       │   ├── metadata.py        # sun az/el, footprint, instrument id
│       │   └── pair.py            # canonical Pair dataclass (frozen schema)
│       │
│       ├── geometry/              # P1
│       │   ├── __init__.py
│       │   ├── crs.py             # Moon equirectangular / stereographic CRS defs
│       │   ├── mapproject_tier2.py   # affine-from-footprint (default)
│       │   ├── mapproject_tier1.py   # ISIS/ASP wrapper (optional)
│       │   ├── selenographic_model.py # Tier 3, 3-DOF sphere rotation
│       │   └── pyramid.py         # metres-based GSD pyramid
│       │
│       ├── illum/                 # P2
│       │   ├── __init__.py
│       │   ├── hillshade.py       # DEM-based relight per image's own sun
│       │   ├── phase_congruency.py # log-Gabor bank, illumination-invariant descriptor
│       │   ├── census.py          # cheap rank transform for small Δaz
│       │   └── shadow_mask.py
│       │
│       ├── craters/               # P2
│       │   ├── __init__.py
│       │   ├── detector.py        # crater centre/radius detection
│       │   └── graph_match.py     # neighbourhood graph construction + matching
│       │
│       ├── matchers/              # P3
│       │   ├── __init__.py
│       │   ├── sift_baseline.py   # for the comparison slide
│       │   ├── lightglue_matcher.py
│       │   ├── phase_correlation.py
│       │   ├── mutual_information.py  # SimpleITK, IIRS branch
│       │   └── gate.py            # Stage 5 gating logic (the money table)
│       │
│       ├── robust/                # P3
│       │   ├── __init__.py
│       │   ├── magsac.py          # OpenCV USAC_MAGSAC wrapper
│       │   └── uniform_sampler.py # grid occupancy + min-distance GCP sampling
│       │
│       ├── warp/                  # P3 / P4
│       │   ├── __init__.py
│       │   ├── tps.py             # thin-plate spline
│       │   ├── piecewise_affine.py
│       │   ├── subpixel_lk.py     # inverse-compositional Lucas–Kanade
│       │   └── export_geotiff.py
│       │
│       ├── eval/                  # P4
│       │   ├── __init__.py
│       │   ├── metrics.py         # RMSE_px, RMSE_m, inlier ratio, CE90
│       │   ├── uniformity.py      # coverage / uniformity score
│       │   ├── plots.py           # residual heatmap, checkerboard, quiver
│       │   └── report_pdf.py      # auto one-pager per job
│       │
│       └── utils/
│           ├── __init__.py
│           └── logging.py
│
├── api/                            # P4
│   ├── __init__.py
│   ├── main.py                    # FastAPI app
│   ├── routes/
│   │   ├── jobs.py                # POST /jobs, GET /jobs/{id}, GET /jobs/{id}/products
│   │   └── samples.py             # GET /samples
│   └── schemas.py                 # pydantic request/response models
│
├── ui/                              # P4
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── PairDesk.tsx
│       │   ├── RunView.tsx
│       │   ├── CompareView.tsx     # checkerboard / wipe / match overlay
│       │   └── Scoreboard.tsx
│       └── components/
│           ├── OverlayCanvas.tsx
│           └── MetricsCard.tsx
│
├── tests/                          # everyone contributes here
│   ├── __init__.py
│   ├── test_ingest.py
│   ├── test_geometry_synthetic.py  # known affine recovered to <0.2 px
│   ├── test_pyramid.py
│   ├── test_matchers_gate.py
│   ├── test_polarity_flip.py       # synthetic sun-flip: crater graph passes, SIFT fails
│   ├── test_subpixel_lk.py
│   └── test_eval_metrics.py
│
├── scripts/
│   ├── run_pair.sh                 # `selene run` convenience wrapper
│   ├── precompute_showcase.py      # builds the 3–4 demo jobs before finale
│   └── benchmark_vs_sift.py        # generates the comparison table for the PPT
│
└── products/                       # gitignored; pipeline output lands here
```

---

## 6. Installation

All free, all offline after the first download.

```bash
# 1. Install Miniconda / Mambaforge (free) if you don't have it
# https://github.com/conda-forge/miniforge

# 2. Clone and create the environment
git clone <your-repo-url> selene-match
cd selene-match
conda env create -f environment.yml
conda activate selene

# 3. Install matching/deep-learning extras (CPU works fine; CUDA auto-detected if present)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu   # or the CUDA index if you have a GPU
pip install lightglue kornia simpleitk

# 4. Verify
python -m pytest tests/ -q
```

`environment.yml` (core):
```yaml
name: selene
channels: [conda-forge]
dependencies:
  - python=3.11
  - numpy
  - scipy
  - gdal
  - rasterio
  - pyproj
  - shapely
  - opencv
  - scikit-image
  - scikit-learn
  - pvl
  - pydantic
  - pyyaml
  - rich
  - loguru
  - pytest
  - pip
  - pip:
      - fastapi
      - uvicorn[standard]
      - python-multipart
      - reportlab
```

---

## 7. Running the Pipeline

```bash
# Run correspondence + registration on one pair
selene run --src data/samples/ohrc_nac_pair1/ohrc.img \
           --ref data/samples/ohrc_nac_pair1/nac.tif \
           --out products/job_ohrc_nac

# Compute / print evaluation metrics for a completed job
selene eval --job products/job_ohrc_nac

# Package the deliverable (GeoTIFF + matches.csv + metrics.json + report.pdf)
selene export --job products/job_ohrc_nac --zip products/job_ohrc_nac_bundle.zip
```

Every run is reproducible from `products/<job>/config.yaml`, which records the exact knobs used.

---

## 8. Running the API + Workbench UI

```bash
# Terminal 1 — API (free, local)
uvicorn api.main:app --reload --port 8000

# Terminal 2 — UI (free, local dev server)
cd ui
npm install
npm run dev -- --port 5173
```

Open `http://localhost:5173`. No internet connection or paid service is required for the demo —
this matters at venues with unreliable Wi-Fi.

---

## 9. Testing & Demo Verification Software

> [!IMPORTANT]
> **Empirical Validation Principle**: Every tool in this verification matrix is 100% free/open-source and serves to **prove your registration numbers are empirically real** under judge scrutiny rather than artificial slide metrics.

### 🔬 Software Matrix & Verification Arsenal

| Category | Verification Tool | Primary Purpose & How to Run | Impact / Judge Defense |
| :--- | :--- | :--- | :--- |
| 🧪 **Regression Testing** | **`pytest`** | `pytest tests/ -q` | Validates synthetic transforms & polarity flips (`test_polarity_flip.py`). Proves sun-invariance live. |
| 🗺️ **Visual Ground-Truth** | **`QGIS`** *(GPL)* | Load `registered.tif` alongside reference mosaic with QGIS Swipe Tool. | Independent verification outside your own dashboard canvas. |
| 📍 **GCP Baseline** | **`QGIS Georeferencer`** | Drop 8–10 manual GCPs on demo pair to calculate human RMSE baseline. | Benchmarks automated algorithm vs. human expert accuracy. |
| ⚡ **API Smoke-Testing** | **`Bruno` / `Insomnia`** | Execute GET/POST collections against `/jobs`, `/jobs/{id}`, `/samples`. | Ensures API withstands interactive UI stress & edge inputs. |
| 🚀 **Load & Concurrent Stress** | **`Locust`** *(Python)* | Fire concurrent job requests against FastAPI backend. | Prevents crash if multiple judges trigger simultaneous runs. |
| 🖼️ **Image Diffing** | **`scikit-image` / `ImageMagick`** | Compare output rasters to precomputed showcase outputs. | Catches silent sub-pixel degradation after code edits. |
| 🎥 **Offline Fallback** | **`OBS Studio`** *(FOSS)* | Capture full end-to-end video runs of all 4 showcase pairs. | Bulletproof insurance against venue Wi-Fi & laptop crashes. |
| 📊 **Residual Diagnostics** | **`Matplotlib`** | `selene eval --job <job> --plot` | Generates residual quiver plots & checkerboard error heatmaps. |
| 🏷️ **PDS Label Validation** | **`pds4_tools` / `pvl`** | Validate sun az/el, GSD, and sensor metadata against raw PDS label. | Guarantees header metadata parsing matches NASA/ISRO spec. |

---

### 📋 Pre-Finale Verification Checklist

> [!TIP]
> Complete all 4 verification gates prior to stage presentation:

- [ ] **Gate 1: Test Suite Green** — `pytest tests/` passes cleanly, featuring active green status on `test_polarity_flip.py`.
- [ ] **Gate 2: QGIS Visual Audit** — Every showcase GeoTIFF visually validated in QGIS with zero edge alignment tearing.
- [ ] **Gate 3: Offline Backup Video** — 1080p OBS screen recording of full interactive workflow saved locally as offline fallback.
- [ ] **Gate 4: Multi-Client API Test** — API endpoints verified from a secondary device over local network (CORS & IP verified).

---


## 10. Free Deployment Options

**Recommendation: run 100% locally on the demo laptop.** No deployment is actually required to win
this hackathon — judges evaluate a live run on your machine or a recorded backup. Avoid depending on
venue internet at all if you can.

If you still want a shareable link (e.g. for the internal round submission), all of the following have
a genuinely free tier with no card requirement for a small demo:

| Platform | Use for | Free tier notes |
|---|---|---|
| **Hugging Face Spaces** | FastAPI backend + a static demo UI | Free CPU Spaces, generous for a hackathon demo; supports Docker Spaces |
| **Render.com** | FastAPI backend | Free web service tier (spins down when idle — mention this if used live) |
| **Railway.app** | FastAPI backend | Free starter credits, no card for small usage |
| **GitHub Pages** | Static React build of the workbench UI (talking to a locally-run API for the live demo) | Completely free, unlimited for public repos |
| **Vercel / Netlify** | React UI static hosting | Free hobby tier |
| **GitHub Actions** | CI: run `pytest` on every push | Free for public repos |

Do not use any paid GPU cloud instance (e.g. paid Colab Pro, paid AWS/GCP GPU) — the CPU path is
mandatory-tested in this stack specifically so you never need one.

---

## 11. Team Roles

| Role | Owns (directories) | Focus |
|---|---|---|
| **P1 — Geometry & Ingest** | `src/selene/ingest/`, `src/selene/geometry/` | PDS/GeoTIFF parsing, sun-angle/footprint metadata, GSD pyramid, Tier 2 map-projection, optional Tier 1 ISIS/SPICE, Tier 3 selenographic model |
| **P2 — Illumination & Structure** | `src/selene/illum/`, `src/selene/craters/` | Hillshade, phase congruency, crater detection + graph matching, Stage-3 gating |
| **P3 — Matching, Robustness & Sub-pixel** | `src/selene/matchers/`, `src/selene/robust/`, sub-pixel in `src/selene/warp/` | LightGlue, SIFT baseline, mutual information, MAGSAC++, uniform GCP sampling, IC-LK refinement |
| **P4 — Product, Evaluation & Workbench** | `src/selene/eval/`, `api/`, `ui/` | GeoTIFF export, metrics, uniformity score, FastAPI, React UI, PPT, demo |

Full breakdown, freeze schedule, and 36-hour finale clock: see `docs/SELENE-MATCH_PS26166_Final_Blueprint.pdf`, §9–10.

---

## 12. Sample Data

All free and public. Run:

```bash
bash data/download_samples.sh
```

which pulls:
- 1 OHRC ↔ LRO NAC pair (similar sun angle — the "easy" case)
- 1 TMC-2 ↔ LRO NAC pair (20× scale)
- 1 IIRS ↔ LRO WAC pair (cross-modal, 320× scale vs OHRC)
- 1 opposite-sun-azimuth pair (the "why we exist" case)
- a matching DEM clip from SLDEM2015/LOLA

Sources: [ISSDC MapBrowse](https://chmapbrowse.issdc.gov.in/) · [PRADAN](https://pradan.issdc.gov.in/ch2/)
· [LROC](https://lroc.im-ldi.com/) · [QuickMap](https://quickmap.lroc.im-ldi.com/). Registration is free.

---

## 13. License

MIT for all original code in this repository. Third-party libraries retain their own licenses
(all permissive/open-source — see §4). Chandrayaan-2 and LRO data are subject to ISRO/NASA public data
usage terms.
