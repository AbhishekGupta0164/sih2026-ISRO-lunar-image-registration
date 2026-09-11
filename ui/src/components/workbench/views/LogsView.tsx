import React from 'react';
import { Trash2 } from 'lucide-react';
import { useApp } from '../../../context/AppContext';

export const LogsView: React.FC = () => {
  const { logs, clearLogs } = useApp();
  const logsContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section id="view-logs" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Execution Log Console
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Real-time pipeline execution log stream and event history.
        </p>
      </div>

      {/* TERMINAL LOG CARD */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            System Telemetry Logs
          </h2>
          <button
            onClick={clearLogs}
            className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Clear Log Console
          </button>
        </div>

        <div className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-xl text-xs font-mono min-h-[400px] max-h-[600px] overflow-y-auto space-y-1.5 border border-slate-800" ref={logsContainerRef}>
          {logs.length === 0 ? (
            <div className="text-slate-400">Log stream initialized. Awaiting system events...</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2">
                <span className="text-slate-400">[{l.timestamp}]</span>
                <span className={l.type === 'error' ? 'text-red-400 font-semibold' : l.type === 'success' ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                  {l.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

