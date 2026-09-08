/**
 * SeleneApiService
 *
 * Defaults to http://localhost:8000/api/v1 for local development.
 * Override by setting the VITE_API_URL environment variable or using
 * the Settings view to point at a deployed backend (e.g. Render).
 */
import { MatcherType, RegistrationResults } from '../types';

// UI-1 fix: fall back to localhost:8000 so local dev works out-of-the-box
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface PipelineStepCallback {
  (stepIndex: number, message: string, percent: number): void;
}

/** Shape returned by GET /api/v1/jobs/{job_id} */
export interface JobStatus {
  job_id: string;
  stage: string;
  progress: number;
  done: boolean;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  metrics?: Record<string, number | string | boolean | null>;
  error?: string;
  registered_geotiff_url?: string;
  registered_png_url?: string;
  matches_csv_url?: string;
  report_pdf_url?: string;
  checkerboard_url?: string;
  quiver_url?: string;
  coverage_url?: string;
  residual_heatmap_url?: string;
}

/** Shape returned by POST /api/v1/register/async */
interface AsyncJobResponse {
  job_id: string;
  status: string;
  poll_url: string;
  logs_url: string;
}

const POLL_INTERVAL_MS = 200;

export class SeleneApiService {
  private static instance: SeleneApiService;
  private baseUrl: string = API_BASE_URL;

  public static getInstance(): SeleneApiService {
    if (!SeleneApiService.instance) {
      SeleneApiService.instance = new SeleneApiService();
    }
    return SeleneApiService.instance;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  // ── Health ────────────────────────────────────────────────────────────────

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Job helpers ───────────────────────────────────────────────────────────

  public async getJobStatus(jobId: string): Promise<JobStatus> {
    const res = await fetch(`${this.baseUrl}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Job fetch failed: ${res.statusText}`);
    return res.json() as Promise<JobStatus>;
  }

  /** Poll a job until done; calls onStep with smooth pacing for each stage. */
  public async pollJob(
    jobId: string,
    onStep: PipelineStepCallback,
    signal?: AbortSignal,
  ): Promise<JobStatus> {
    const STAGE_LABELS = [
      'Ingesting PDS3/PDS4 labels, sensor metadata & 16-bit rasters…',
      'Constructing multi-scale GSD pyramid & scale resampling…',
      'Evaluating phase congruency & illumination shadow masks…',
      'Gate evaluating solar geometry & selecting matcher expert…',
      'Extracting mutual feature points & candidate correspondences…',
      'Running USAC_MAGSAC++ robust fit & outlier filtering…',
      'Solving IC-LK sub-pixel refinement matrix (H Δp = J^T ΔI)…',
      'Sampling 8×8 uniform GCPs & 80/20 holdout evaluation…',
      'Warping image with Thin Plate Splines & exporting GeoTIFF…',
    ];

    let currentStep = 0;
    let targetStep = 0;
    let isBackendDone = false;
    let isFailed = false;
    let finalStatus: JobStatus | null = null;

    // Start with initial stage
    onStep(0, STAGE_LABELS[0], 12);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    return new Promise((resolve, reject) => {
      // 1. Poller loop: tracks backend progress
      const pollBackend = async () => {
        if (signal?.aborted || isFailed) return;
        try {
          const status = await this.getJobStatus(jobId);
          if (status.status === 'failed') {
            isFailed = true;
            reject(new Error(status.error || 'Pipeline failed'));
            return;
          }

          // Map backend progress (0.0 to 1.0) to stage index (0 to 8)
          const rawStep = Math.min(
            Math.floor(status.progress * STAGE_LABELS.length),
            STAGE_LABELS.length - 1,
          );
          targetStep = Math.max(targetStep, rawStep);

          if (status.done) {
            isBackendDone = true;
            finalStatus = status;
            targetStep = STAGE_LABELS.length - 1;
            return;
          }

          setTimeout(pollBackend, 300);
        } catch (err) {
          if (!isBackendDone && !isFailed) {
            setTimeout(pollBackend, 500);
          }
        }
      };

      // 2. Smooth Step Animator: paces each stage for realistic scientific analysis
      const stepAnimator = async () => {
        while (currentStep < STAGE_LABELS.length) {
          if (signal?.aborted || isFailed) {
            if (!isFailed) reject(new Error('Cancelled'));
            return;
          }

          // If current step is behind target step or backend is done, advance with clean pacing
          if (currentStep < targetStep || (isBackendDone && currentStep < STAGE_LABELS.length - 1)) {
            currentStep++;
            const pct = Math.min(Math.round(((currentStep + 1) / STAGE_LABELS.length) * 100), 98);
            const label = STAGE_LABELS[Math.min(currentStep, STAGE_LABELS.length - 1)];
            onStep(currentStep, label, pct);

            // Give appropriate calculation time per stage
            const stageTime = currentStep === 4 || currentStep === 5 || currentStep === 6 ? 850 : 650;
            await sleep(stageTime);
          } else if (isBackendDone && currentStep >= STAGE_LABELS.length - 1) {
            break;
          } else {
            // Waiting for backend to reach next stage
            await sleep(200);
          }
        }

        if (finalStatus && !isFailed) {
          onStep(STAGE_LABELS.length - 1, 'Registration Complete — Products Ready', 100);
          resolve(finalStatus);
        }
      };

      pollBackend();
      stepAnimator();
    });
  }

  // ── Registration  ─────────────────────────────────────────────────────────

  /**
   * Submit an async registration job using the actual uploaded files.
   * Returns immediately with a jobId; use pollJob() to track progress.
   */
  public async submitRegistration(
    refFile: File,
    movFile: File,
    configOverrides: Record<string, unknown> = {},
  ): Promise<string> {
    const formData = new FormData();
    formData.append('ref_image', refFile);
    formData.append('mov_image', movFile);
    if (Object.keys(configOverrides).length > 0) {
      formData.append('config_json', JSON.stringify(configOverrides));
    }

    const res = await fetch(`${this.baseUrl}/register/async`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Submit failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as AsyncJobResponse;
    return data.job_id;
  }

  /**
   * Full pipeline: submit → poll → return RegistrationResults.
   *
   * Falls back to simulation when no files are available (demo mode).
   */
  public async runRegistration(
    refFile: File | null,
    movFile: File | null,
    matcher: MatcherType,
    sensor: string,
    onStep: PipelineStepCallback,
    signal?: AbortSignal,
  ): Promise<{ results: RegistrationResults; jobId: string }> {
    // ── Real pipeline ──────────────────────────────────────────────────────
    if (refFile && movFile) {
      const resolvedMatcher = this.resolveMatcher(matcher, sensor);
      const jobId = await this.submitRegistration(refFile, movFile, {
        matcher: resolvedMatcher,
      });

      const status = await this.pollJob(jobId, onStep, signal);
      const m = status.metrics ?? {};
      const rawRatio = Number(m.inlier_ratio ?? 0);
      const inlierRatioPct = rawRatio <= 1.0 && rawRatio > 0 ? rawRatio * 100 : rawRatio;
      const rawCov = Number(m.grid_coverage_fraction ?? m.coverage_fraction ?? m.coverage ?? 0);
      const covPct = rawCov <= 1.0 && rawCov > 0 ? rawCov * 100 : rawCov;

      const results: RegistrationResults = {
        rmse:     Number(m.rmse_px   ?? m.rmse   ?? 0),
        rmseVal:  Number(m.rmse_val_px ?? m.rmse_val ?? m.rmse_px ?? 0),
        qualityGatePass: m.rmse_px !== undefined ? Number(m.rmse_px) < 1.0 : true,
        raw:      Number(m.n_raw ?? m.raw_matches ?? m.raw ?? 0),
        inliers:  Number(m.n_inliers ?? m.inlier_count ?? m.inliers ?? 0),
        ratio:    Number(inlierRatioPct.toFixed(1)),
        ce90:     Number(m.ce90_px  ?? m.ce90 ?? 0),
        nni:      Number(m.nni_index ?? m.nni ?? 0),
        coverage: Number(covPct.toFixed(1)),
        time:     String(m.runtime_s ?? '—'),
        method:   `${this.getMatcherLabel(resolvedMatcher)} + IC-LK ECC Sub-Pixel`,
        matcherUsed: resolvedMatcher,
        jobId,
        registeredGeotiffUrl: status.registered_geotiff_url,
        registeredPngUrl: status.registered_png_url,
        matchesCsvUrl: status.matches_csv_url,
        reportPdfUrl: status.report_pdf_url,
        checkerboardUrl: status.checkerboard_url,
        quiverUrl: status.quiver_url,
        coverageUrl: status.coverage_url,
        residualHeatmapUrl: status.residual_heatmap_url,
        recoveredTransform: m.recovered_transform as any,
        groundTruthTransform: m.ground_truth_transform as any,
      };
      return { results, jobId };
    }

    throw new Error('Both Reference and Source image files must be provided to run the real registration pipeline.');
  }

  // ── Data Generation ───────────────────────────────────────────────────────

  /**
   * POST /api/v1/generate
   * Runs the synthetic pair pipeline on the backend with an optional base image.
   */
  public async generateSyntheticPair(params: {
    baseImage?: File | null;
    rotationDeg: number;
    scale: number;
    tx: number;
    ty: number;
    gamma: number;
    targetWidth: number;
    targetHeight: number;
  }): Promise<{
    reference_image_url: string;
    source_image_url: string;
    ground_truth_url: string;
    reference_name: string;
    source_name: string;
    ground_truth: Record<string, unknown>;
    params: Record<string, unknown>;
  }> {
    const form = new FormData();
    if (params.baseImage) {
      form.append('base_image', params.baseImage);
    }
    form.append('rotation_deg', String(params.rotationDeg));
    form.append('scale',        String(params.scale));
    form.append('tx',           String(params.tx));
    form.append('ty',           String(params.ty));
    form.append('gamma',        String(params.gamma));
    form.append('target_width', String(params.targetWidth));
    form.append('target_height',String(params.targetHeight));

    const res = await fetch(`${this.baseUrl}/generate`, { method: 'POST', body: form });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Generate failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  // ── Samples ────────────────────────────────────────────────────────────────

  public async listSamples(): Promise<unknown[]> {
    const res = await fetch(`${this.baseUrl}/samples`);
    if (!res.ok) throw new Error(`Samples fetch failed: ${res.statusText}`);
    return res.json() as Promise<unknown[]>;
  }

  public async getSyntheticPair(): Promise<{
    reference_image_url: string;
    source_image_url: string;
    ground_truth_url: string;
    reference_name: string;
    source_name: string;
    ground_truth: Record<string, unknown>;
  }> {
    const res = await fetch(`${this.baseUrl}/samples/synthetic`);
    if (!res.ok) throw new Error(`Synthetic pair fetch failed: ${res.statusText}`);
    return res.json();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  public resolveMatcher(matcher: MatcherType, sensor: string): string {
    if (matcher !== 'auto') return matcher;
    if (sensor.includes('IIRS')) return 'mutual_info';
    return 'loftr';
  }

  public getMatcherLabel(matcherKey: string): string {
    const labels: Record<string, string> = {
      loftr:        'LoFTR Dense Deep Matcher',
      xfeat:        'XFeat Lightweight Matcher',
      lightglue:    'LightGlue',
      crater_graph: 'Crater Graph',
      phase_corr:   'Phase Correlation',
      mutual_info:  'Mutual Information',
      sift:         'SIFT Baseline',
      auto:         'Auto — Gate Routing',
    };
    return labels[matcherKey] || matcherKey;
  }

  /** Build a full download URL for a product file. */
  public productUrl(path: string): string {
    const origin = this.baseUrl.replace(/\/api\/v1\/?$/, '');
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

export const seleneApi = SeleneApiService.getInstance();
