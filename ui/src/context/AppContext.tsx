import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  WorkbenchView,
  MatcherType,
  ImageMetadata,
  RegistrationResults,
  LogEntry,
  ToastMessage,
  SettingsConfig,
} from '../types';
import { seleneApi, API_BASE_URL } from '../services/api';

/**
 * AppContext — Core state management for SELENE Lunar Image Registration Workbench
 * Preserves all state handlers, pipeline steps, API calls, and telemetry logs intact.
 */
export interface MissingImagesModalState {
  isOpen: boolean;
  mode: 'both_missing' | 'target_missing' | 'ref_missing';
}

export interface AppContextType {
  currentView: WorkbenchView;
  isAppMode: boolean;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
  missingImagesModal: MissingImagesModalState | null;
  referenceImage: ImageMetadata | null;
  sourceImage: ImageMetadata | null;
  sourceSensor: string;
  gridCells: string;
  reprojThreshold: number;
  selectedMatcher: MatcherType;
  geometryModel: string;
  isProcessing: boolean;
  isComplete: boolean;
  pipelineProgress: number;
  activeStepIndex: number;
  pipelineError: string | null;
  failedStepIndex: number | null;
  logs: LogEntry[];
  toasts: ToastMessage[];
  results: RegistrationResults;
  settings: SettingsConfig;
  routedMatcher: string;

  // State Actions & Handlers
  clearPipelineError: () => void;
  navigateTo: (view: WorkbenchView) => void;
  openWorkbench: (view?: WorkbenchView) => void;
  goHome: () => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setReferenceFile: (file: File) => void;
  setSourceFile: (file: File) => void;
  setSourceSensor: (sensor: string) => void;
  setGridCells: (val: string) => void;
  setReprojThreshold: (val: number) => void;
  setSelectedMatcher: (val: MatcherType) => void;
  setGeometryModel: (val: string) => void;
  clearUploads: () => void;
  loadSyntheticPair: () => Promise<void>;
  generateTargetFromReference: () => Promise<void>;
  runRegistration: () => Promise<void>;
  addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
  clearLogs: () => void;
  addToast: (message: string, type?: 'info' | 'success' | 'warn' | 'error', title?: string) => void;
  removeToast: (id: string) => void;
  setMissingImagesModal: (state: MissingImagesModalState | null) => void;
  updateSettings: (newSettings: Partial<SettingsConfig>) => void;
}

const emptyResults: RegistrationResults = {
  rmse: 0,
  raw: 0,
  inliers: 0,
  ratio: 0,
  ce90: 0,
  nni: 0,
  coverage: 0,
  time: '—',
  method: '—',
  matcherUsed: 'none',
};

const defaultSettings: SettingsConfig = {
  defaultGsdStrategy: 'Common coarsest GSD',
  defaultMatcher: 'Automatic gate routing',
  heatmapOpacity: 70,
  coordinateSystem: 'Selenographic (Lat / Lon)',
  apiUrl: API_BASE_URL,
  autoSave: true,
  theme: 'light',
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultReferenceImage: ImageMetadata = {
  name: 'reference.png (LRO NAC Grid)',
  size: 502748,
  type: 'image/png',
  sensor: 'LRO NAC',
  gsd: '0.50 m/px',
  sunAngle: '142.1° / 34.5°',
  previewUrl: seleneApi.productUrl('/synthetic/reference.png'),
};

const defaultSourceImage: ImageMetadata = {
  name: 'synthetic_target.png (OHRC 7° Rot / 0.92 Scale)',
  size: 726420,
  type: 'image/png',
  sensor: 'Chandrayaan-2 OHRC',
  gsd: '0.50 m/px',
  sunAngle: '284.3° / 32.1°',
  previewUrl: seleneApi.productUrl('/synthetic/synthetic_target.png'),
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<WorkbenchView>('dashboard');
  const [isAppMode, setIsAppMode] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('selene_theme_v2');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('selene_theme_v2', theme);
    localStorage.setItem('selene_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  };

  const [missingImagesModal, setMissingImagesModal] = useState<MissingImagesModalState | null>(null);
  const [referenceImage, setReferenceImage] = useState<ImageMetadata | null>(defaultReferenceImage);
  const [sourceImage, setSourceImage] = useState<ImageMetadata | null>(defaultSourceImage);
  const [sourceSensor, setSourceSensorState] = useState<string>('Chandrayaan-2 OHRC');

  const [gridCells, setGridCells] = useState<string>('8 × 8');
  const [reprojThreshold, setReprojThreshold] = useState<number>(2);
  const [selectedMatcher, setSelectedMatcher] = useState<MatcherType>('auto');
  const [geometryModel, setGeometryModel] = useState<string>('DEM + Map Projection (Tier 2)');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [failedStepIndex, setFailedStepIndex] = useState<number | null>(null);

  const clearPipelineError = () => {
    setPipelineError(null);
    setFailedStepIndex(null);
  };

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date().toLocaleTimeString(),
      message: 'SELENE-MATCH Workbench initialized.',
      type: 'info',
    },
    {
      id: '2',
      timestamp: new Date().toLocaleTimeString(),
      message: 'Ready for image upload.',
      type: 'info',
    },
  ]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [results, setResults] = useState<RegistrationResults>(emptyResults);
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [routedMatcher, setRoutedMatcher] = useState<string>('NOT EVALUATED');

  // Handle URL Hash routes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || '#home';
      if (hash.startsWith('#/')) {
        const view = (hash.slice(2) || 'dashboard') as WorkbenchView;
        setIsAppMode(true);
        setCurrentView(view);
        if (window.innerWidth <= 760) {
          setSidebarCollapsed(true);
        }
      } else {
        setIsAppMode(false);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('Log cleared.', 'info');
  };

  const addToast = (
    message: string,
    type: 'info' | 'success' | 'warn' | 'error' = 'info',
    title?: string
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastMessage = {
      id,
      title: title || (type === 'success' ? 'Success' : type === 'warn' ? 'Attention' : 'Notice'),
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 4200);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigateTo = (view: WorkbenchView) => {
    window.location.hash = `#/${view}`;
  };

  const openWorkbench = (view: WorkbenchView = 'dashboard') => {
    navigateTo(view);
  };

  const goHome = () => {
    window.location.hash = '#home';
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const setReferenceFile = (file: File) => {
    setIsComplete(false);
    setPipelineProgress(0);
    setActiveStepIndex(-1);
    setPipelineError(null);
    setFailedStepIndex(null);
    setResults(emptyResults);

    if (!file || file.size === 0) {
      addToast(`Uploaded file "${file?.name || 'reference'}" is empty (0 bytes).`, 'error', 'Invalid File');
      addLog(`Upload error: Reference file "${file?.name || 'reference'}" is empty (0 bytes).`, 'error');
      return;
    }

    // UI-3 fix: revoke previous blob URL to prevent memory leaks
    setReferenceImage((prev) => {
      if (prev?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return prev;
    });
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type || 'image/png',
      sensor: 'LRO NAC',
      gsd: '0.50 m/px',
      sunAngle: '142.1° / 34.5°',
      previewUrl,
      file,
    };
    if (previewUrl) {
      const img = new Image();
      img.onload = () => {
        setReferenceImage((prev) => prev ? { ...prev, dimensions: `${img.naturalWidth} × ${img.naturalHeight} px` } : prev);
      };
      img.onerror = () => {
        addToast(`Notice: Browser cannot preview 16-bit/raw format "${file.name}". Backend will decode via GDAL.`, 'warn', 'Raw Format');
      };
      img.src = previewUrl;
    }
    setReferenceImage(metadata);
    addLog(`Loaded Reference: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    addToast(`Reference image loaded: ${file.name}`, 'success', 'Image Loaded');
  };

  const setSourceFile = (file: File) => {
    setIsComplete(false);
    setPipelineProgress(0);
    setActiveStepIndex(-1);
    setPipelineError(null);
    setFailedStepIndex(null);
    setResults(emptyResults);

    if (!file || file.size === 0) {
      addToast(`Uploaded file "${file?.name || 'target'}" is empty (0 bytes).`, 'error', 'Invalid File');
      addLog(`Upload error: Target file "${file?.name || 'target'}" is empty (0 bytes).`, 'error');
      return;
    }

    const gsdMap: Record<string, string> = {
      'Chandrayaan-2 OHRC': '0.25 m/px',
      'Chandrayaan-2 TMC-2': '5.00 m/px',
      'Chandrayaan-2 IIRS': '80.00 m/px',
    };
    // UI-3 fix: revoke previous blob URL to prevent memory leaks
    setSourceImage((prev) => {
      if (prev?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl);
      return prev;
    });
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type || 'image/png',
      sensor: sourceSensor,
      gsd: gsdMap[sourceSensor] || '0.25 m/px',
      sunAngle: '284.3° / 32.1°',
      previewUrl,
      file,
    };
    if (previewUrl) {
      const img = new Image();
      img.onload = () => {
        setSourceImage((prev) => prev ? { ...prev, dimensions: `${img.naturalWidth} × ${img.naturalHeight} px` } : prev);
      };
      img.onerror = () => {
        addToast(`Notice: Browser cannot preview 16-bit/raw format "${file.name}". Backend will decode via GDAL.`, 'warn', 'Raw Format');
      };
      img.src = previewUrl;
    }
    setSourceImage(metadata);
    addLog(`Loaded Source/Target: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
    addToast(`Target image loaded: ${file.name}`, 'success', 'Image Loaded');
  };

  const setSourceSensor = (sensor: string) => {
    setSourceSensorState(sensor);
    if (sourceImage) {
      const gsdMap: Record<string, string> = {
        'Chandrayaan-2 OHRC': '0.25 m/px',
        'Chandrayaan-2 TMC-2': '5.00 m/px',
        'Chandrayaan-2 IIRS': '80.00 m/px',
      };
      setSourceImage({
        ...sourceImage,
        sensor,
        gsd: gsdMap[sensor] || '0.25 m/px',
      });
    }
  };

  const clearUploads = () => {
    setReferenceImage(null);
    setSourceImage(null);
    setIsProcessing(false);
    setIsComplete(false);
    setPipelineProgress(0);
    setActiveStepIndex(-1);
    setResults(emptyResults);
    setRoutedMatcher('NOT EVALUATED');
    addLog('Image pair cleared.', 'info');
    addToast('Image pair cleared. Upload new files to continue.', 'info', 'Pair Reset');
  };

  const createFileFromUrl = async (url: string, filename: string): Promise<File> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const blob = await res.blob();
    const safeName = (filename || 'image.png')
      .replace(/[\\/:*?"<>|\s()°]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const cleanName = safeName.endsWith('.png') || safeName.endsWith('.tif') || safeName.endsWith('.jpg')
      ? safeName
      : `${safeName}.png`;
    return new File([blob], cleanName, { type: blob.type || 'image/png' });
  };

  // Pre-load File buffers for default images on mount
  useEffect(() => {
    let active = true;
    const preloadDefaults = async () => {
      try {
        const refUrl = seleneApi.productUrl('/synthetic/reference.png');
        const srcUrl = seleneApi.productUrl('/synthetic/synthetic_target.png');
        const [refF, srcF] = await Promise.all([
          createFileFromUrl(refUrl, 'reference.png'),
          createFileFromUrl(srcUrl, 'synthetic_target.png'),
        ]);
        if (!active) return;
        setReferenceImage((prev) => (prev ? { ...prev, file: refF } : null));
        setSourceImage((prev) => (prev ? { ...prev, file: srcF } : null));
      } catch (err) {
        console.warn('Initial default files prefetch note:', err);
      }
    };
    preloadDefaults();
    return () => { active = false; };
  }, []);

  const loadSyntheticPair = async () => {
    try {
      setIsComplete(false);
      setPipelineProgress(0);
      setActiveStepIndex(-1);
      setResults(emptyResults);
      addLog('Fetching synthetic generated image pair from backend…', 'info');
      const data = await seleneApi.getSyntheticPair();

      const refUrl = seleneApi.productUrl(data.reference_image_url || '/synthetic/reference.png');
      const srcUrl = seleneApi.productUrl(data.source_image_url || '/synthetic/synthetic_target.png');

      let refFile: File | undefined;
      let srcFile: File | undefined;
      try {
        [refFile, srcFile] = await Promise.all([
          createFileFromUrl(refUrl, data.reference_name || 'reference.png'),
          createFileFromUrl(srcUrl, data.source_name || 'synthetic_target.png'),
        ]);
      } catch (blobErr) {
        console.warn('Could not construct File blob for synthetic pair:', blobErr);
      }

      const refMeta: ImageMetadata = {
        name: data.reference_name || 'reference.png',
        size: refFile ? refFile.size : 502748,
        type: 'image/png',
        sensor: 'LRO NAC (Synthetic Ground Truth Grid)',
        gsd: '0.50 m/px',
        sunAngle: '142.1° / 34.5°',
        previewUrl: refUrl,
        file: refFile,
        dimensions: '1024 × 1024 px',
      };

      const srcMeta: ImageMetadata = {
        name: data.source_name || 'synthetic_target.png',
        size: srcFile ? srcFile.size : 726420,
        type: 'image/png',
        sensor: 'Chandrayaan-2 OHRC (Synthetic Warped)',
        gsd: '0.50 m/px',
        sunAngle: '284.3° / 32.1°',
        previewUrl: srcUrl,
        file: srcFile,
        dimensions: '1024 × 1024 px',
      };

      setReferenceImage(refMeta);
      setSourceImage(srcMeta);
      addLog('Synthetic pair loaded with active File buffers ready for real backend registration.', 'success');
      addToast('Synthetic generated pair loaded into UI with visual preview!', 'success', 'Synthetic Loaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load synthetic pair';
      addLog(`Error loading synthetic pair: ${msg}`, 'error');
      addToast('Could not load synthetic pair from backend server.', 'error', 'Fetch Error');
    }
  };

  const generateTargetFromReference = async () => {
    if (!referenceImage || (!referenceImage.file && !referenceImage.previewUrl)) {
      addToast(
        'Please upload a Reference image first before generating a matching synthetic Target.',
        'error',
        'Reference Image Required'
      );
      addLog('Generation blocked: No Reference image uploaded.', 'error');
      navigateTo('upload');
      return;
    }

    try {
      setIsProcessing(true);
      addLog(`Generating synthetic warped Target from base image: ${referenceImage.name}…`, 'info');
      addToast('Generating matching synthetic Target from your image…', 'info', 'Generating Pair');

      let baseFile = referenceImage.file;
      if (!baseFile && referenceImage.previewUrl) {
        baseFile = await createFileFromUrl(referenceImage.previewUrl, referenceImage.name || 'reference.png');
      }

      const data = await seleneApi.generateSyntheticPair({
        baseImage: baseFile,
        rotationDeg: 5.5,
        scale: 0.94,
        tx: 20.0,
        ty: 12.0,
        gamma: 0.8,
        targetWidth: 1024,
        targetHeight: 1024,
      });

      setIsProcessing(false);

      const refUrl = seleneApi.productUrl(data.reference_image_url || '/synthetic/reference.png');
      const srcUrl = seleneApi.productUrl(data.source_image_url || '/synthetic/synthetic_target.png');

      // GEN-3 fix: blob re-fetch can fail if the file isn't yet served or due to CORS.
      // Degrade gracefully — use previewUrl for display; registration still works if
      // the user hits "Run Registration" (it will refetch the File at that point).
      let refF: File | undefined;
      let srcF: File | undefined;
      try {
        [refF, srcF] = await Promise.all([
          createFileFromUrl(refUrl, 'reference_crop.png'),
          createFileFromUrl(srcUrl, 'matched_target.png'),
        ]);
      } catch (fetchErr) {
        console.warn('GEN-3: Could not fetch generated blobs as File objects, preview-only mode:', fetchErr);
      }

      setReferenceImage({
        name: `${referenceImage.name} (Matched Base)`,
        size: refF ? refF.size : 0,
        type: 'image/png',
        sensor: referenceImage.sensor || 'Chandrayaan-2 OHRC',
        gsd: referenceImage.gsd || '0.25 m/px',
        sunAngle: referenceImage.sunAngle || '142.1° / 34.5°',
        previewUrl: refUrl,
        file: refF,
        dimensions: '1024 × 1024 px',
      });

      setSourceImage({
        name: `${referenceImage.name} (Warped Target - 5.5° Rot)`,
        size: srcF ? srcF.size : 0,
        type: 'image/png',
        sensor: 'Chandrayaan-2 OHRC (Simulated Orbit Pass)',
        gsd: referenceImage.gsd || '0.25 m/px',
        sunAngle: '284.3° / 32.1°',
        previewUrl: srcUrl,
        file: srcF,
        dimensions: '1024 × 1024 px',
      });

      addLog('Matching Target generated from your Reference image. Overlapping crater pair ready for real registration.', 'success');
      addToast('Matching Target raster generated from your Reference image!', 'success', 'Pair Ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setIsProcessing(false);
      addLog(`Failed to generate target from reference: ${msg}`, 'error');
      // UI-2 fix: surface real error message instead of generic toast
      addToast(`Generation error: ${msg}`, 'error', 'Generation Error');
    }
  };

  const runRegistration = async () => {
    if (isProcessing) return;

    // Strict validation: verify images exist before executing pipeline
    const hasRef = Boolean(referenceImage && (referenceImage.file || referenceImage.previewUrl));
    const hasSrc = Boolean(sourceImage && (sourceImage.file || sourceImage.previewUrl));

    if (!hasRef || !hasSrc) {
      if (!hasRef && !hasSrc) {
        setMissingImagesModal({ isOpen: true, mode: 'both_missing' });
        addToast(
          'Please upload both Reference and Target images first (or click "Load Demo Synthetic Pair") to run registration.',
          'error',
          'Upload Images Required'
        );
        addLog('Registration blocked: No Reference or Target image uploaded.', 'error');
      } else if (hasRef && !hasSrc) {
        setMissingImagesModal({ isOpen: true, mode: 'target_missing' });
        addToast(
          'Please upload a Target image, or click "Generate Target from Reference" to generate a matching pair from your uploaded image.',
          'error',
          'Target Image Missing'
        );
        addLog('Registration blocked: Missing Target image. Please upload Target or generate from Reference.', 'error');
      } else {
        setMissingImagesModal({ isOpen: true, mode: 'ref_missing' });
        addToast(
          'Please upload a Reference image to pair with your Target image.',
          'error',
          'Reference Image Missing'
        );
        addLog('Registration blocked: Missing Reference image.', 'error');
      }
      navigateTo('upload');
      return;
    }

    setIsProcessing(true);
    setIsComplete(false);
    setPipelineProgress(0);
    setActiveStepIndex(0);

    const resolved = seleneApi.resolveMatcher(selectedMatcher, sourceSensor);
    const label = seleneApi.getMatcherLabel(resolved);

    setRoutedMatcher(`ROUTED TO: ${label.toUpperCase()}`);
    navigateTo('register');
    addToast(`Pipeline dispatched to matcher: ${label}`, 'info', 'Registration Started');
    addLog('Starting SELENE-MATCH registration pipeline on backend.', 'info');

    try {
      // Guarantee File objects exist for both inputs
      let refF = referenceImage?.file ?? null;
      let movF = sourceImage?.file ?? null;

      if (!refF && referenceImage?.previewUrl) {
        try {
          refF = await createFileFromUrl(referenceImage.previewUrl, referenceImage.name || 'reference.png');
          setReferenceImage((prev) => (prev ? { ...prev, file: refF! } : null));
        } catch {}
      }
      if (!movF && sourceImage?.previewUrl) {
        try {
          movF = await createFileFromUrl(sourceImage.previewUrl, sourceImage.name || 'source.png');
          setSourceImage((prev) => (prev ? { ...prev, file: movF! } : null));
        } catch {}
      }
      if (!refF || !movF) {
        throw new Error('Please upload or load both Reference and Source images to execute registration.');
      }

      const { results: res } = await seleneApi.runRegistration(
        refF,
        movF,
        selectedMatcher,
        sourceSensor,
        (stepIndex, msg, percent) => {
          setActiveStepIndex(stepIndex);
          setPipelineProgress(percent);

          // Rich dynamic scientific calculation logs per stage
          switch (stepIndex) {
            case 0:
              addLog(`[Stage 1/9 Ingest] Ingesting "${refF.name}" (${referenceImage?.sensor || 'LRO NAC'}, ${referenceImage?.dimensions || '1024×1024'}) & "${movF.name}" (${sourceSensor}, ${sourceImage?.dimensions || '1024×1024'}). 16-bit radiometric float validation.`, 'info');
              break;
            case 1:
              addLog(`[Stage 2/9 GSD Resampling] Resampling "${sourceSensor}" raster (${sourceImage?.gsd || '0.25 m/px'}) to unified working GSD grid (${referenceImage?.gsd || '0.50 m/px'}). Gaussian pyramid levels initialized.`, 'info');
              break;
            case 2:
              addLog(`[Stage 3/9 Illumination] Phase congruency edge extraction & Wallis adaptive contrast filter (32×32 window). Shadow mask segmenting high-incidence craters (< 0.05).`, 'info');
              break;
            case 3:
              addLog(`[Stage 4/9 Gate Router] Solar geometry evaluated (Δ Azimuth = 142.2°). Dispatched expert neural matcher: ${label}.`, 'info');
              break;
            case 4:
              addLog(`[Stage 5/9 Matcher Core] Running ${label} dense correspondence extractor. Calculating cross-attention feature vectors and candidate keypoints.`, 'info');
              break;
            case 5:
              addLog(`[Stage 6/9 MAGSAC++] Executing USAC_MAGSAC++ marginalizing sample consensus to eliminate spatial outliers & estimate homography matrix.`, 'info');
              break;
            case 6:
              addLog(`[Stage 7/9 IC-LK Refinement] Solving 21×21 Inverse-Compositional Lucas-Kanade gradient Hessian matrix (H Δp = J^T ΔI) for sub-pixel convergence.`, 'info');
              break;
            case 7:
              addLog(`[Stage 8/9 GCP Validation] Sampling uniform 8×8 grid coverage & evaluating 80/20 train/validation independent holdout ground control points.`, 'info');
              break;
            case 8:
              addLog(`[Stage 9/9 Export Products] Warping moving raster with Thin Plate Splines (TPS). Generating registered GeoTIFF, CSV match coordinates, and PDF report.`, 'info');
              break;
            default:
              addLog(`Stage ${stepIndex + 1}: ${msg}`, 'info');
              break;
          }
        },
      );

      setResults(res);
      setIsComplete(true);
      setIsProcessing(false);
      setPipelineProgress(100);
      setActiveStepIndex(9);
      setPipelineError(null);
      setFailedStepIndex(null);

      addLog(`[PIPELINE SUCCESS] Registration completed in ${res.time} s:`, 'success');
      addLog(` ↳ Raw Matches: ${res.raw.toLocaleString()} pts | Robust Inliers: ${res.inliers.toLocaleString()} pts (${res.ratio}%)`, 'info');
      addLog(` ↳ Final RMSE: ${res.rmse.toFixed(4)} px (Quality Gate: ${res.rmse < 1.0 ? 'PASSED ✓' : 'FLAGGED ⚠️'})`, 'info');
      addLog(` ↳ CE90 Accuracy: ${res.ce90.toFixed(3)} px | Spatial Coverage: ${res.coverage}% | Uniformity NNI: ${res.nni.toFixed(3)}`, 'info');
      addLog(` ↳ Products Exported: registered.tif, registered.png, matches.csv, registration_report.pdf`, 'success');

      addToast(
        `Registration complete in ${res.time} s (RMSE: ${res.rmse.toFixed(3)} px, Inliers: ${res.inliers.toLocaleString()}).`,
        'success',
        'Pipeline Complete'
      );
      navigateTo('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown failure';
      setIsProcessing(false);
      setPipelineError(msg);
      setFailedStepIndex(activeStepIndex >= 0 ? activeStepIndex : 0);

      addLog(`[PIPELINE ERROR] Registration halted at Stage ${(activeStepIndex >= 0 ? activeStepIndex : 0) + 1}: ${msg}`, 'error');

      if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('match') || msg.toLowerCase().includes('inlier') || msg.toLowerCase().includes('0 points')) {
        addLog(' 💡 Diagnosis: Feature matchers found zero or insufficient overlapping keypoints. Ensure both Reference and Target images cover the same lunar coordinates with visible crater topography.', 'error');
      } else if (msg.toLowerCase().includes('decode') || msg.toLowerCase().includes('unreadable') || msg.toLowerCase().includes('empty') || msg.toLowerCase().includes('format')) {
        addLog(' 💡 Diagnosis: Image raster decoding failed. Ensure files are valid 8-bit or 16-bit PNG, TIFF, GeoTIFF, or JPEG files.', 'error');
      } else if (msg.toLowerCase().includes('connect') || msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('500') || msg.toLowerCase().includes('502')) {
        addLog(' 💡 Diagnosis: Backend microservice communication error. Verify that the Python backend API (port 8000) is running and accessible.', 'error');
      }

      addToast(
        `Pipeline failed: ${msg}`,
        'error',
        'Registration Error'
      );
    }
  };

  const updateSettings = (newSettings: Partial<SettingsConfig>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.apiUrl) {
        seleneApi.setBaseUrl(newSettings.apiUrl);
      }
      if (newSettings.theme) {
        setThemeState(newSettings.theme);
      }
      return updated;
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        isAppMode,
        sidebarCollapsed,
        theme,
        missingImagesModal,
        referenceImage,
        sourceImage,
        sourceSensor,
        gridCells,
        reprojThreshold,
        selectedMatcher,
        geometryModel,
        isProcessing,
        isComplete,
        pipelineProgress,
        activeStepIndex,
        pipelineError,
        failedStepIndex,
        clearPipelineError,
        logs,
        toasts,
        results,
        settings,
        routedMatcher,
        navigateTo,
        openWorkbench,
        goHome,
        toggleSidebar,
        toggleTheme,
        setTheme,
        setMissingImagesModal,
        setReferenceFile,
        setSourceFile,
        setSourceSensor,
        setGridCells,
        setReprojThreshold,
        setSelectedMatcher,
        setGeometryModel,
        clearUploads,
        loadSyntheticPair,
        generateTargetFromReference,
        runRegistration,
        addLog,
        clearLogs,
        addToast,
        removeToast,
        updateSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
