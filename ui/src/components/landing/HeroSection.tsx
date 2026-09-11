import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Layers, Satellite, ShieldCheck, Sparkles } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { openWorkbench } = useApp();

  return (
    <section className="relative z-10 pt-6 pb-4 px-6 max-w-5xl mx-auto flex flex-col items-center text-center" id="home">
      {/* Project Category Tag */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-xs font-mono mb-4 shadow-sm">
        <span>Smart India Hackathon 2026 · Problem Statement 26166 · ISRO</span>
      </div>

      {/* Page Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight max-w-4xl">
        Chandrayaan-2 Multi-Modal Lunar Image Registration System
      </h1>

      {/* Technical Subtitle */}
      <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-3xl leading-relaxed font-normal">
        This application performs automatic image correspondence matching and sub-pixel registration between Chandrayaan-2 optical imagery (OHRC, TMC-2, IIRS) and LRO reference datasets.
      </p>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => openWorkbench('upload')}
          className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all flex items-center gap-2.5 shadow-lg shadow-sky-600/30 border border-sky-400/30"
        >
          Open Registration Workspace
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => openWorkbench('dashboard')}
          className="px-6 py-3 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs transition-all shadow-md"
        >
          View System Overview
        </button>
      </div>

      {/* Feature Highlights Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl text-left">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 backdrop-blur-md hover:border-sky-500/40 transition-all shadow-xl">
          <h3 className="font-bold text-sky-600 dark:text-sky-400 text-xs uppercase tracking-wider">Multi-Sensor Support</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">
            Native support for Chandrayaan-2 OHRC, TMC-2, IIRS and LRO NAC imagery.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 backdrop-blur-md hover:border-sky-500/40 transition-all shadow-xl">
          <h3 className="font-bold text-emerald-600 dark:text-emerald-400 text-xs uppercase tracking-wider">Feature Matchers</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">
            SIFT, ORB, SuperPoint, and LOFTR feature correspondence algorithms.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 backdrop-blur-md hover:border-sky-500/40 transition-all shadow-xl">
          <h3 className="font-bold text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wider">Sub-Pixel RMSE</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">
            MAGSAC++ outlier filtering and Thin Plate Spline piecewise warping.
          </p>
        </div>
      </div>
    </section>
  );
};
