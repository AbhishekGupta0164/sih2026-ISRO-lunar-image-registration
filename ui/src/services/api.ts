/**
 * SeleneApiService
 *
 * All calls target https://sih2026-lunar-image-registration-1.onrender.com/api/v1 by default.
 * The base URL can be overridden from the Settings view.
 */
import { MatcherType, RegistrationResults } from '../types';

export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://sih2026-lunar-image-registration-1.onrender.com/api/v1';

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

  /** Poll a job until done; calls onStep for each new stage message. */
  public async pollJob(
    jobId: string,
    onStep: PipelineStepCallback,
    signal?: AbortSignal,
  ): Promise<JobStatus> {
    let stepIdx = 0;
    const STAGE_LABELS = [
      'Reading PDS3/PDS4/JSON labels and raster metadata…',
      'Building common-GSD pyramid and resampling both images…',
      'Preparing illumination-invariant representation and shadow masks…',
      'Gate selecting matcher from sensor / Sun-angle metadata…',
      'Generating candidate correspondences…',
      'Running USAC_MAGSAC++ robust geometry fit and removing outliers…',
      'Upscaling coordinates and refining GCPs with IC-LK…',
      'Sampling uniform GCPs across the 8×8 overlap grid…',
      'Warping source image and generating registered.tif, matches.csv and report…',
    ];

    return new Promise((resolve, reject) => {
      const tick = async () => {
        if (signal?.aborted) {
          reject(new Error('Cancelled'));
          return;
        }

        try {
          const status = await this.getJobStatus(jobId);

          // Derive step index from progress (0-1 → 0-8)
          const newStepIdx = Math.min(
            Math.round(status.progress * STAGE_LABELS.length),
            STAGE_LABELS.length - 1,
          );
          if (newStepIdx > stepIdx || (status.done && !status.error)) {
            // If the backend processed multiple stages between polls, emit all missed stages
            for (let i = stepIdx + 1; i <= newStepIdx; i++) {
              const label = (i === newStepIdx && status.stage) ? status.stage : (STAGE_LABELS[i] || 'Processing…');
              // Interpolate progress linearly for intermediate steps
              const simulatedProgress = Math.round((i / STAGE_LABELS.length) * 100);
              onStep(i, label, (i === newStepIdx) ? Math.round(status.progress * 100) : simulatedProgress);
            }
            stepIdx = newStepIdx;
          }

          if (status.done) {
            if (status.status === 'success') resolve(status);
            else reject(new Error(status.error || 'Pipeline failed'));
            return;
          }

          setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err) {
          reject(err);
        }
      };

      tick();
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
        residualHeatmapUrl: status.residual_heatmap_url,
      };
      return { results, jobId };
    }

    // ── Demo / simulation fallback (no files uploaded) ────────────────────
    const resolvedMatcher = this.resolveMatcher(matcher, sensor);
    const jobId = `demo_${Date.now()}`;
    const steps = [
      { msg: 'Reading PDS3/PDS4/JSON labels and raster metadata…',            delay: 650 },
      { msg: 'Building common-GSD pyramid and resampling both images…',        delay: 700 },
      { msg: 'Preparing illumination-invariant representation and shadow masks…', delay: 800 },
      { msg: `Gate selected ${this.getMatcherLabel(resolvedMatcher)} from sensor / Sun-angle metadata.`, delay: 650 },
      { msg: 'Generating candidate correspondences…',                          delay: 900 },
      { msg: 'Running USAC_MAGSAC++ robust geometry fit and removing outliers…', delay: 850 },
      { msg: 'Upscaling coordinates and refining GCPs with IC-LK ECC sub-pixel…', delay: 800 },
      { msg: 'Evaluating independent 80/20 train/validation GCP holdout RMSE…', delay: 650 },
      { msg: 'Sampling uniform GCPs across the 8×8 overlap grid…',            delay: 650 },
      { msg: 'Warping source and generating registered.tif, matches.csv and report…', delay: 700 },
    ];

    const startTime = performance.now();
    for (let i = 0; i < steps.length; i++) {
      if (signal?.aborted) throw new Error('Cancelled');
      onStep(i, steps[i].msg, Math.round(((i + 1) / steps.length) * 100));
      await new Promise((resolve) => setTimeout(resolve, steps[i].delay));
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    const results: RegistrationResults = {
      rmse: 0.68, rmseVal: 0.72, qualityGatePass: true,
      raw: 21389, inliers: 18742, ratio: 87.6,
      ce90: 0.91, nni: 0.84, coverage: 81, time: duration,
      method: `${this.getMatcherLabel(resolvedMatcher)} + IC-LK ECC Sub-Pixel`,
      matcherUsed: resolvedMatcher,
      jobId,
    };
    return { results, jobId };
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
