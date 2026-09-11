import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Target,
  Layers,
  GitMerge,
  Activity,
  Download,
  Terminal,
  Settings,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkbenchView } from '../../types';

interface NavItemDef {
  key: WorkbenchView;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const workspaceNav: NavItemDef[] = [
  { key: 'dashboard',  label: 'Overview',        icon: LayoutDashboard },
  { key: 'upload',     label: '1. Image Pair',   icon: UploadCloud },
  { key: 'register',   label: '2. Registration', icon: Target },
  { key: 'matches',    label: '3. Match Vectors', icon: GitMerge },
  { key: 'results',    label: '4. Visual Split',  icon: Layers },
  { key: 'metrics',    label: '5. Metrics',      icon: Activity },
  { key: 'exports',    label: '6. Exports',      icon: Download },
];

const systemNav: NavItemDef[] = [
  { key: 'logs',     label: 'Logs Feed', icon: Terminal },
  { key: 'settings', label: 'Settings',  icon: Settings },
  { key: 'about',    label: 'About Suite', icon: Info },
];

export const Sidebar: React.FC = () => {
  const { currentView, navigateTo, sidebarCollapsed, toggleSidebar, goHome, isComplete, isProcessing } = useApp();

  const renderNavItem = (item: NavItemDef) => {
    const Icon = item.icon;
    const isActive = currentView === item.key;

    return (
      <a
        key={item.key}
        href={`#/${item.key}`}
        onClick={(e) => { e.preventDefault(); navigateTo(item.key); }}
        title={sidebarCollapsed ? item.label : undefined}
        className={`group flex items-center ${
          sidebarCollapsed ? 'justify-center px-0 py-2.5 mx-2' : 'gap-3 px-3 py-2.5 mx-2'
        } rounded-lg text-xs select-none transition-all ${
          isActive
            ? 'bg-sky-100/70 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-l-4 border-sky-600 dark:border-sky-400 font-bold shadow-xs'
            : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/80 border-l-4 border-transparent font-semibold'
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 ${
            isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
          }`}
        />

        {!sidebarCollapsed && (
          <span className="flex-1 truncate">
            {item.label}
          </span>
        )}
      </a>
    );
  };

  return (
    <aside
      id="main-sidebar"
      className={`flex flex-col shrink-0 h-full relative border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 transition-all duration-200 ${
        sidebarCollapsed ? 'w-16 min-w-[64px] max-w-[64px] sidebar-collapsed' : 'w-[230px] min-w-[230px]'
      }`}
      style={{ width: sidebarCollapsed ? '64px' : '230px' }}
    >
      {/* LOGO HEADER */}
      <div
        className={`h-[60px] shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center ${
          sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        } bg-white dark:bg-slate-950`}
      >
        {!sidebarCollapsed ? (
          <>
            <a
              href="#home"
              onClick={(e) => { e.preventDefault(); goHome(); }}
              className="flex items-center gap-2.5 overflow-hidden"
              title="Back to Landing Page"
            >
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 font-extrabold text-xs shadow-sm">
                S
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-sm text-slate-900 dark:text-white block leading-none truncate">
                  SELENE-MATCH
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate font-medium mt-0.5">SIH Problem #26166</span>
              </div>
            </a>

            <button
              onClick={toggleSidebar}
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg transition-colors"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-900 rounded-lg transition-colors"
            title="Expand Sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </button>
        )}
      </div>

      {/* PIPELINE STATUS STRIP */}
      {!sidebarCollapsed ? (
        <div className="mx-3 my-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 flex items-center gap-2 shadow-xs">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isProcessing
                ? 'bg-amber-500 animate-pulse'
                : isComplete
                ? 'bg-emerald-500'
                : 'bg-slate-400'
            }`}
          />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-1 truncate">
            {isProcessing ? 'Processing Pipeline...' : isComplete ? 'Registration Complete' : 'System Ready'}
          </span>
        </div>
      ) : (
        <div className="my-2 flex justify-center" title={isProcessing ? 'Processing Pipeline...' : isComplete ? 'Registration Complete' : 'System Ready'}>
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isProcessing
                ? 'bg-amber-500 animate-pulse'
                : isComplete
                ? 'bg-emerald-500'
                : 'bg-slate-400'
            }`}
          />
        </div>
      )}

      {/* NAVIGATION LIST */}
      <nav className="flex-1 py-2 space-y-4 overflow-y-auto">
        <div>
          {!sidebarCollapsed && (
            <div className="px-4 mb-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Workflow Steps
            </div>
          )}
          <div className="space-y-0.5">
            {workspaceNav.map(renderNavItem)}
          </div>
        </div>

        <div>
          {!sidebarCollapsed && (
            <div className="px-4 mb-1.5 text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              System Tools
            </div>
          )}
          <div className="space-y-0.5">
            {systemNav.map(renderNavItem)}
          </div>
        </div>
      </nav>
    </aside>
  );
};

