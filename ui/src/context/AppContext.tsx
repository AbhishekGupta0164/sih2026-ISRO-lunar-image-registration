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
export interface AppContextType {
  currentView: WorkbenchView;
  isAppMode: boolean;
  sidebarCollapsed: boolean;
  theme: 'dark' | 'light';
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
  logs: LogEntry[];
  toasts: ToastMessage[];
  results: RegistrationResults;
  settings: SettingsConfig;
  routedMatcher: string;

  // State Actions & Handlers
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
    setResults(emptyResults);
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
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
      img.src = previewUrl;
    }
    setReferenceImage(metadata);
    addLog(`Loaded Reference: ${file.name}`, 'success');
    addToast(`Reference image loaded: ${file.name}`, 'success', 'Image Loaded');
  };

  const setSourceFile = (file: File) => {
    setIsComplete(false);
    setPipelineProgress(0);
    setActiveStepIndex(-1);
    setResults(emptyResults);
    const gsdMap: Record<string, string> = {
      'Chandrayaan-2 OHRC': '0.25 m/px',
      'Chandrayaan-2 TMC-2': '5.00 m/px',
      'Chandrayaan-2 IIRS': '80.00 m/px',
    };
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
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
      img.src = previewUrl;
    }
    setSourceImage(metadata);
    addLog(`Loaded Source: ${file.name}`, 'success');
    addToast(`Source image loaded: ${file.name}`, 'success', 'Image Loaded');
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
    if (!referenceImage?.file && !referenceImage?.previewUrl) {
      addToast('Please upload a Reference image first.', 'warn', 'Missing Reference');
      return;
    }
    try {
      setIsComplete(false);
      setPipelineProgress(0);
      setActiveStepIndex(-1);
      setResults(emptyResults);
      addLog(`Generating matching Target raster from ${referenceImage.name}…`, 'info');
      let baseF = referenceImage.file;
      if (!baseF && referenceImage.previewUrl) {
        baseF = await createFileFromUrl(referenceImage.previewUrl, referenceImage.name);
      }
      const data = await seleneApi.generateSyntheticPair({
        baseImage: baseF,
        rotationDeg: 5.5,
        scale: 0.94,
        tx: 20.0,
        ty: 12.0,
        gamma: 0.8,
        targetWidth: 1024,
        targetHeight: 1024,
      });

      const refUrl = seleneApi.productUrl(data.reference_image_url || '/synthetic/reference.png');
      const srcUrl = seleneApi.productUrl(data.source_image_url || '/synthetic/synthetic_target.png');

      const [refF, srcF] = await Promise.all([
        createFileFromUrl(refUrl, 'reference_crop.png'),
        createFileFromUrl(srcUrl, 'matched_target.png'),
      ]);

      setReferenceImage({
        name: `${referenceImage.name} (Matched Base)`,
        size: refF.size,
        type: 'image/png',
        sensor: referenceImage.sensor || 'Chandrayaan-2 OHRC',
        gsd: referenceImage.gsd || '0.25 m/px',
        sunAngle: '142.1° / 34.5°',
        previewUrl: refUrl,
        file: refF,
        dimensions: '1024 × 1024 px',
      });

      setSourceImage({
        name: `${referenceImage.name} (Warped Target - 5.5° Rot)`,
        size: srcF.size,
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
      addLog(`Failed to generate target from reference: ${msg}`, 'error');
      addToast('Could not generate target pair from image.', 'error', 'Generation Error');
    }
  };

  const runRegistration = async () => {
    if (isProcessing) return;

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
          addLog(`S${stepIndex}: ${msg}`, 'info');
        },
      );

      setResults(res);
      setIsComplete(true);
      setIsProcessing(false);
      setPipelineProgress(100);
      setActiveStepIndex(9);
      addLog('Pipeline complete. Registration products and metrics are ready.', 'success');
      addToast(
        `Registration complete in ${res.time} s. Metrics and products are ready.`,
        'success',
        'Pipeline Complete'
      );
      navigateTo('results');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown failure';
      setIsProcessing(false);
      addLog(`Pipeline error: ${msg}`, 'error');
      addToast('Registration pipeline encountered an error.', 'error', 'Pipeline Error');
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
