import React from 'react';
import { Moon } from 'lucide-react';

const techBadges = [
  'PYTHON 3.11',
  'NUMPY',
  'GDAL',
  'RASTERIO',
  'OPENCV',
  'KORNIA',
  'PYTORCH',
  'FASTAPI',
  'REACT / VITE / TS',
  'GRADIO',
];

export const AboutView: React.FC = () => {
  return (
    <section id="view-about" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          About Project
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Smart India Hackathon 2026 · Problem Statement 26166 · ISRO
        </p>
      </div>

      {/* ABOUT CARD */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 max-w-5xl space-y-6 shadow-xl transition-colors">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Chandrayaan-2 Multi-Modal Lunar Image Registration System
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed max-w-3xl">
            SELENE-MATCH performs automated keypoint correspondence matching and sub-pixel georeferencing between Chandrayaan-2 (OHRC, TMC-2, IIRS) optical imagery and LRO reference datasets across varying solar illumination angles, GSD scale disparities, and orbital sensor geometries.
          </p>
        </div>

        {/* METADATA HIGHLIGHTS */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scale Disparity</div>
            <div className="text-sm font-bold text-sky-600 dark:text-sky-400 font-mono mt-1">Up to 320× GSD</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Accuracy Target</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">&lt; 0.5 px RMSE</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pipeline Stages</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono mt-1">9 Stages Automated</div>
          </div>
        </div>

        {/* TECH STACK BADGES */}
        <div className="pt-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">
            Technology Stack
          </label>
          <div className="flex flex-wrap gap-2">
            {techBadges.map((badge) => (
              <span
                key={badge}
                className="font-mono text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-lg font-medium"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

