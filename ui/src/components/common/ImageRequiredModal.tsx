import React from 'react';
import { AlertTriangle, UploadCloud, Zap, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface MissingImagesState {
  isOpen: boolean;
  mode: 'both_missing' | 'target_missing' | 'ref_missing';
}

interface Props {
  state: MissingImagesState | null;
  onClose: () => void;
}

export const ImageRequiredModal: React.FC<Props> = ({ state, onClose }) => {
  const {
    referenceImage,
    loadSyntheticPair,
    generateTargetFromReference,
    navigateTo,
    isProcessing,
  } = useApp();

  if (!state || !state.isOpen) return null;

  const handleLoadDemo = async () => {
    onClose();
    await loadSyntheticPair();
  };

  const handleGenerateTarget = async () => {
    onClose();
    await generateTargetFromReference();
  };

  const handleGoToUpload = () => {
    onClose();
    navigateTo('upload');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl space-y-5 transition-all">
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* HEADER ICON & TITLE */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {state.mode === 'both_missing' && 'Image Ingestion Required'}
              {state.mode === 'target_missing' && 'Matching Target Raster Required'}
              {state.mode === 'ref_missing' && 'Reference Base Image Required'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Registration requires two overlapping lunar rasters to compute GCP vectors.
            </p>
          </div>
        </div>

        {/* DESCRIPTION MESSAGE */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {state.mode === 'both_missing' && (
            <p>
              No image rasters are currently loaded. You can either <strong>load the pre-configured demo synthetic pair</strong> (OHRC 0.25m vs LRO NAC 0.50m) for instant validation, or <strong>upload your own lunar image files</strong>.
            </p>
          )}
          {state.mode === 'target_missing' && (
            <p>
              You have loaded Reference image <strong className="font-mono text-sky-600 dark:text-sky-400">{referenceImage?.name || 'reference.png'}</strong>, but no Target image is selected. You can <strong>automatically generate a matching warped synthetic target</strong> directly from this reference image, or choose another target file.
            </p>
          )}
          {state.mode === 'ref_missing' && (
            <p>
              Target image is loaded, but Reference base image is missing. Please upload the reference base map or load the synthetic demo pair.
            </p>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          {state.mode === 'target_missing' && referenceImage && (
            <button
              type="button"
              onClick={handleGenerateTarget}
              disabled={isProcessing}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 border border-emerald-400/30 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>Generate Target from Reference</span>
            </button>
          )}

          {state.mode === 'both_missing' && (
            <button
              type="button"
              onClick={handleLoadDemo}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-sky-600/20 border border-sky-400/30 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Demo Synthetic Pair</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGoToUpload}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Go to Upload View</span>
          </button>
        </div>
      </div>
    </div>
  );
};
