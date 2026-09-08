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
  runRegistration: () => Promise<void>;
  addLog: (message: string, type?: 'info' | 'success' | 'error') => void;
  clearLogs: () => void;
  addToast: (message: string, type?: 'info' | 'success' | 'warn' | 'error', title?: string) => void;
  removeToast: (id: string) => void;
  updateSettings: (newSettings: Partial<SettingsConfig>) => void;
}

const defaultResults: RegistrationResults = {
  rmse: 0.68,
  raw: 21389,
  inliers: 18742,
  ratio: 87.6,
  ce90: 0.91,
  nni: 0.84,
  coverage: 81,
  time: '18.42',
  method: 'LightGlue + Phase Congruency',
  matcherUsed: 'lightglue',
};

const defaultSettings: SettingsConfig = {
  defaultGsdStrategy: 'Common coarsest GSD',
  defaultMatcher: 'Automatic gate routing',
  heatmapOpacity: 70,
  coordinateSystem: 'Selenographic (Lat / Lon)',
  apiUrl: API_BASE_URL,
  autoSave: true,
  theme: 'dark',
};

export const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultReferenceImage: ImageMetadata = {
  name: 'reference.png (LRO NAC Grid)',
  size: 502748,
  type: 'image/png',
  sensor: 'LRO NAC',
  gsd: '0.50 m/px',
  sunAngle: '142.1° / 34.5°',
  previewUrl: '/synthetic/reference.png',
};

const defaultSourceImage: ImageMetadata = {
  name: 'synthetic_target.png (OHRC 7° Rot / 0.92 Scale)',
  size: 726420,
  type: 'image/png',
  sensor: 'Chandrayaan-2 OHRC',
  gsd: '0.50 m/px',
  sunAngle: '284.3° / 32.1°',
  previewUrl: '/synthetic/synthetic_target.png',
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<WorkbenchView>('dashboard');
  const [isAppMode, setIsAppMode] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('selene_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
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
  const [results, setResults] = useState<RegistrationResults>(defaultResults);
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
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      sensor: 'LRO NAC',
      gsd: '0.50 m/px',
      sunAngle: '142.1° / 34.5°',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      file,
    };
    setReferenceImage(metadata);
    addLog(`Loaded Reference: ${file.name}`, 'success');
    addToast(`Reference image loaded: ${file.name}`, 'success', 'Image Loaded');
  };

  const setSourceFile = (file: File) => {
    const gsdMap: Record<string, string> = {
      'Chandrayaan-2 OHRC': '0.25 m/px',
      'Chandrayaan-2 TMC-2': '5.00 m/px',
      'Chandrayaan-2 IIRS': '80.00 m/px',
    };
    const metadata: ImageMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      sensor: sourceSensor,
      gsd: gsdMap[sourceSensor] || '0.25 m/px',
      sunAngle: '284.3° / 32.1°',
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      file,
    };
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
    setRoutedMatcher('NOT EVALUATED');
    addLog('Image pair cleared.', 'info');
    addToast('Image pair cleared. Upload new files to continue.', 'info', 'Pair Reset');
  };

  const loadSyntheticPair = async () => {
    try {
      addLog('Fetching synthetic generated image pair from backend…', 'info');
      const data = await seleneApi.getSyntheticPair();

      const refMeta: ImageMetadata = {
        name: data.reference_name || 'reference.png',
        size: 502748,
        type: 'image/png',
        sensor: 'LRO NAC (Synthetic Ground Truth Grid)',
        gsd: '0.50 m/px',
        sunAngle: '142.1° / 34.5°',
        previewUrl: data.reference_image_url || '/synthetic/reference.png',
      };

      const srcMeta: ImageMetadata = {
        name: data.source_name || 'synthetic_target.png',
        size: 726420,
        type: 'image/png',
        sensor: 'Chandrayaan-2 OHRC (Synthetic Warped)',
        gsd: '0.50 m/px',
        sunAngle: '284.3° / 32.1°',
        previewUrl: data.source_image_url || '/synthetic/synthetic_target.png',
      };

      setReferenceImage(refMeta);
      setSourceImage(srcMeta);
      addLog('Synthetic pair loaded: reference.png and synthetic_target.png (7° rotation / 0.92 scale).', 'success');
      addToast('Synthetic generated pair loaded into UI with visual preview!', 'success', 'Synthetic Loaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load synthetic pair';
      addLog(`Error loading synthetic pair: ${msg}`, 'error');
      addToast('Could not load synthetic pair from backend server.', 'error', 'Fetch Error');
    }
  };

  const runRegistration = async () => {
    if (isProcessing) return;

    // Warn but allow demo run without files
    if (!referenceImage || !sourceImage) {
      addToast(
        'No images uploaded — running in demo/simulation mode.',
        'warn',
        'Demo Mode'
      );
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
    addLog('Starting SELENE-MATCH registration pipeline.', 'info');

    try {
      const { results: res } = await seleneApi.runRegistration(
        referenceImage?.file ?? null,
        sourceImage?.file ?? null,
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
