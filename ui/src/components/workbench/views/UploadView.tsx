import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle, RotateCcw, Zap, ExternalLink, Sliders, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { seleneApi } from '../../../services/api';

// ── Small slider row ─────────────────────────────────────────────────────────
interface SliderRowProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  color?: string;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, unit, value, min, max, step, onChange, color = '#6ff6ff' }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-slate-400 font-mono">{label}</span>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full appearance-none cursor-pointer"
      style={{ accentColor: color }}
    />
    <div className="flex justify-between text-[9px] text-slate-600 font-mono">
      <span>{min}{unit}</span><span>{max}{unit}</span>
    </div>
  </div>
);

// ── Main Upload View ──────────────────────────────────────────────────────────
export const UploadView: React.FC = () => {
  const {
    referenceImage, sourceImage,
    sourceSensor,
    setReferenceFile, setSourceFile, setSourceSensor,
    clearUploads, loadSyntheticPair, generateTargetFromReference, navigateTo,
    addLog, addToast, isProcessing,
    setReferenceImage: _setRef, setSourceImage: _setSrc,
  } = useApp() as any;

  const setRefMeta  = typeof _setRef  === 'function' ? _setRef  : null;
  const setSrcMeta  = typeof _setSrc  === 'function' ? _setSrc  : null;

  const refInputRef   = useRef<HTMLInputElement | null>(null);
  const srcInputRef   = useRef<HTMLInputElement | null>(null);

  const [genMode, setGenMode] = useState<'none' | 'config'>('none');
  const pairReady = referenceImage !== null && sourceImage !== null;

  return (
    <section id="view-upload" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Image Pair Ingestion &amp; Inspection
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Upload lunar image pairs (Reference and Target rasters) to inspect metadata, resolution GSD, and sensor properties.
          </p>
        </div>

        <button
          onClick={loadSyntheticPair}
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-md shadow-sky-600/20 border border-sky-400/30"
        >
          Load Demo Synthetic Pair
        </button>
      </div>

      {/* EMPTY STATE GUIDANCE BANNER */}
      {!referenceImage && !sourceImage && (
        <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-900 dark:text-sky-200 text-xs flex items-center justify-between flex-wrap gap-4 shadow-sm">
          <div className="space-y-1 max-w-2xl">
            <div className="font-bold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <span className="text-base">💡</span> Image Pair Ingestion Guide
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Upload your <strong>Reference image</strong> and <strong>Target image</strong> below, or click <strong>Load Demo Synthetic Pair</strong> to test with pre-loaded Chandrayaan-2 / LRO NAC datasets. If you only upload 1 image as Reference, click <strong>Generate Target from Reference</strong> to create a matching synthetic pair.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSyntheticPair}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-md"
          >
            Load Demo Synthetic Pair
          </button>
        </div>
      )}
      {Boolean(referenceImage?.file && !referenceImage?.name?.startsWith('reference.png') && (sourceImage?.name?.includes('synthetic_target.png') || !sourceImage?.file)) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between flex-wrap gap-4 shadow-sm">
          <div className="space-y-1 max-w-2xl">
            <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span className="text-base">⚠️</span> Overlapping Image Pair Required
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              You loaded custom image <strong className="font-mono">{referenceImage?.name}</strong>, but Target is still the default synthetic sample. Registration requires two images covering the same lunar area. Upload a matching Target file, or auto-generate a matching target directly from this image.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generateTargetFromReference}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {isProcessing ? 'Generating…' : 'Generate Matching Target'}
            </button>
            <button
              type="button"
              onClick={() => srcInputRef.current?.click()}
              className="px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Choose Target File
            </button>
          </div>
        </div>
      )}

      {/* TWO CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REFERENCE IMAGE */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Reference Image
            </h2>
            <span className="text-xs font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded border border-sky-500/20">Fixed Base Layer</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Sensor
            </label>
            <select
              disabled
              className="w-full p-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="LRO NAC">LRO NAC (0.50 m/px)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              File Input
            </label>
            <input
              ref={refInputRef}
              type="file"
              accept="image/*,.tif,.tiff,.lbl,.xml,.json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setReferenceFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Choose File
              </button>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                {referenceImage ? referenceImage.name : 'reference.png'}
              </span>
            </div>
          </div>

          {/* Preview Box */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Image Preview
            </label>
            <div className="h-44 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center p-2 overflow-hidden">
              {referenceImage?.previewUrl ? (
                <img
                  src={referenceImage.previewUrl}
                  alt="Reference preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">No preview available</span>
              )}
            </div>
          </div>

          {/* Info Table */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Image Information</h3>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Dimensions:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">
                    {referenceImage?.dimensions || (referenceImage ? '1024 × 1024 px' : '—')}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">File Size:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">
                    {referenceImage ? `${(referenceImage.size / 1024).toFixed(1)} KB` : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">GSD:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">{referenceImage?.gsd || '0.50 m/px'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Sun Elevation:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">{referenceImage?.sunAngle || '34.5°'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TARGET IMAGE */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl transition-colors">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Target Image
            </h2>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">Dataset: Chandrayaan-2</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Sensor
            </label>
            <select
              value={sourceSensor}
              onChange={(e) => setSourceSensor(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-sky-600 dark:text-sky-300 font-semibold focus:border-sky-500 focus:outline-none"
            >
              <option value="Chandrayaan-2 OHRC">Chandrayaan-2 OHRC (0.25 m/px)</option>
              <option value="Chandrayaan-2 TMC-2">Chandrayaan-2 TMC-2 (5.00 m/px)</option>
              <option value="Chandrayaan-2 IIRS">Chandrayaan-2 IIRS (80.0 m/px)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              File Input
            </label>
            <input
              ref={srcInputRef}
              type="file"
              accept="image/*,.tif,.tiff,.lbl,.xml,.json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSourceFile(e.target.files[0]);
                }
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => srcInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Choose File
              </button>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                {sourceImage ? sourceImage.name : 'target.png'}
              </span>
            </div>
          </div>

          {/* Preview Box */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Image Preview
            </label>
            <div className="h-44 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center p-2 overflow-hidden">
              {sourceImage?.previewUrl ? (
                <img
                  src={sourceImage.previewUrl}
                  alt="Target preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">No preview available</span>
              )}
            </div>
          </div>

          {/* Info Table */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Image Information</h3>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Dimensions:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">
                    {sourceImage?.dimensions || (sourceImage ? '1024 × 1024 px' : '—')}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">File Size:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">
                    {sourceImage ? `${(sourceImage.size / 1024).toFixed(1)} KB` : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">GSD:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">{sourceImage?.gsd || '0.25 m/px'}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-500 dark:text-slate-400 font-semibold">Sun Elevation:</td>
                  <td className="py-1.5 font-mono text-right text-slate-900 dark:text-slate-100">{sourceImage?.sunAngle || '32.1°'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ACTION CONTROLS */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between flex-wrap gap-4 shadow-xl">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={loadSyntheticPair}
            className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            Reset Demo Pair
          </button>
          {referenceImage && (
            <button
              type="button"
              onClick={generateTargetFromReference}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              {isProcessing ? 'Generating…' : 'Generate Target from Reference'}
            </button>
          )}
          <button
            type="button"
            onClick={clearUploads}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-xs font-semibold transition-colors"
          >
            Clear Inputs
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!referenceImage && !sourceImage) {
              addToast(
                'Please upload both Reference and Target images first (or click "Load Demo Synthetic Pair") to continue.',
                'error',
                'Images Required'
              );
              return;
            }
            if (referenceImage && !sourceImage) {
              addToast(
                'Please upload a Target image or click "Generate Target from Reference" before continuing.',
                'error',
                'Target Missing'
              );
              return;
            }
            if (!referenceImage && sourceImage) {
              addToast(
                'Please upload a Reference image to pair with your Target image.',
                'error',
                'Reference Missing'
              );
              return;
            }
            navigateTo('register');
          }}
          className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-lg shadow-sky-600/25 border border-sky-400/30"
        >
          Continue to Registration
        </button>
      </div>
    </section>
  );
};
