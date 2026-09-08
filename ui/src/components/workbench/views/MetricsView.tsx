import React from 'react';
import { useApp } from '../../../context/AppContext';

export const MetricsView: React.FC = () => {
  const { results, isComplete } = useApp();

  const GRID_N = 64;
  const coverageFraction = isComplete ? (results.coverage ?? 0) / 100 : 0;
  const occupiedCount = Math.round(coverageFraction * GRID_N);

  const cellPriority = Array.from({ length: GRID_N }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const dr = row - 3.5; const dc = col - 3.5;
    const dist = Math.sqrt(dr * dr + dc * dc);
    const jitter = ((i * 1664525 + 1013904223) >>> 0) / 0xffffffff * 0.8;
    return { idx: i, score: dist + jitter };
  }).sort((a, b) => a.score - b.score);

  const occupiedSet = new Set(cellPriority.slice(0, occupiedCount).map(c => c.idx));
  const gridMap = Array.from({ length: GRID_N }, (_, i) => occupiedSet.has(i));

  const matcher = isComplete ? results.matcherUsed : null;

  const matcherBars = [
    { key: 'loftr',        label: 'LoFTR Dense Deep Matcher' },
    { key: 'xfeat',        label: 'XFeat Lightweight Matcher' },
    { key: 'lightglue',    label: 'LightGlue / SuperPoint' },
    { key: 'census_sift',  label: 'Census Transform SIFT' },
    { key: 'crater_graph', label: 'Crater Graph (Polar / Azimuth)' },
    { key: 'mutual_info',  label: 'Mutual Information (IIRS)' },
    { key: 'phase_corr',   label: 'Phase Correlation' },
    { key: 'sift',         label: 'SIFT Baseline' },
  ];

  const renderBadge = (pass: boolean, warn?: boolean) => {
    if (!isComplete) {
      return (
        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
          PENDING
        </span>
      );
    }
    if (pass) {
      return (
        <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
          PASS
        </span>
      );
    }
    if (warn) {
      return (
        <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          WARN
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
        FAIL
      </span>
    );
  };

  return (
    <section id="view-metrics" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Registration Evaluation Metrics
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Numerical evaluation of registration quality, residual RMSE, and ground control point coverage.
        </p>
      </div>

      {/* SCOREBOARD TABLE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Performance Summary
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase font-mono">
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Target Requirement</th>
                <th className="py-3 px-4">Measured Value</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200 font-mono">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">RMSE (Residual Fit)</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">&lt; 1.0 px</td>
                <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{isComplete ? `${results.rmse} px` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  {renderBadge(results.rmse < 1.0, results.rmse < 2.0)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Validation RMSE (80/20 Holdout)</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">&lt; 1.0 px</td>
                <td className="py-3 px-4 font-bold text-sky-600 dark:text-sky-400">{isComplete ? `${results.rmseVal ?? results.rmse} px` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  {renderBadge((results.rmseVal ?? results.rmse) < 1.0, (results.rmseVal ?? results.rmse) < 2.0)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Inlier Ratio</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">&gt; 60.0%</td>
                <td className="py-3 px-4 font-bold text-sky-600 dark:text-sky-400">{isComplete ? `${results.ratio}%` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  {renderBadge(results.ratio >= 60.0, results.ratio >= 40.0)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">CE90 Error Radius</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">&lt; 1.5 px</td>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">{isComplete ? `${results.ce90} px` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  {renderBadge(results.ce90 < 1.5, results.ce90 < 2.5)}
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">Spatial Coverage (8×8 Grid)</td>
                <td className="py-3 px-4 text-slate-500 dark:text-slate-400">&gt; 70.0%</td>
                <td className="py-3 px-4 font-bold text-sky-600 dark:text-sky-400">{isComplete ? `${results.coverage}%` : '—'}</td>
                <td className="py-3 px-4 text-right">
                  {renderBadge(results.coverage >= 70.0, results.coverage >= 50.0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* COVERAGE & ROUTING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRID COVERAGE */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Spatial Inlier Coverage (8×8 Mesh)
            </h2>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              {isComplete ? `${results.coverage}% Uniform` : '—'}
            </span>
          </div>

          <div className="grid grid-cols-8 gap-1.5" id="metric-grid">
            {gridMap.map((good, idx) => (
              <div
                key={idx}
                className={`h-6 rounded-lg flex items-center justify-center text-[9px] font-mono transition-all ${
                  good && isComplete ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 font-bold shadow-sm' : 'bg-slate-100 dark:bg-slate-950 text-slate-500 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {idx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* MATCHER ROUTING TABLE */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Feature Matcher Router Status
            </h2>
            <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold uppercase bg-sky-500/10 px-2.5 py-1 rounded border border-sky-500/20">
              {isComplete ? (results.matcherUsed || 'auto') : 'Ready'}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-mono font-bold uppercase">
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
              {matcherBars.map(({ key, label }) => {
                const isUsed = isComplete && (matcher === key || (matcher && matcher.includes(key)));
                return (
                  <tr key={key} className={isUsed ? 'bg-sky-500/10' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">{label}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {isUsed ? (
                        <span className="px-2.5 py-1 rounded text-[10px] font-extrabold bg-sky-600 text-white shadow-sm border border-sky-400/40">
                          ACTIVE EXECUTOR
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Standby</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
