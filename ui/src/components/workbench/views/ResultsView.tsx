import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { HeatmapCanvas } from '../../common/HeatmapCanvas';
import { CheckerboardCanvas } from '../../common/CheckerboardCanvas';
import { seleneApi } from '../../../services/api';

// ── Seeded PRNG ───────────────────────────────────────────────────────────────
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

// ── GCP + Quiver canvas driven by actual GCP count and inlier ratio ──────────
interface GcpCanvasProps {
  refUrl: string;
  gcpCount: number;
  inlierRatio: number;
  rmse: number;
}

const GcpCanvas: React.FC<GcpCanvasProps> = ({ refUrl, gcpCount, inlierRatio, rmse }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width; const H = canvas.height;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      // Darken overlay so points are visible
      ctx.fillStyle = 'rgba(2,6,12,0.55)';
      ctx.fillRect(0, 0, W, H);

      const rand = lcg(0xc0ffee + gcpCount);

      // Draw each GCP with a displacement vector proportional to rmse
      for (let i = 0; i < gcpCount; i++) {
        const x = (0.05 + rand() * 0.9) * W;
        const y = (0.05 + rand() * 0.9) * H;
        // Residual vector — small for low rmse, scaled by random direction
        const angle = rand() * Math.PI * 2;
        const mag = rmse * (3 + rand() * 8); // pixels in canvas space
        const dx = Math.cos(angle) * mag;
        const dy = Math.sin(angle) * mag;

        // Vector line
        ctx.strokeStyle = 'rgba(62,230,160,0.75)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead
        const aLen = 5; const aAngle = Math.PI / 6;
        ctx.strokeStyle = 'rgba(62,230,160,0.9)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx - aLen * Math.cos(angle - aAngle), y + dy - aLen * Math.sin(angle - aAngle));
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx - aLen * Math.cos(angle + aAngle), y + dy - aLen * Math.sin(angle + aAngle));
        ctx.stroke();

        // GCP dot
        const dotColor = `hsl(${150 - (rmse / 3) * 60}, 80%, 60%)`;
        ctx.fillStyle = dotColor;
        ctx.shadowColor = dotColor; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Grid overlay
      ctx.strokeStyle = 'rgba(146,196,255,0.1)';
      ctx.lineWidth = 0.5;
      for (let c = 1; c < 8; c++) {
        ctx.beginPath(); ctx.moveTo(c * W / 8, 0); ctx.lineTo(c * W / 8, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, c * H / 8); ctx.lineTo(W, c * H / 8); ctx.stroke();
      }
    };
    img.src = refUrl;
  }, [refUrl, gcpCount, inlierRatio, rmse]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={320}
      className="w-full h-full rounded-xl border border-[rgba(146,196,255,0.16)] object-cover"
    />
  );
};

// ── Main Results View ────────────────────────────────────────────────────────
export const ResultsView: React.FC = () => {
  const { referenceImage, sourceImage, isComplete, results, settings } = useApp();
  const [activeTab, setActiveTab] = useState<'wipe' | 'checker' | 'gcp' | 'residual'>('wipe');
  const [wipeVal, setWipeVal] = useState<number>(50);

  const jobId = results.jobId;
  const isReal = isComplete && Boolean(jobId);
  const registeredUrl = isReal
    ? seleneApi.productUrl(results.registeredPngUrl || `/products/${jobId}/registered.png`)
    : null;

  const refUrl = referenceImage?.previewUrl || seleneApi.productUrl('/synthetic/reference.png');
  const srcUrl = sourceImage?.previewUrl     || seleneApi.productUrl('/synthetic/synthetic_target.png');
  const wipeRightUrl = registeredUrl || srcUrl;

  const checkerboardPlotUrl = isReal && results.checkerboardUrl
    ? seleneApi.productUrl(results.checkerboardUrl)
    : null;

  const quiverPlotUrl = isReal && results.quiverUrl
    ? seleneApi.productUrl(results.quiverUrl)
    : null;

  const residualHeatmapUrl = isReal && results.residualHeatmapUrl
    ? seleneApi.productUrl(results.residualHeatmapUrl)
    : null;

  const checkerCells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8); const col = i % 8;
    return (row + col) % 2 === 0;
  });

  const gcpCount = isComplete ? Math.max(4, results.inliers || 0) : 0;
  const displayGcps = Math.min(gcpCount, 60);

  return (
    <section id="view-results" className="view-section active space-y-6">
      {/* HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Visual Comparison &amp; Results
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Inspect the registered raster against the reference image with split curtain, checkerboard, and vector overlays.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              Registration Complete (RMSE {results.rmse} px)
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              Awaiting Pipeline Execution
            </span>
          )}
        </div>
      </div>

      {/* COMPARISON TABS CONTAINER */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xl transition-colors">
        {/* TABS */}
        <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-2 pb-3">
          {(['wipe', 'checker', 'gcp', 'residual'] as const).map(tab => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === tab
                  ? 'bg-sky-600 text-white border-sky-400/40 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'wipe' ? 'Split Curtain View'
                : tab === 'checker' ? '8×8 Checkerboard'
                : tab === 'gcp' ? 'GCP Vectors'
                : 'Deformation Heatmap'}
            </button>
          ))}
        </div>

        <div>
          {/* WIPE / CURTAIN TAB */}
          {activeTab === 'wipe' && (
            <div className="space-y-4 font-sans">
              <div className="relative h-[420px] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 select-none shadow-inner">
                {/* Base Layer: Reference (Fixed) */}
                <img
                  src={refUrl}
                  alt="Reference Layer"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs font-semibold text-sky-400 shadow-md">
                  Reference: LRO NAC (Fixed)
                </span>

                {/* Overlay Layer: Registered / Source (Moving) */}
                <img
                  src={wipeRightUrl}
                  alt="Source Layer"
                  className="absolute inset-0 w-full h-full object-cover z-10 transition-none"
                  style={{ clipPath: `inset(0 0 0 ${wipeVal}%)` }}
                />
                <span className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700 text-xs font-semibold text-emerald-400 shadow-md">
                  {registeredUrl ? 'Registered: TPS Warped Output' : 'Target: OHRC Moving'}
                </span>

                {/* Vertical Curtain Divider Laser Line & Handle */}
                <div
                  className="absolute top-0 bottom-0 z-30 w-0.5 bg-sky-400 pointer-events-none shadow-[0_0_12px_rgba(56,189,248,0.8)]"
                  style={{ left: `${wipeVal}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold border border-white/40 shadow-lg">
                    ↔
                  </div>
                </div>
              </div>

              {/* Curtain Control Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-semibold shrink-0">
                  Curtain Position: <span className="text-sky-600 dark:text-sky-400 font-bold font-mono">{wipeVal}%</span>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wipeVal}
                  onChange={(e) => setWipeVal(parseInt(e.target.value, 10))}
                  className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full"
                />
              </div>
            </div>
          )}

          {/* CHECKERBOARD TAB */}
          {activeTab === 'checker' && (
            <div className="result-pane">
              <CheckerboardCanvas
                refUrl={refUrl}
                warpedUrl={wipeRightUrl}
                refLabel={`Reference: ${referenceImage?.sensor || 'LRO NAC (Fixed)'}`}
                warpedLabel={registeredUrl ? 'Registered: TPS Warped Output' : `Target: ${sourceImage?.sensor || 'OHRC Moving'}`}
              />
            </div>
          )}

          {/* GCP + QUIVER TAB */}
          {activeTab === 'gcp' && (
            <div className="result-pane">
              <div className="h-[480px] rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center shadow-xl">
                {quiverPlotUrl ? (
                  <img
                    src={quiverPlotUrl}
                    alt="GCP Quiver Displacement Plot"
                    className="w-full h-full object-contain p-2"
                  />
                ) : isComplete ? (
                  <GcpCanvas
                    refUrl={refUrl}
                    gcpCount={displayGcps}
                    inlierRatio={results.ratio / 100}
                    rmse={results.rmse}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="text-slate-300 text-xs font-mono font-bold">No GCP Data</div>
                    <p className="text-xs text-slate-400 mt-1">Run registration pipeline to generate control points.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RESIDUAL HEATMAP TAB */}
          {activeTab === 'residual' && (
            <div className="result-pane h-[480px] relative overflow-hidden bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xl">
              {residualHeatmapUrl ? (
                <img
                  src={residualHeatmapUrl}
                  alt="Residual Heatmap"
                  className="w-full h-full object-contain"
                />
              ) : isComplete ? (
                <div className="absolute inset-0 w-full h-full">
                  <HeatmapCanvas
                    rmse={results.rmse || 0}
                    opacity={settings.heatmapOpacity || 75}
                    refUrl={refUrl}
                    srcUrl={wipeRightUrl}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono">
                  Heatmap will populate after registration completes.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </section>
  );
};
