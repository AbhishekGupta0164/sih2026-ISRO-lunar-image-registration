import React from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkbenchView } from '../../types';

const viewMeta: Record<WorkbenchView, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard Overview',    sub: 'SELENE Multi-Modal Lunar Registration Workbench' },
  upload:    { title: 'Image Pair Ingestion',   sub: 'Upload and inspect Reference & Target lunar image pairs' },
  register:  { title: 'Pipeline Alignment',    sub: 'Configure registration algorithms & homography parameters' },
  results:   { title: 'Visual Comparison',     sub: 'Interactive side-by-side & overlay curtain inspector' },
  matches:   { title: 'Feature Correspondences', sub: 'Inspect inlier keypoint correspondences and vectors' },
  metrics:   { title: 'Evaluation Metrics',    sub: 'RMSE, SSIM, PSNR, NMI & error distribution analytics' },
  exports:   { title: 'Geospatial Exports',    sub: 'Export GeoTIFF, PNG, GCP matrix, and PDF reports' },
  logs:      { title: 'System Telemetry Logs', sub: 'Real-time execution log feed & event history' },
  settings:  { title: 'Workbench Settings',     sub: 'System preferences & API backend endpoint setup' },
  about:     { title: 'About Project',         sub: 'ISRO Smart India Hackathon Lunar Registration Suite' },
};

export const Header: React.FC = () => {
  const { currentView, goHome, isProcessing, isComplete, results, theme, toggleTheme } = useApp();
  const meta = viewMeta[currentView] ?? { title: 'Workbench', sub: 'SELENE' };

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between px-6 bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 shadow-md transition-colors">
      {/* LEFT: Home navigation + Title Block */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={(e) => { e.preventDefault(); goHome(); }}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700"
          title="Back to Landing Page"
        >
          <ArrowLeft className="w-4 h-4 text-sky-600 dark:text-sky-400" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 id="header-title" className="text-slate-900 dark:text-white font-extrabold text-base tracking-tight truncate">
              {meta.title}
            </h2>
            {isProcessing && (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                Processing
              </span>
            )}
            {isComplete && !isProcessing && (
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Registration Complete
              </span>
            )}
          </div>
          <p id="header-subtitle" className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
            {meta.sub}
          </p>
        </div>
      </div>

      {/* RIGHT: Metric summary badge & Theme Switcher */}
      <div className="flex items-center gap-3 shrink-0 text-xs">
        {isComplete && (
          <div className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-mono text-xs shadow-sm">
            RMSE: <strong className="text-emerald-600 dark:text-emerald-400">{results.rmse} px</strong>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all shadow-sm"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>
    </header>
  );
};
