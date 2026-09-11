import React from "react";
import { Activity } from "lucide-react";

interface MetricsCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
}

export default function MetricsCard({ label, value, sub, trend }: MetricsCardProps) {
  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm flex items-start justify-between gap-4">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
          {label}
        </span>
        <div className="text-2xl font-bold text-white tracking-tight mt-1">
          {value}
        </div>
        {sub && <p className="text-xs text-slate-500 font-mono mt-1">{sub}</p>}
      </div>

      <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
        <Activity className="w-5 h-5" />
      </div>
    </div>
  );
}
