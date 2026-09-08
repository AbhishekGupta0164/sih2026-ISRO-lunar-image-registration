import React, { useState } from 'react';
import {
  Play,
  Database,
  Layers,
  Sliders,
  Cpu,
  Zap,
  Filter,
  Crosshair,
  Grid,
  Package,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { MatcherType } from '../../../types';

interface StageDetail {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  description: string;
  kpis: { label: string; value: string; color?: string }[];
  accentColor: string;
  badgeBg: string;
}

const STAGE_DETAILS: StageDetail[] = [
  {
    id: '01',
    name: 'Ingest & Validation',
    subtitle: 'OK - SOURCE RASTER',
    icon: Database,
    description: 'Ingesting PDS3/PDS4 labels, sensor metadata (LRO NAC / C-2 OHRC), and 16-bit floating-point rasters.',
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    kpis: [
      { label: 'SOURCE FORMAT', value: 'GeoTIFF / PNG 16-bit' },
      { label: 'REFERENCE SENSOR', value: 'LRO NAC (0.50 m/px)' },
      { label: 'SUN ELEVATION', value: '34.5° vs 32.1°' },
      { label: 'RASTER DIMENSIONS', value: '1024 × 1024 px' },
    ],
  },
  {
    id: '02',
    name: 'GSD Resampling',
    subtitle: 'OK - PYRAMID SCALING',
    icon: Layers,
    description: 'Constructing multi-scale Gaussian pyramids & resampling both images to a uniform GSD grid.',
    accentColor: '#818cf8',
    badgeBg: 'rgba(129, 140, 248, 0.15)',
    kpis: [
      { label: 'SOURCE GSD', value: '0.25 m/px' },
      { label: 'REF GSD', value: '0.50 m/px' },
      { label: 'COMMON GSD TARGET', value: '0.50 m/px' },
      { label: 'PYRAMID LEVELS', value: '3 Scales (1×, 0.5×, 0.25×)' },
    ],
  },
  {
    id: '03',
    name: 'Equalization & Shadows',
    subtitle: 'OK - WALLIS FILTER',
    icon: Sliders,
    description: 'Phase congruency edge extraction & Wallis adaptive histogram equalization for high illumination invariance.',
    accentColor: '#f472b6',
    badgeBg: 'rgba(244, 114, 182, 0.15)',
    kpis: [
      { label: 'PHASE CONGRUENCY', value: 'Active (3 Scales, 6 Oris)' },
      { label: 'WALLIS WINDOW', value: '32 × 32 px' },
      { label: 'DYNAMIC RANGE', value: 'Normalized [0.0, 1.0]' },
      { label: 'SHADOW MASK', value: 'Thresholded < 0.05' },
    ],
  },
  {
    id: '04',
    name: 'Gate Router',
    subtitle: 'OK - EXPERT ROUTING',
    icon: Cpu,
    description: 'Evaluating orbital solar geometry & sensor modality matrix to select the optimal neural matcher expert.',
    accentColor: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.15)',
    kpis: [
      { label: 'Δ SUN AZIMUTH', value: '14.2° (Normal Light)' },
      { label: 'GSD RATIO', value: '1.00 (Matched)' },
      { label: 'SELECTED MATCHER', value: 'LoFTR / LightGlue', color: '#c084fc' },
      { label: 'EXPERT ROUTE CONF', value: '98.4%' },
    ],
  },
  {
    id: '05',
    name: 'Matcher Core',
    subtitle: 'CONVERGENCE PASS',
    icon: Zap,
    description: 'Extracting high-density candidate feature points & computing mutual neural correspondence vectors.',
    accentColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    kpis: [
      { label: 'RAW MATCHES', value: '21,389 Points', color: '#38bdf8' },
      { label: 'EXTRACTOR', value: 'SuperPoint / ALIKED' },
      { label: 'GPU MEMORY', value: '1.42 GB VRAM' },
      { label: 'EXTRACTION SPEED', value: '142 ms' },
    ],
  },
  {
    id: '06',
    name: 'MAGSAC++ Filtering',
    subtitle: 'OK - OUTLIER REMOVAL',
    icon: Filter,
    description: 'USAC_MAGSAC++ marginalizing sample consensus for robust spatial outlier elimination & matrix estimation.',
    accentColor: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    kpis: [
      { label: 'ROBUST INLIERS', value: '18,742 Points', color: '#34d399' },
      { label: 'INLIER RATIO', value: '87.6%', color: '#34d399' },
      { label: 'REJECTION RATE', value: '12.4% Outliers' },
      { label: 'CONVERGENCE ITERS', value: '100 / 100 Runs' },
    ],
  },
  {
    id: '07',
    name: 'IC-LK Refinement',
    subtitle: 'OK - SUB-PIXEL LOCK',
    icon: Crosshair,
    description: 'Inverse-Compositional Lucas-Kanade 21×21 sub-pixel refinement matrix solving H Δp = J^T ΔI.',
    accentColor: '#22d3ee',
    badgeBg: 'rgba(34, 211, 238, 0.15)',
    kpis: [
      { label: 'SUB-PIXEL RMSE', value: '0.062 px', color: '#22d3ee' },
      { label: 'PREVIOUS COARSE', value: '1.240 px' },
      { label: 'ERROR REDUCTION', value: '↓ 95.0% Drop', color: '#34d399' },
      { label: 'IC-LK ITERS', value: '14.2 / 30 iters' },
    ],
  },
  {
    id: '08',
    name: 'GCP Validation',
    subtitle: 'ERRORS: 0.68 px',
    icon: Grid,
    description: 'Evaluating uniform 8×8 grid coverage & 80/20 train/validation independent holdout ground control points.',
    accentColor: '#fbbf24',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    kpis: [
      { label: 'TRAIN RMSE', value: '0.68 px', color: '#fbbf24' },
      { label: 'VAL HOLDOUT RMSE', value: '0.72 px' },
      { label: 'COVERAGE INDEX', value: '81% Spatial Mesh' },
      { label: 'UNIFORMITY NNI', value: '0.84 (Well-Clustered)' },
    ],
  },
  {
    id: '09',
    name: 'Export Products',
    subtitle: 'DONE - 4 PRODUCTS',
    icon: Package,
    description: 'Warping source raster with Thin Plate Splines & generating registered GeoTIFF, CSV matches, and PDF report.',
    accentColor: '#4ade80',
    badgeBg: 'rgba(74, 222, 128, 0.15)',
    kpis: [
      { label: 'GEOTIFF OUTPUT', value: 'registered.tif (16.4 MB)', color: '#4ade80' },
      { label: 'TELEMETRY CSV', value: 'matches.csv (2.1 MB)' },
      { label: 'PDF REPORT', value: 'Selene_Report.pdf' },
      { label: 'QUALITY GATE', value: '✓ PASSED (< 1.0 px)', color: '#4ade80' },
    ],
  },
];

export const RegisterView: React.FC = () => {
  const {
    selectedMatcher,
    setSelectedMatcher,
    geometryModel,
    setGeometryModel,
    runRegistration,
    isProcessing,
    pipelineProgress,
    activeStepIndex,
    logs,
  } = useApp();

  const [stepStage, setStepStage] = useState('0 - 0');
  const [pairInstance, setPairInstance] = useState('2');

  return (
    <section id="view-register" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Registration Configuration
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Configure registration hyperparameters, matcher model, and geodetic transformation parameters.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">Status:</span>
          <span className={`font-semibold px-3 py-1 rounded-lg text-xs ${isProcessing ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30' : pipelineProgress === 100 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'}`}>
            {isProcessing ? 'Executing Pipeline...' : pipelineProgress === 100 ? 'Pipeline Complete' : 'Ready'}
          </span>
        </div>
      </div>

      {/* CONFIGURATION FORM CARD */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xl transition-colors">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
          Pipeline Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Pipeline Stage
            </label>
            <select
              value={stepStage}
              onChange={(e) => setStepStage(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none font-medium"
            >
              <option value="0 - 0">0 - 0 (Full Automatic 9-Stage)</option>
              <option value="0 - 4">0 - 4 (Initial Match Only)</option>
              <option value="0 - 8">0 - 8 (Full Registration Pipeline)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Image Pair
            </label>
            <select
              value={pairInstance}
              onChange={(e) => setPairInstance(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none font-medium"
            >
              <option value="2">Pair #2 (OHRC 0.25 m / LRO NAC 0.50 m)</option>
              <option value="1">Pair #1 (TMC-2 5.0 m / WAC 100 m)</option>
              <option value="3">Pair #3 (IIRS Hyperspectral / TMC-2)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Feature Matcher Model
            </label>
            <select
              value={selectedMatcher}
              onChange={(e) => setSelectedMatcher(e.target.value as MatcherType)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-sky-600 dark:text-sky-300 font-semibold focus:border-sky-500 focus:outline-none"
            >
              <option value="auto">Auto – Intelligent Gate Routing</option>
              <option value="loftr">LoFTR Dense Deep Matcher</option>
              <option value="xfeat">XFeat Lightweight Matcher</option>
              <option value="lightglue">LightGlue (ALIKED/SuperPoint)</option>
              <option value="crater_graph">Crater Graph (Polarity Invariant)</option>
              <option value="phase_corr">Phase Correlation (FFT Translation)</option>
              <option value="mutual_info">Mutual Information (Cross-Sensor)</option>
              <option value="sift">SIFT Baseline</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
              Geodetic Model
            </label>
            <select
              value={geometryModel}
              onChange={(e) => setGeometryModel(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none font-medium"
            >
              <option value="DEM + Map Projection (Tier 2)">DEM – Map Projection</option>
              <option value="ISIS/SPICE (Tier 1)">ISIS/SPICE Camera Model</option>
              <option value="Selenographic Sphere (Tier 3)">Selenographic Ellipsoid</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-4">
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Selected Engine: <strong className="text-sky-600 dark:text-sky-400">{selectedMatcher === 'auto' ? 'Auto Routing' : selectedMatcher.toUpperCase()}</strong>
          </span>

          <button
            onClick={() => runRegistration()}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-lg shadow-sky-600/25 border border-sky-400/30 disabled:opacity-50"
          >
            {isProcessing ? 'Processing Pipeline...' : 'Run Registration'}
          </button>
        </div>
      </div>

      {/* PIPELINE PROGRESS TABLE */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Pipeline Progress
          </h2>
          <span className="text-xs font-mono text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-3 py-1 rounded border border-sky-500/20">
            {pipelineProgress}% Completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all duration-300 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
            style={{ width: `${pipelineProgress}%` }}
          />
        </div>

        {/* Exporting Notice */}
        {isProcessing && pipelineProgress >= 80 && (
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl flex items-center gap-2">
            <span className="animate-spin text-sm">⚙️</span>
            <span>Exporting full-resolution GeoTIFF, PNG preview, metric plots, and PDF report. Large rasters (up to 10+ Megapixels) take 20–40 seconds to warp and encode to disk.</span>
          </div>
        )}

        {/* Pipeline Stages Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase font-mono">
                <th className="py-3 px-4 w-16">Stage</th>
                <th className="py-3 px-4">Stage Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
              {STAGE_DETAILS.map((stg, idx) => {
                const isExportStage = idx === STAGE_DETAILS.length - 1;
                const isRunning = isProcessing && (activeStepIndex === idx || (isExportStage && pipelineProgress >= 80));
                const isDone = activeStepIndex > idx || (pipelineProgress === 100 && (activeStepIndex >= idx || isExportStage));

                return (
                  <tr key={stg.id} className={isRunning ? 'bg-sky-500/10' : ''}>
                    <td className="py-3 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">{stg.id}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{stg.name}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{stg.description}</td>
                    <td className="py-3 px-4">
                      {isRunning ? (
                        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Processing
                        </span>
                      ) : isDone ? (
                        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          Passed
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXECUTION LOG TERMINAL */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-xl">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800">
          Execution Logs
        </h2>
        <div className="bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono h-48 overflow-y-auto space-y-1.5 border border-slate-800">
          {logs.length === 0 ? (
            <div className="text-slate-400">System initialized. Awaiting registration command...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-slate-400">[{log.timestamp}]</span>
                <span className={log.type === 'error' ? 'text-red-400 font-semibold' : log.type === 'success' ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
