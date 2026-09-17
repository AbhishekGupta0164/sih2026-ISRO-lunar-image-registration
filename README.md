# SELENE-MATCH

**Multi-modal, sun-angle and scale-invariant lunar image correspondence**

Smart India Hackathon 2026 · Problem Statement **26166** · Indian Space Research Organisation (ISRO) / Department of Space · Theme: Space Technology · Category: Software

Registers a Chandrayaan-2 **source (moving)** image onto an LRO **reference (fixed)** image: find correspondence, warp the source into the reference coordinate frame, then report how well that alignment actually scored.

Supported moving sensors: **OHRC**, **TMC-2**, **IIRS**.  
Reference: **LRO NAC** or **LRO WAC**.


|                |                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Workbench (UI) | [sih2026-lunar-image-registration.vercel.app](https://sih2026-lunar-image-registration.vercel.app/)                                   |
| License        | [MIT](LICENSE)                                                                                                                        |
| Runtime        | Python 3.11+, Node 18+ for the UI. CPU is enough.                                                                                     |


The Vercel site is the React workbench. A full registration job talks to FastAPI (`VITE_API_URL`, default `http://localhost:8000/api/v1`). At a venue with bad Wi-Fi, run API + UI on the laptop. Do not count on the public UI host having a live GPU backend.

---



## Contents

1. [What PS 26166 asks for](#1-what-ps-26166-asks-for)
2. [How this repo answers it](#2-how-this-repo-answers-it)
3. [Pipeline](#3-pipeline)
4. [Matcher gate](#4-matcher-gate)
5. [Products of a run](#5-products-of-a-run)
6. [Evaluation metrics](#6-evaluation-metrics)
7. [Repository layout](#7-repository-layout)
8. [Install](#8-install)
9. [API and workbench](#10-api-and-workbench)
10. [Tests](#11-tests)
11. [Data](#12-data)
12. [Stack](#13-stack)
13. [Docs](#14-docs)
14. [License](#15-license)

---



## 1. What PS 26166 asks for

Image registration here means lining up two views of the same lunar scene taken at different times, from different viewpoints, or by different sensors.

- **Source image (moving):** geometrically transformed. Chandrayaan-2 OHRC (~0.25 m/px), TMC-2 (~5 m/px), IIRS (~80 m/px).
- **Reference image (fixed):** LRO NAC (~0.5 m/px) or LRO WAC (~100 m/px).

The problem statement names three failure modes:

**Illumination variation.** Sun azimuth and elevation change how rims and floors are lit. With no atmosphere, shadows are hard-edged. A crater that is a bright ridge in one pass can be a dark hole in the next. Gradient descriptors that assume stable brightness (plain SIFT/ORB on raw DN) often fail.

**Viewpoint variation.** Different orbits and look angles. The same crater can appear shifted, rotated, scaled, or perspective-warped. Pushbroom geometry plus real relief means a single rigid transform is a weak model.

**Scale variation.** Missions fly at different altitudes. OHRC vs IIRS is on the order of **320×** in ground sample distance. Matching native pixels against each other is the wrong setup.

Expected software: generic correspondence between Chandrayaan-2 optical images and lunar reference images; **sub-pixel** accuracy as the target; **uniform distribution** of match points; deliverables = registered product + match points + evaluation metrics (RMSE, inlier count, inlier ratio, coverage).

---



## 2. How this repo answers it

SELENE-MATCH is a staged Python pipeline (`selene run`) plus FastAPI (`api/`) plus a TypeScript workbench (`ui/`). Same code path for CLI and UI jobs.


| PS item                                       | Where it lives                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Multi-modal (OHRC / TMC-2 / IIRS ↔ NAC / WAC) | `ingest/pair.py`, `matchers/gate.py`                                                       |
| Sun-angle / illumination                      | `illum/shadow_mask.py`, phase congruency, census, `craters/` graph match when Δaz is large |
| Scale / GSD                                   | `geometry/pyramid.py` — common GSD in metres before matching                               |
| Viewpoint / non-rigid warp                    | MAGSAC++ then TPS or piecewise affine (homography fallback)                                |
| Match points                                  | `matches.csv`                                                                              |
| Registered product                            | `registered.tif`                                                                           |
| RMSE, inliers, coverage                       | `eval/metrics.py` → `metrics.json` + PDF                                                   |
| Uniform spread                                | 8×8 GCP grid + Clark–Evans NNI                                                             |
| Sub-pixel                                     | IC-LK on 21×21 patches (`warp/subpixel_lk.py`)                                             |


IIRS is treated as a **cross-modal** pair (mutual information). There is no full ~256-band cube preprocessor in this tree. If you only have a 2-D IIRS product / stretched band, that is what the MI path expects.

Modules under `src/selene/hda/` (hazard-style overlay) and `src/selene/change/` (two-epoch difference) exist for experiments. They are **not** written on every `selene run`.

---



## 3. Pipeline

Packages under `src/selene/` keep their own I/O. Job logs label ingest through export as stages 1–8 (the warp step is logged as stage 6, IC-LK as stage 7; **code runs IC-LK before the warp**). API validation of uploads happens before the job starts.

```
ingest + metadata
        │  PDS3 .lbl / PDS4 .xml / JSON sidecar / filename hints
        ▼
GSD resample to shared metres (coarsest of the pair)
        │
        ▼
shadow mask
        │
        ▼
gated correspondence (at that common GSD)
        │
        ▼
MAGSAC++  →  8×8 uniform GCP sample (no points in shadow)
        │
        ▼
IC-LK refine (21×21 patches)
        │
        ▼
warp (TPS / piecewise affine / homography)  →  GeoTIFF
        │
        ▼
metrics, plots, PDF
```

Matching runs at `max(ref GSD, source GSD)`. If the GSD ratio is greater than 1, `metrics.json` prefixes the matcher name with `pyramid_` (for example `pyramid_lightglue`). That is a label, not a second matching pass at a finer level.

Metadata used for routing: instrument id, GSD (m/px), sun azimuth / elevation, Δaz, GSD ratio, cross-sensor flag. Filename fallbacks: `OHRC` → 0.25 m, `TMC` → 5 m, `IIRS` → 80 m, `NAC` → 0.5 m, `WAC` → 100 m. Missing sun/GSD in labels falls back to 90° / 45° / 5 m and is printed in the log.

Config knobs (seed, matcher, warp model, MAGSAC threshold, grid, LK patch) are in `src/selene/config.py`.

---



## 4. Matcher gate

`src/selene/matchers/gate.py`, `matcher: auto`:


| Condition                               | Expert                                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Δaz ≥ 60°                               | crater graph (topology, not brightness). If too few points: SIFT on phase congruency, then census, then raw SIFT |
| IIRS on either side + different sensors | mutual information (SimpleITK)                                                                                   |
| GSD ratio > 3                           | phase correlation                                                                                                |
| otherwise                               | LightGlue                                                                                                        |
| deep matchers off, or too few points    | SIFT                                                                                                             |


LoFTR and XFeat are in the same package if you set `matcher` explicitly. Provenance in `metrics.json` is the **name that ran** (`crater_graph`, `phase_congruency_sift`, `census_sift`, `lightglue`, `mutual_info`, `phase_corr`, `sift_fallback`, `pyramid_lightglue`, …), not only the name you requested.

---



## 5. Products of a run

Written under `products/<job>/` (or `--out`):


| File                                                                                         | Contents                                                                                                              |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `registered.tif`                                                                             | Source warped to the reference grid. Copies reference CRS/affine when rasterio had them.                              |
| `registered.png`                                                                             | Preview for the UI                                                                                                    |
| `matches.csv`                                                                                | `src_x,src_y,ref_x,ref_y,confidence` — **pixel** coordinates, plus a 0–1 score (matcher + residual + shadow distance) |
| `metrics.json`                                                                               | Numbers below + `matcher_used` + git commit + timestamp                                                               |
| `registration_report.pdf`                                                                    | Same story for a printed packet                                                                                       |
| `plot_checkerboard.png`, `plot_quiver.png`, `plot_coverage.png`, `plot_residual_heatmap.png` | Diagnostics                                                                                                           |


`selene export --job … --zip …` packs that folder.

---



## 6. Evaluation metrics

Implemented in `src/selene/eval/metrics.py` and defined in [docs/metrics.md](docs/metrics.md).


| Field                                | Meaning                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `n_raw`, `n_inliers`, `inlier_ratio` | Final GCPs after MAGSAC++ → uniform sample → IC-LK. A `selene run` currently scores that set as all-inliers (`inlier_ratio` ≈ 1). MAGSAC candidate vs inlier counts are in the job log. |
| `rmse_px`, `rmse_m`                  | RMS residual of the **fit** ~80% of those GCPs under the MAGSAC homography (pixels and metres via source GSD) |
| `rmse_val_px`                        | Same on a **held-out ~20%** of GCPs (do not quote only the fit set)                            |
| `ce90_px` / `ce90_m`                 | 90th-percentile residual on the fit set                                                        |
| `nni_index`                          | Clark–Evans nearest-neighbour index. ≈1 random; **>1** more even than random; <1 clustered     |
| `grid_coverage_fraction`             | Fraction of 8×8 cells that contain a GCP. Shadow pixels are dropped **before** GCP sampling; this fraction itself does not shrink the denominator for dark cells |
| `rmse_vs_gt_px`                      | If `ground_truth.json` sits next to the pair (synthetic generator writes this)                 |
| `mean_confidence`, `recovered_transform` | Per-GCP score (matcher + residual + shadow distance) and a coarse rotation/scale/translation read from the MAGSAC matrix |


IC-LK stops when the update is under 0.01 px or it hits the iteration cap. That is the sub-pixel **step**. Whether a given CH2/LRO pair is under 0.5 px RMSE is a number in that job’s JSON, not a slogan.

A matcher-only bench file `benchmark_results.json` may exist in the tree (LightGlue / LoFTR / XFeat / SIFT timings). Treat it as that bench, not as a 320× sun-flip score of the full pipeline.

---



## 7. Repository layout

```
src/selene/cli.py              selene run | eval | export
src/selene/config.py
src/selene/ingest/             GeoTIFF, PDS readers, metadata, Pair, upload validator
src/selene/geometry/           CRS, GSD pyramid, optional ISIS/affine/sphere tiers
src/selene/illum/              shadow, hillshade, phase congruency, census
src/selene/craters/            detector + graph match
src/selene/matchers/           LightGlue, LoFTR, XFeat, SIFT, phase corr, MI, gate
src/selene/robust/             MAGSAC++, uniform sampler
src/selene/warp/               tps, piecewise_affine, subpixel_lk, export_geotiff
src/selene/eval/               metrics, uniformity, plots, report_pdf
src/selene/utils/              seed, logging, device
src/selene/hda/, change/       experiment-only overlays (not every run)
api/                           FastAPI (register, jobs, samples, generate, health)
ui/                            React 18 + Vite workbench
tests/                         pytest
scripts/                       bench, showcase, routing checks
data_generation/               synthetic source/reference + ground_truth.json
data/download_samples.sh       placeholder (needs PRADAN / LROC login)
docs/                          architecture, gate table, metrics, project notes
environment.yml
Makefile                       test, api, ui, docker wrappers
docker-compose.yml
pyproject.toml                 console script: selene
products/                      gitignored job dirs
```

---



## 8. Install

Conda (or Mamba), Git, Node 18+ if you want the UI.

```bash
git clone https://github.com/AbhishekGupta0164/sih2026-ISRO-lunar-image-registration.git
cd sih2026-ISRO-lunar-image-registration

conda env create -f environment.yml
conda activate selene

pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install lightglue kornia simpleitk reportlab
pip install -e .

cd ui && npm install && cd ..
python -m pytest tests/ -q
```

Swap the PyTorch URL for the CUDA wheel if you have an NVIDIA GPU. Learned matchers then use it; classical SIFT/MAGSAC still run on CPU.

Docker:

```bash
docker compose up --build
# API  http://localhost:8000
# UI   http://localhost:5173
```

`make test`, `make api`, `make ui` wrap the same commands if you prefer.

---


## 9. API and workbench

```bash
uvicorn api.main:app --reload --port 8000          # terminal 1
cd ui && npm run dev -- --port 5173                # terminal 2
```

Open [http://localhost:5173](http://localhost:5173)


| Method | Path                         | Notes                                       |
| ------ | ---------------------------- | ------------------------------------------- |
| GET    | `/api/v1/health`             | Liveness                                    |
| POST   | `/api/v1/register`           | Multipart source + reference; blocking      |
| POST   | `/api/v1/register/async`     | Returns `job_id`; poll GET jobs             |
| GET    | `/api/v1/jobs/{id}`          | Stage text, progress, metrics, product URLs |
| GET    | `/api/v1/jobs/{id}/logs`     | SSE log stream                              |
| GET    | `/api/v1/samples`            | Sample listing used by the UI               |
| POST   | `/api/v1/generate`           | Synthetic pair helper for the workbench     |


`validate_pair` rejects empty files, undecodable rasters, size < 64×64, near-zero variance (blank), and identical source/reference. It does not compute geographic footprint overlap; pick overlapping scenes yourself.

---



## 10. Tests

```bash
pytest tests/ -v
pytest tests/test_polarity_flip.py      # crater graph vs SIFT on inverted shading
pytest tests/test_matchers_gate.py      # Δaz / IIRS / LightGlue routing
pytest tests/test_pyramid.py
pytest tests/test_subpixel_lk.py
pytest tests/test_reproducibility.py    # same pair → same metrics
pytest tests/test_validation.py
pytest tests/test_eval_metrics.py
pytest tests/test_ingest.py tests/test_matcher_provenance.py tests/test_ground_truth_rmse.py
```

Also in `tests/`: LoFTR / XFeat / device / geometry / matcher bench. For a visual check outside our PDF, load `registered.tif` and the reference in QGIS and use the swipe tool. That is optional; pytest is the automated gate.

---



## 11. Data

`data/download_samples.sh` currently prints the four intended demo cases (OHRC↔NAC similar sun, TMC↔NAC scale, IIRS↔WAC cross-modal, opposite azimuth). Fill in product IDs after ISSDC/LROC accounts exist. Until then use `data_generation/` or files you already downloaded.


| Archive                                                                          | Role                                      |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| [PRADAN](https://pradan.issdc.gov.in/ch2/)                                       | Chandrayaan-2 OHRC / TMC-2 / IIRS (login) |
| [ISSDC MapBrowse](https://chmapbrowse.issdc.gov.in/)                             | Browse CH2 maps                           |
| [LROC](https://lroc.im-ldi.com/) / [QuickMap](https://quickmap.lroc.im-ldi.com/) | NAC / WAC                                 |
| [PDS Geosciences](https://pds-geosciences.wustl.edu/)                            | SLDEM2015 / LOLA if you need a DEM tile   |


Usage of those products follows ISRO / NASA public-data terms, not the MIT license of this code.

---



## 12. Stack

All of this is ordinary open-source. No paid CV SDK, no required cloud call after install.


| Layer            | Libraries                                      |
| ---------------- | ---------------------------------------------- |
| Raster / CRS     | rasterio, GDAL, pyproj, shapely                |
| Labels           | pvl (PDS3 / PDS4)                              |
| Vision           | OpenCV (SIFT, USAC_MAGSAC, warp), scikit-image |
| Learned matchers | PyTorch, LightGlue, Kornia LoFTR, XFeat        |
| IIRS-style MI    | SimpleITK                                      |
| API / UI         | FastAPI, Uvicorn, React, TypeScript, Vite      |
| Reports          | ReportLab, Matplotlib                          |
| Tests            | pytest                                         |


ISIS3, Ames Stereo Pipeline, and spiceypy are optional Tier-1 geometry. Default is affine-from-footprint plus the 2-D warp. That is image-to-image registration, not a full photogrammetric bundle.

---



## 13. Docs


| Path                                                                                   | Topic                         |
| -------------------------------------------------------------------------------------- | ----------------------------- |
| [docs/architecture.md](docs/architecture.md)                                           | Pair / Match / Product fields |
| [docs/gate_table.md](docs/gate_table.md)                                               | Routing notes                 |
| [docs/metrics.md](docs/metrics.md)                                                     | RMSE, inliers, NNI, coverage  |
| [docs/Project_Report.md](docs/Project_Report.md)                                       | Longer narrative              |
| [docs/COMPARATIVE_ANALYSIS_AND_BENEFITS.md](docs/COMPARATIVE_ANALYSIS_AND_BENEFITS.md) | Baseline discussion           |

---



## 14. License

Code in this repository: MIT (see [LICENSE](LICENSE)). Third-party wheels keep their own licences (BSD / Apache / MIT). Chandrayaan-2 and LRO imagery remain under ISRO / NASA data policy.
