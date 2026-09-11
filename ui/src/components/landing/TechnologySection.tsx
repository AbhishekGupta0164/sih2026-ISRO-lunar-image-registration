import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Zap, GitMerge, Sliders, CheckCircle2 } from 'lucide-react';

export const TechnologySection: React.FC = () => {
  return (
    <section id="technology" className="py-8 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto mb-8"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          03 / Algorithm Architecture
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
          Adaptive Multi-Modal Matching Engine
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-base mt-4 leading-relaxed font-normal">
          Instead of relying on a single algorithm, SELENE dynamically routes lunar image pairs to the optimal feature extractor based on solar elevation, sensor modality, and resolution gap.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Traditional CV Feature Matchers */}
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-md hover:border-sky-500/40 transition-all shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-6">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Traditional Feature Extraction</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">
            High-speed scale-invariant feature transform (SIFT) and oriented FAST & rotated BRIEF (ORB) extractors for fast keypoint detection under uniform illumination.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> SIFT Keypoints
              </span>
              <span className="text-slate-500 dark:text-slate-400">128D Descriptor</span>
            </div>
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> ORB Binary Matcher
              </span>
              <span className="text-slate-500 dark:text-slate-400">Fast Hamming Distance</span>
            </div>
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Phase Correlation
              </span>
              <span className="text-slate-500 dark:text-slate-400">FFT Frequency Shift</span>
            </div>
          </div>
        </div>

        {/* Card 2: Deep Learning Neural Matchers */}
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-md hover:border-purple-500/40 transition-all shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Deep Learning Neural Matchers</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">
            Transformer-based semi-dense models (LOFTR, SuperPoint + LightGlue) capable of matching extreme shadow shifts, crater rim distortion, and low-contrast surface terrain.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> LOFTR Detector-Free
              </span>
              <span className="text-slate-500 dark:text-slate-400">Coarse-to-Fine Transformer</span>
            </div>
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> SuperPoint + LightGlue
              </span>
              <span className="text-slate-500 dark:text-slate-400">Graph Neural Network</span>
            </div>
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" /> MAGSAC++ Filtering
              </span>
              <span className="text-slate-500 dark:text-slate-400">Marginalized Sample Consensus</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
