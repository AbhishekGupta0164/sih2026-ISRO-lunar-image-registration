import React from 'react';
import { Sliders, Activity, Server, Save } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { seleneApi } from '../../../services/api';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, addLog, addToast, theme, setTheme } = useApp();

  const handleTestApi = async () => {
    addLog(`Testing API connection to: ${settings.apiUrl}…`, 'info');
    try {
      const isOnline = await seleneApi.checkHealth();
      if (isOnline) {
        addLog(`API connection successful: ${settings.apiUrl}`, 'success');
        addToast(`API connected successfully to ${settings.apiUrl}`, 'success', 'API Connected');
      } else {
        addLog(`API health check failed for: ${settings.apiUrl}`, 'error');
        addToast(`Backend reachable but health check returned non-200.`, 'error', 'API Warning');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      addLog(`API connection failed: ${msg}`, 'error');
      addToast(`Could not connect to API at ${settings.apiUrl}`, 'error', 'API Offline');
    }
  };

  return (
    <section id="view-settings" className="view-section active space-y-6">
      {/* PAGE HEADER */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Workbench Preferences &amp; Configuration
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Configure default registration strategies, API server endpoints, and user interface theme preferences.
        </p>
      </div>

      {/* SETTINGS FORM */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-6 max-w-4xl shadow-xl transition-colors">
        {/* APPEARANCE / THEME PREFERENCES */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
            Interface Appearance Theme
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Application Theme Mode
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none font-semibold"
              >
                <option value="dark">Dark Space Theme (ISRO Deep Space)</option>
                <option value="light">Light Theme (High Contrast Crisp)</option>
              </select>
            </div>
          </div>
        </div>

        {/* REGISTRATION ENGINE */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
            Registration Engine Defaults
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Default GSD Strategy
              </label>
              <select
                value={settings.defaultGsdStrategy}
                onChange={(e) =>
                  updateSettings({ defaultGsdStrategy: e.target.value })
                }
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:border-sky-500 focus:outline-none font-medium"
              >
                <option value="Common coarsest GSD">Common coarsest GSD</option>
                <option value="Reference GSD">Reference GSD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Default Matcher
              </label>
              <select
                value={settings.defaultMatcher}
                onChange={(e) =>
                  updateSettings({ defaultMatcher: e.target.value })
                }
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-sky-600 dark:text-sky-300 font-semibold focus:border-sky-500 focus:outline-none"
              >
                <option value="Automatic gate routing">
                  Automatic gate routing
                </option>
                <option value="LoFTR Dense Deep Matcher">LoFTR Dense Deep Matcher</option>
                <option value="XFeat Lightweight Matcher">XFeat Lightweight Matcher</option>
                <option value="LightGlue">LightGlue</option>
              </select>
            </div>
          </div>
        </div>

        {/* API CONFIGURATION */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-slate-800">
            API Endpoint Configuration
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.apiUrl}
              onChange={(e) => updateSettings({ apiUrl: e.target.value })}
              className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-sky-500 focus:outline-none"
            />
            <button
              onClick={handleTestApi}
              className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 border border-sky-400/30 transition-all"
            >
              Test Connection
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

