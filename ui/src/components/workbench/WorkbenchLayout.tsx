import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { ImageRequiredModal } from '../common/ImageRequiredModal';

import { DashboardView } from './views/DashboardView';
import { UploadView } from './views/UploadView';
import { RegisterView } from './views/RegisterView';
import { ResultsView } from './views/ResultsView';
import { MatchesView } from './views/MatchesView';
import { MetricsView } from './views/MetricsView';
import { ExportsView } from './views/ExportsView';
import { LogsView } from './views/LogsView';
import { SettingsView } from './views/SettingsView';
import { AboutView } from './views/AboutView';

export const WorkbenchLayout: React.FC = () => {
  const { currentView, missingImagesModal, setMissingImagesModal } = useApp();
  const mainScrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentView]);

  const renderActiveView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardView />;
      case 'upload':    return <UploadView />;
      case 'register':  return <RegisterView />;
      case 'results':   return <ResultsView />;
      case 'matches':   return <MatchesView />;
      case 'metrics':   return <MetricsView />;
      case 'exports':   return <ExportsView />;
      case 'logs':      return <LogsView />;
      case 'settings':  return <SettingsView />;
      case 'about':     return <AboutView />;
      default:          return <DashboardView />;
    }
  };

  return (
    <div
      id="view-app"
      className="h-screen w-full flex overflow-hidden text-sm bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 transition-colors"
    >
      <Sidebar />
      <main
        id="app-main"
        className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative z-10 bg-slate-50 dark:bg-[#030712] transition-colors"
      >
        <Header />
        <div
          ref={mainScrollRef}
          id="workbench-scroll-container"
          className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-12"
        >
          <div className="max-w-7xl mx-auto space-y-6">
            {renderActiveView()}
          </div>
        </div>
        <Footer />
      </main>
      <ImageRequiredModal
        state={missingImagesModal}
        onClose={() => setMissingImagesModal(null)}
      />
    </div>
  );
};

