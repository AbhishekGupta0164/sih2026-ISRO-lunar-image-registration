import React from 'react';
import {
  CheckCircle,
  Layers,
  Maximize2,
  Target,
  Clock,
  UploadCloud,
  Share2,
  CheckCircle2,
  Sun,
  Scale,
  Compass,
  KeyRound,
  Upload,
  ExternalLink,
  SlidersHorizontal,
  ArrowRight,
  Zap,
  Shield,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  color: 'sky' | 'emerald' | 'amber' | 'slate';
}> = ({ label, value, sub, icon: Icon, color }) => {
  const colorMap = {
    sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     text: 'text-sky-400' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400' },
    slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   text: 'text-slate-400' },
  };
  const c = colorMap[color];

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm flex items-start justify-between gap-4">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          {label}
        </span>
        <div className="text-xl font-bold text-white mt-1">
          {value}
        </div>
        <p className="text-xs text-slate-500 mt-1 font-mono">{sub}</p>
      </div>

      <div className={`p-2.5 rounded-lg ${c.bg} border ${c.border} ${c.text} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
};

const StepCard: React.FC<{
  n: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  last?: boolean;
}> = ({ n, title, desc, icon: Icon, last }) => (
  <div className="relative flex flex-col items-center text-center group">
    <div className="relative z-10 p-3.5 rounded-2xl bg-gradient-to-b from-[rgba(57,168,255,0.12)] to-[rgba(57,168,255,0.04)] border border-blue-400/20 text-blue-400 mb-3 transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(57,168,255,0.25)] group-hover:border-blue-400/40">
      <Icon className="w-5 h-5" />
    </div>
    {!last && (
      <div className="hidden sm:block absolute top-6 left-[calc(50%+28px)] right-0 h-[1px]">
        <div className="w-full h-full bg-gradient-to-r from-[rgba(111,246,255,0.3)] to-transparent relative overflow-hidden">
          <div className="absolute inset-y-[-1px] w-6 bg-cyan-400/80 rounded-full animate-[flowx_2s_linear_infinite]" />
        </div>
      </div>
    )}
    <span className="font-mono text-[10px] font-bold text-cyan-400/60 tracking-[0.18em] mb-1">{n}</span>
    <div className="text-white text-[13px] font-bold font-display tracking-wide">{title}</div>
    <div className="text-[10.5px] text-slate-500 font-mono mt-1 leading-relaxed">{desc}</div>
  </div>
);

const ChallengeRow: React.FC<{ icon: React.ElementType; label: string; desc: string }> = ({ icon: Icon, label, desc }) => (
  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[rgba(6,12,22,0.5)] border border-[rgba(146,196,255,0.07)] hover:border-amber-500/20 hover:bg-amber-500/4 transition-all duration-200">
    <div className="p-2 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-400 shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <div className="text-amber-400 font-mono text-[9.5px] font-bold tracking-[0.18em] uppercase">{label}</div>
      <p className="text-slate-500 font-mono text-[10.5px] mt-1 leading-relaxed">{desc}</p>
    </div>
  </div>
);

export const DashboardView: React.FC = () => {
  const { navigateTo, isProcessing, isComplete, results } = useApp();

  return (
    <section id="view-dashboard" className="view-section active space-y-6">

      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            System Overview &amp; Status
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Smart India Hackathon 2026 · Problem Statement 26166 · ISRO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('upload')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20 border border-sky-400/30"
          >
            Upload Image Pair
          </button>
          <button
            onClick={() => navigateTo('register')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
          >
            Configure Registration
          </button>
        </div>
      </div>

      {/* SYSTEM INFORMATION TABLE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          System Information
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase font-mono">
                <th className="py-3 px-4 w-1/3">Parameter</th>
                <th className="py-3 px-4">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Supported Sensors</td>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Chandrayaan-2 OHRC (0.25m GSD), TMC-2 (5m GSD), IIRS (80m GSD)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Reference Dataset</td>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">LRO NAC (~0.5m GSD) / LRO WAC (~100m GSD)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Scale Disparity Range</td>
                <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">Up to 320× GSD Mismatch Handled</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Target Accuracy</td>
                <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">&lt; 0.5 px RMSE (Sub-pixel Accurate)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">Current Pipeline Status</td>
                <td className="py-3 px-4">
                  {isProcessing ? (
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Processing Pipeline...
                    </span>
                  ) : isComplete ? (
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Registration Complete ({results.method})
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                      Ready (Awaiting Image Pair)
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CORE CAPABILITIES & WORKFLOW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WORKFLOW */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
            Processing Workflow
          </h2>
          <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 list-decimal list-inside font-medium leading-relaxed">
            <li><strong className="text-sky-600 dark:text-sky-400">Image Ingestion:</strong> Load Reference &amp; Target PDS3/PDS4/GeoTIFF rasters</li>
            <li><strong className="text-sky-600 dark:text-sky-400">Pyramid Equalization:</strong> Common meter/pixel GSD resampling</li>
            <li><strong className="text-sky-600 dark:text-sky-400">Feature Matching:</strong> Gate router selects SIFT, ORB, SuperPoint or LOFTR</li>
            <li><strong className="text-sky-600 dark:text-sky-400">Geometric Warping:</strong> MAGSAC++ outlier filter &amp; Thin Plate Splines</li>
            <li><strong className="text-sky-600 dark:text-sky-400">Sub-pixel Refinement:</strong> IC-LK optical flow optimization</li>
            <li><strong className="text-sky-600 dark:text-sky-400">Export Deliverables:</strong> Warped GeoTIFF, GCP CSV &amp; PDF Report</li>
          </ol>
        </div>

        {/* CORE CAPABILITIES */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
            Core Capabilities
          </h2>
          <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
            <li className="pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
              <strong className="text-slate-900 dark:text-white block mb-0.5">Illumination Invariance:</strong>
              Handles severe solar elevation/azimuth disparity across lunar phase angles.
            </li>
            <li className="pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
              <strong className="text-slate-900 dark:text-white block mb-0.5">Scale Invariance:</strong>
              Aligns optical datasets captured at 0.25m (OHRC) to 80m (IIRS) GSD.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-white block mb-0.5">Piecewise Alignment:</strong>
              Non-rigid Thin Plate Splines correct localized crater rim topography shifts.
            </li>
          </ul>
        </div>
      </div>

      {/* REGISTRATION METRICS TABLE (When complete) */}
      {isComplete && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/90 border border-emerald-500/40 space-y-4 shadow-xl transition-colors">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Latest Registration Metrics ({results.method})
            </h2>
            <span className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800">Job ID: {results.jobId}</span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                <th className="py-2.5 px-3">RMSE</th>
                <th className="py-2.5 px-3">Raw Matches</th>
                <th className="py-2.5 px-3">Inliers</th>
                <th className="py-2.5 px-3">Inlier Ratio</th>
                <th className="py-2.5 px-3">CE90 Error</th>
                <th className="py-2.5 px-3">Runtime</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-800 dark:text-slate-200">
              <tr>
                <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">{results.rmse} px</td>
                <td className="py-2.5 px-3">{results.raw}</td>
                <td className="py-2.5 px-3 font-bold text-sky-600 dark:text-sky-400">{results.inliers}</td>
                <td className="py-2.5 px-3">{results.ratio}%</td>
                <td className="py-2.5 px-3">{results.ce90} px</td>
                <td className="py-2.5 px-3">{results.time}s</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </section>
  );
};
