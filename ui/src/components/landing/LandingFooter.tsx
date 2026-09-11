import React from 'react';
import { ArrowUp, Compass } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/90 py-6 px-6 text-xs text-slate-600 dark:text-slate-400 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
            SELENE-MATCH
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Chandrayaan-2 Multi-Modal Lunar Image Registration System · Smart India Hackathon 2026</span>
        </div>

        <div className="flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <a href="#home" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Overview</a>
          <a href="#mission" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Problem Statement</a>
          <a href="#workflow" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Workflow</a>
          <a href="#technology" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Algorithms</a>
          <a href="#results" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">Benchmarks</a>
        </div>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all text-xs font-semibold"
        >
          Back to Top
        </button>
      </div>
    </footer>
  );
};
