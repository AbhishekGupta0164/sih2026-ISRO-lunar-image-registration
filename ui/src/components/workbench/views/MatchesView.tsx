import React, { useRef, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { CorrespondenceMatchesCanvas } from '../../common/CorrespondenceMatchesCanvas';

import { seleneApi } from '../../../services/api';

// ── Score histogram canvas ───────────────────────────────────────────────────
const ScoreHistogram: React.FC<{ inlierRatio: number }> = ({ inlierRatio }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060d18';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(146,196,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = H - (i / 4) * H;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Build histogram (10 bins: 0–0.1, 0.1–0.2, …)
    // Seeded deterministic distribution shaped by inlierRatio
    const bins = 10;
    const binW = W / bins;
    const heights: number[] = [];

    for (let b = 0; b < bins; b++) {
      const x = (b + 0.5) / bins; // bin centre
      // Inliers cluster near 1.0, outliers near 0.0–0.3
      const inlierDensity = Math.exp(-((x - 0.88) ** 2) / (2 * 0.04 ** 2));
      const outlierDensity = Math.exp(-((x - 0.18) ** 2) / (2 * 0.06 ** 2));
      heights.push(inlierRatio * inlierDensity + (1 - inlierRatio) * outlierDensity);
    }

    const maxH = Math.max(...heights);
    heights.forEach((h, b) => {
      const barH = (h / maxH) * (H - 18);
      const x = b * binW + 2;
      const isHigh = (b + 0.5) / bins > 0.55;
      const grad = ctx.createLinearGradient(x, H - barH, x, H);
      grad.addColorStop(0, isHigh ? 'rgba(62,230,160,0.9)' : 'rgba(255,182,92,0.8)');
      grad.addColorStop(1, isHigh ? 'rgba(31,174,116,0.3)' : 'rgba(200,120,40,0.2)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, H - barH, binW - 4, barH, [3, 3, 0, 0]);
      ctx.fill();
    });

    // X axis labels
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(146,196,255,0.5)';
    ctx.fillText('0', 2, H - 2);
    ctx.fillText('0.5', W / 2 - 8, H - 2);
    ctx.fillText('1.0', W - 16, H - 2);
  }, [inlierRatio]);

  return <canvas ref={canvasRef} width={340} height={90} className="w-full rounded-lg" />;
};

// ── Spatial heatmap of inlier distribution (8×8 grid) ───────────────────────
const InlierHeatmap: React.FC<{ inlierRatio: number; coveragePct: number }> = ({ inlierRatio, coveragePct }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const G = 8; const CW = canvas.width / G; const CH = canvas.height / G;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Seeded density per cell: cluster toward centre with some spread
    let seed = 0x12345;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };

    const targetOccupied = Math.round(coveragePct / 100 * 64);
    const densities: number[] = Array.from({ length: 64 }, (_, i) => {
      const row = Math.floor(i / G); const col = i % G;
      const dr = row - 3.5; const dc = col - 3.5;
      const dist = Math.sqrt(dr * dr + dc * dc);
      return Math.exp(-dist * 0.35) * (0.6 + rng() * 0.4);
    });

    const sorted = [...densities].sort((a, b) => b - a);
    const threshold = sorted[targetOccupied] ?? 0;

    densities.forEach((d, i) => {
      const row = Math.floor(i / G); const col = i % G;
      const x = col * CW; const y = row * CH;
      const active = d > threshold;
      const alpha = active ? Math.min(0.85, d * inlierRatio) : 0.04;
      ctx.fillStyle = active
        ? `rgba(62,230,160,${alpha})`
        : 'rgba(146,196,255,0.04)';
      ctx.fillRect(x + 1, y + 1, CW - 2, CH - 2);

      if (active) {
        ctx.strokeStyle = 'rgba(62,230,160,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, CW - 2, CH - 2);
      }
    });

    // Grid overlay
    ctx.strokeStyle = 'rgba(146,196,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= G; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CH); ctx.lineTo(canvas.width, r * CH); ctx.stroke();
    }
    for (let c = 0; c <= G; c++) {
      ctx.beginPath(); ctx.moveTo(c * CW, 0); ctx.lineTo(c * CW, canvas.height); ctx.stroke();
    }
  }, [inlierRatio, coveragePct]);

  return <canvas ref={canvasRef} width={160} height={160} className="rounded-lg border border-[rgba(146,196,255,0.1)]" />;
};

// ── Parameter recovery row ───────────────────────────────────────────────────
const ParamRow: React.FC<{
  label: string; gt: string; est: string; err: string; errNum: number; unit: string;
}> = ({ label, gt, est, err, errNum, unit }) => {
  const good = errNum < 1.5;
  return (
    <tr className="border-t border-[rgba(146,196,255,0.06)] text-[11px]">
      <td className="py-2 pr-3 text-slate-400 font-mono whitespace-nowrap">{label}</td>
      <td className="py-2 pr-3 text-slate-200 font-mono">{gt}{unit}</td>
      <td className="py-2 pr-3 font-mono" style={{ color: good ? '#3ee6a0' : '#ffb65c' }}>{est}{unit}</td>
      <td className="py-2 font-mono text-right">
        <span className={`badge text-[10px] ${good ? 'text-success border-success/30' : 'text-warning border-warning/30'}`}>
          Δ {err}{unit}
        </span>
      </td>
    </tr>
  );
};

// ── Main view ────────────────────────────────────────────────────────────────
export const MatchesView: React.FC = () => {
  const { results, referenceImage, sourceImage, isComplete } = useApp();

  const refUrl  = referenceImage?.previewUrl || '/synthetic/reference.png';
  const srcUrl  = sourceImage?.previewUrl    || '/synthetic/synthetic_target.png';
  const raw     = isComplete ? (results.raw || 0) : 0;
  const inliers = isComplete ? (results.inliers || 0) : 0;
  const ratio   = isComplete ? (results.ratio || 0) : 0;
  const outliers = Math.max(0, raw - inliers);
  const matcherName = isComplete ? (results.matcherUsed || 'auto') : 'Awaiting Execution';

  const rec = results.recoveredTransform;
  const gt = results.groundTruthTransform;
  const hasGt = Boolean(gt && gt.rotation_deg !== undefined);
  const hasRec = Boolean(rec && rec.rotation_deg !== undefined);

  const rotGtStr = gt?.rotation_deg !== undefined ? `${gt.rotation_deg}°` : 'Empirical (N/A)';
  const rotRecStr = rec?.rotation_deg !== undefined ? `${rec.rotation_deg}°` : '—';
  const rotErrStr = gt?.rotation_deg !== undefined && rec?.rotation_deg !== undefined
    ? `Δ ${Math.abs(rec.rotation_deg - gt.rotation_deg).toFixed(2)}°`
    : hasRec ? 'Estimated from GCPs' : '—';

  const scaleGtStr = gt?.scale !== undefined ? `${gt.scale}×` : 'Empirical (N/A)';
  const scaleRecStr = rec?.scale !== undefined ? `${rec.scale}×` : '—';
  const scaleErrStr = gt?.scale !== undefined && rec?.scale !== undefined
    ? `Δ ${Math.abs(rec.scale - gt.scale).toFixed(3)}×`
    : hasRec ? 'Estimated from GCPs' : '—';

  const txGtStr = gt?.tx_px !== undefined ? `${gt.tx_px} px` : 'Empirical (N/A)';
  const txRecStr = rec?.tx_px !== undefined ? `${rec.tx_px} px` : '—';
  const txErrStr = gt?.tx_px !== undefined && rec?.tx_px !== undefined
    ? `Δ ${Math.abs(rec.tx_px - gt.tx_px).toFixed(1)} px`
    : hasRec ? 'Estimated from GCPs' : '—';

  const tyGtStr = gt?.ty_px !== undefined ? `${gt.ty_px} px` : 'Empirical (N/A)';
  const tyRecStr = rec?.ty_px !== undefined ? `${rec.ty_px} px` : '—';
  const tyErrStr = gt?.ty_px !== undefined && rec?.ty_px !== undefined
    ? `Δ ${Math.abs(rec.ty_px - gt.ty_px).toFixed(1)} px`
    : hasRec ? 'Estimated from GCPs' : '—';

  return (
    <section id="view-matches" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Feature Correspondences
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Inspect keypoint correspondence vectors, MAGSAC++ inlier filtering, and geometric transformation residuals.
        </p>
      </div>

      {/* TOP KPIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Raw Matches</div>
          <div id="match-raw" className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono mt-1">
            {isComplete ? raw.toLocaleString() : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">Before filtering</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Robust Inliers</div>
          <div id="match-inliers" className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {isComplete ? inliers.toLocaleString() : '—'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">After MAGSAC++</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Inlier Ratio</div>
          <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 font-mono mt-1">
            {isComplete ? `${ratio.toFixed(1)}%` : '—'}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-800 mt-2">
            <div className="h-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" style={{ width: `${ratio}%` }} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl transition-colors">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selected Matcher</div>
          <div id="match-method" className="text-lg font-extrabold text-sky-600 dark:text-sky-300 font-mono mt-1 uppercase truncate">
            {matcherName.replace(/_/g, ' ')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">Gate-routed engine</div>
        </div>
      </div>

      {/* CORRESPONDENCE CANVAS */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <div className="flex justify-between items-center flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Keypoint Correspondence Canvas
          </h2>
          <div className="flex gap-2 font-mono text-xs">
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
              Inliers: {isComplete ? inliers.toLocaleString() : '0'}
            </span>
            <span className="px-3 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
              Outliers: {isComplete ? outliers.toLocaleString() : '0'}
            </span>
          </div>
        </div>

        <CorrespondenceMatchesCanvas
          refUrl={refUrl}
          srcUrl={srcUrl}
          inliersCount={inliers}
          rawMatchesCount={raw}
          matcherName={matcherName}
          rotationDeg={rec?.rotation_deg ?? (gt?.rotation_deg ?? 0)}
          scaleFactor={rec?.scale ?? (gt?.scale ?? 1.0)}
          txPx={rec?.tx_px ?? (gt?.tx_px ?? 0)}
          tyPx={rec?.ty_px ?? (gt?.ty_px ?? 0)}
          matchesCsvUrl={results.matchesCsvUrl ? seleneApi.productUrl(results.matchesCsvUrl) : undefined}
        />
      </div>

      {/* PARAMETER RECOVERY TABLE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Geometric Transformation Recovery Benchmark
          </h2>
          <span className="text-xs font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded border border-sky-500/20">
            {hasGt ? 'Synthetic Ground Truth Verification' : hasRec ? 'Empirical Homography Estimation' : 'Awaiting Run'}
          </span>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold uppercase">
              <th className="py-2.5 px-4">Parameter</th>
              <th className="py-2.5 px-4">Ground Truth</th>
              <th className="py-2.5 px-4">Recovered Value</th>
              <th className="py-2.5 px-4 text-right">Residual Error</th>
            </tr>
          </thead>
          <tbody className="font-mono text-slate-800 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800/80">
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Rotation</td>
              <td className="py-3 px-4">{rotGtStr}</td>
              <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{rotRecStr}</td>
              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {rotErrStr}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Scale Factor</td>
              <td className="py-3 px-4">{scaleGtStr}</td>
              <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{scaleRecStr}</td>
              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {scaleErrStr}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Translation X</td>
              <td className="py-3 px-4">{txGtStr}</td>
              <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{txRecStr}</td>
              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {txErrStr}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Translation Y</td>
              <td className="py-3 px-4">{tyGtStr}</td>
              <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{tyRecStr}</td>
              <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {tyErrStr}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};
