import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  const renderIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-sky-400 shrink-0" />;
    }
  };

  return (
    <div id="toasts" className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl backdrop-blur-md bg-slate-900/90 border border-slate-700/60 shadow-xl transition-all duration-200 hover:border-slate-600`}
          onClick={() => removeToast(t.id)}
          style={{ cursor: 'pointer' }}
        >
          {renderIcon(t.type)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-100 leading-tight">{t.title}</div>
            {t.message && <div className="text-xs text-slate-400 mt-1 leading-normal">{t.message}</div>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeToast(t.id);
            }}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
