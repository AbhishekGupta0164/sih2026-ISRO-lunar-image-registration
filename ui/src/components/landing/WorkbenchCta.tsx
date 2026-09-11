import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Upload, Play, Layers, Download, CheckCircle2 } from 'lucide-react';

export const WorkbenchCta: React.FC = () => {
  const { openWorkbench } = useApp();

  return (
    <motion.section
      id="launch"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="py-20 px-6 max-w-7xl mx-auto"
    >
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 md:p-12 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold uppercase tracking-wider mb-4">
            Interactive Tool Suite
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
            Ready to align high-resolution <span className="text-sky-400">lunar satellite pairs</span>?
          </h2>
          <p className="text-slate-400 text-base mt-4 leading-relaxed">
            Upload reference and target lunar imagery, select deep learning or feature matching models, analyze error metrics, and export georeferenced TIFFs instantly.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Multi-Sensor</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Deep Learning</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sub-Pixel RMSE</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>GeoTIFF Export</span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={() => openWorkbench('dashboard')}
              className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-all flex items-center gap-2 shadow-lg shadow-sky-500/25"
            >
              Launch Workbench Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="w-full lg:w-80 shrink-0 rounded-xl border border-slate-800 bg-slate-950 p-6 space-y-4 font-mono text-xs">
          <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px] pb-2 border-b border-slate-800">
            System Compatibility
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">PDS Datasets</span>
            <span className="text-slate-200 font-semibold">OHRC / TMC-2</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Reference Data</span>
            <span className="text-slate-200 font-semibold">LROC NAC / DEM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Feature Extractors</span>
            <span className="text-sky-400 font-semibold">LOFTR / SIFT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Format Output</span>
            <span className="text-emerald-400 font-semibold">GeoTIFF / PNG</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
