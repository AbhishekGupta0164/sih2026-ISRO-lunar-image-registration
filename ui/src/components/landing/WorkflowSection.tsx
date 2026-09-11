import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, Sliders, GitMerge, Download } from 'lucide-react';

const steps = [
  {
    step: 'Step 01',
    title: 'Image Pair Ingestion',
    desc: 'Upload Reference (LRO NAC / DEM) and Target (Chandrayaan-2 OHRC / TMC-2) lunar imagery in PDS3, PDS4, or GeoTIFF formats.',
    icon: UploadCloud,
  },
  {
    step: 'Step 02',
    title: 'Model & Strategy Selection',
    desc: 'Select feature extractor (SIFT, ORB, SuperPoint, LOFTR) and geometry transform model (Rigid, Affine, Homography, Thin Plate Spline).',
    icon: Sliders,
  },
  {
    step: 'Step 03',
    title: 'RANSAC Matching & Alignment',
    desc: 'MAGSAC++ filters outlier correspondences while Lucas-Kanade optical flow refines matched control points to sub-pixel accuracy.',
    icon: GitMerge,
  },
  {
    step: 'Step 04',
    title: 'Geospatial Export & Audit',
    desc: 'Download registered GeoTIFF images, ground control point (GCP) matrices CSV, and evaluation reports with RMSE & SSIM metrics.',
    icon: Download,
  },
];

export const WorkflowSection: React.FC = () => {
  return (
    <section id="workflow" className="py-8 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-3xl mx-auto mb-8"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          02 / Workflow Pipeline
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-2">
          End-to-End Registration Process
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-base mt-4 leading-relaxed font-normal">
          From raw satellite raster ingestion to sub-pixel georeferenced output — four intuitive steps designed for lunar scientists and GIS engineers.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 backdrop-blur-md hover:border-sky-500/40 transition-all shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">{item.step}</span>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-300">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-medium">{item.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
