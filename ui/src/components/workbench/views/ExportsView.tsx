import React from 'react';
import { Image as ImageIcon, Table2, FileText, BarChart2, Layers, Activity } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { seleneApi } from '../../../services/api';

export const ExportsView: React.FC = () => {
  const { addLog, addToast, results, isComplete } = useApp();

  const jobId = results.jobId;
  const isReal = isComplete && Boolean(jobId);

  const handleDownload = async (productPath: string | undefined, filename: string) => {
    if (!jobId || !productPath) {
      addToast('Product is not ready. Please run a registration job first.', 'warn', 'Not Ready');
      return;
    }

    // 1. If PDF report is requested, download the official ISRO operations PDF from backend
    if (filename.endsWith('.pdf')) {
      const reportEndpoint = seleneApi.getReportUrl(jobId);
      addLog(`Fetching official ISRO operations PDF deliverable report from backend…`, 'info');
      try {
        const res = await fetch(reportEndpoint);
        if (res.ok && res.headers.get('content-type')?.includes('pdf')) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `registration_report_${jobId}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          addLog(`Successfully downloaded official ISRO 4-page PDF registration report.`, 'success');
          addToast(`ISRO PDF Report downloaded successfully.`, 'success', 'PDF Ready');
          return;
        } else {
          throw new Error(`Report generation returned HTTP status ${res.status}`);
        }
      } catch (err) {
        console.warn('PDF download error:', err);
        addLog(`Could not download PDF report from server: ${err}`, 'error');
        addToast(`PDF report download failed. Ensure backend server is running.`, 'error', 'Download Error');
        return;
      }
    }

    // 2. Real deliverable products from server (GeoTIFF, CSV, or diagnostic plots)
    try {
      const url = seleneApi.productUrl(productPath);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addLog(`Downloading deliverable product ${filename} from backend…`, 'success');
      addToast(`Downloading ${filename} from backend server.`, 'success', 'Download Started');
    } catch (err) {
      addLog(`Error downloading ${filename}: ${err}`, 'error');
      addToast(`Download failed for ${filename}.`, 'error', 'Error');
    }
  };

  const exports = [
    {
      icon: <ImageIcon className="w-6 h-6 text-cyan-400" />,
      borderColor: 'rgba(111,246,255,0.3)',
      bgColor: 'rgba(57,168,255,0.1)',
      filename: 'registered.tif',
      label: 'DOWNLOAD GEOTIFF',
      description: 'Registered GeoTIFF / final raster product with geo-transform.',
      productPath: isReal ? `/products/${jobId}/registered.tif` : undefined,
    },
    {
      icon: <Table2 className="w-6 h-6 text-emerald-400" />,
      borderColor: 'rgba(62,230,160,0.3)',
      bgColor: 'rgba(62,230,160,0.1)',
      filename: 'matches.csv',
      label: 'DOWNLOAD CSV',
      description: 'Verified GCP correspondence coordinates, confidence & split.',
      productPath: isReal ? `/products/${jobId}/matches.csv` : undefined,
    },
    {
      icon: <FileText className="w-6 h-6 text-amber-400" />,
      borderColor: 'rgba(255,182,92,0.3)',
      bgColor: 'rgba(255,182,92,0.1)',
      filename: 'registration_report.pdf',
      label: 'DOWNLOAD REPORT',
      description: 'Mission telemetry summary with complete metric matrix & quality gates.',
      productPath: isReal ? `/products/${jobId}/registration_report.pdf` : undefined,
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-cyan-300" />,
      borderColor: 'rgba(111,246,255,0.3)',
      bgColor: 'rgba(57,168,255,0.1)',
      filename: 'plot_checkerboard.png',
      label: 'CHECKERBOARD',
      description: '8x8 Checkerboard overlay plot with RMSE telemetry.',
      productPath: isReal ? `/products/${jobId}/plot_checkerboard.png` : undefined,
    },
    {
      icon: <Layers className="w-6 h-6 text-emerald-400" />,
      borderColor: 'rgba(62,230,160,0.3)',
      bgColor: 'rgba(62,230,160,0.1)',
      filename: 'plot_quiver.png',
      label: 'QUIVER PLOT',
      description: 'GCP displacement error vector plot with CE90 overlay.',
      productPath: isReal ? `/products/${jobId}/plot_quiver.png` : undefined,
    },
    {
      icon: <Activity className="w-6 h-6 text-amber-400" />,
      borderColor: 'rgba(255,182,92,0.3)',
      bgColor: 'rgba(255,182,92,0.1)',
      filename: 'plot_coverage.png',
      label: 'COVERAGE MAP',
      description: '8x8 Spatial uniformity grid coverage map & NNI index.',
      productPath: isReal ? `/products/${jobId}/plot_coverage.png` : undefined,
    },
  ];

  if (!isComplete) {
    return (
      <section id="view-exports" className="view-section active flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Registration Pipeline Pending</h2>
        <p className="text-slate-600 dark:text-slate-300 text-xs max-w-md mx-auto leading-relaxed font-normal">
          The final registered GeoTIFF rasters, CSV correspondence matrices, and PDF reports will be available for download once the pipeline run completes.
        </p>
      </section>
    );
  }

  return (
    <section id="view-exports" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Export Products &amp; Deliverables
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Download GeoTIFF rasters, CSV correspondence matrices, and printable registration reports.
        </p>
      </div>

      {/* EXPORTS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {exports.map((exp) => (
          <div key={exp.filename} className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 shadow-xl hover:border-sky-500/40 transition-all">
            <div>
              <h3 className="text-slate-900 dark:text-white font-mono text-sm font-bold">{exp.filename}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">{exp.description}</p>
            </div>
            <button
              onClick={() => handleDownload(exp.productPath, exp.filename)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-sky-600/20 border border-sky-400/30"
            >
              {exp.label}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
