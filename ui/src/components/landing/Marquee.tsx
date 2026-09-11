import React from 'react';
import { Cpu, Database, Layers, Radio, Satellite, ShieldCheck, Zap } from 'lucide-react';

const marqueeItems = [
  { label: 'CHANDRAYAAN-2 OHRC', icon: Satellite },
  { label: 'LRO NAC / DEM', icon: Database },
  { label: 'TMC-2 STEREO', icon: Layers },
  { label: 'IIRS SPECTRAL', icon: Radio },
  { label: 'PDS v3/v4 GEOTIFF', icon: Database },
  { label: 'SIFT & ORB EXTRACTORS', icon: Cpu },
  { label: 'SUPERPOINT & LOFTR', icon: Zap },
  { label: 'RANSAC & MAGSAC++', icon: ShieldCheck },
];

export const Marquee: React.FC = () => {
  const combined = [...marqueeItems, ...marqueeItems];

  return (
    <div className="py-6 border-y border-slate-800 bg-slate-950/60 overflow-hidden select-none">
      <div className="flex gap-8 items-center animate-marquee whitespace-nowrap">
        {combined.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 text-xs font-mono font-semibold text-slate-300 shrink-0"
            >
              <Icon className="w-3.5 h-3.5 text-sky-400" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
