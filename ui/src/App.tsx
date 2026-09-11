import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { StarfieldCanvas } from './components/common/StarfieldCanvas';
import { ToastContainer } from './components/common/ToastContainer';
import { LandingPage } from './components/landing/LandingPage';
import { WorkbenchLayout } from './components/workbench/WorkbenchLayout';

const AppContent: React.FC = () => {
  const { isAppMode } = useApp();

  return (
    <>
      <StarfieldCanvas />
      {isAppMode ? <WorkbenchLayout /> : <LandingPage />}

      <ToastContainer />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
