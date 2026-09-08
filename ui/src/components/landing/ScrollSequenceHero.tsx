import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Sliders, GitMerge, CheckCircle, ArrowRight } from 'lucide-react';
import { seleneApi } from '../../services/api';

export const ScrollSequenceHero: React.FC = () => {
  const { openWorkbench } = useApp();
  const [sliderPos, setSliderPos] = useState<number>(50);

  return (
    <div className="py-6 px-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 md:p-8 backdrop-blur-md shadow-xl transition-colors">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Interactive Registration Preview
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Drag the curtain slider below to compare Reference (LRO NAC) vs Target (Chandrayaan-2 OHRC) lunar surface alignment.
            </p>
          </div>
          <button
            onClick={() => openWorkbench('upload')}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all flex items-center gap-2 shrink-0 shadow-md"
          >
            Load Custom Image Pair
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Split Comparison Card */}
        <div className="relative mt-6 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden aspect-[16/9] max-h-[460px] select-none">
          {/* Reference Image (Underneath) */}
          <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
            <img
              src={seleneApi.productUrl('/synthetic/reference.png')}
              alt="Reference Lunar Image"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded bg-slate-900/90 border border-slate-700 text-xs font-mono text-sky-400">
              Reference Image (LRO NAC)
            </div>
          </div>

          {/* Registered Target Image (Overlaid with clip-path) */}
          <div
            className="absolute inset-0 bg-slate-950 transition-all duration-75"
            style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
          >
            <img
              src={seleneApi.productUrl('/synthetic/synthetic_target.png')}
              alt="Target Registered Lunar Image"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 px-3 py-1 rounded bg-slate-900/90 border border-slate-700 text-xs font-mono text-emerald-400">
              Target Image (Chandrayaan-2 OHRC)
            </div>
          </div>

          {/* Slider Control Handle */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
          />
          {/* Visual Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-sky-400 pointer-events-none z-20 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg border border-white/20">
              <Sliders className="w-3.5 h-3.5 rotate-90" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
