import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ArrowRight, Menu, X, Sun, Moon } from 'lucide-react';

export const TopNav: React.FC = () => {
  const { openWorkbench, theme, toggleTheme } = useApp();
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 py-3.5 px-6 shadow-xl text-slate-900 dark:text-white transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-600 dark:text-sky-400 font-extrabold text-sm shadow-sm">
              S
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block">
                SELENE-MATCH
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Chandrayaan-2 Multi-Modal Lunar Image Registration</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#home" className="hover:text-sky-600 dark:hover:text-sky-300 transition-colors">Overview</a>
            <a href="#mission" className="hover:text-sky-600 dark:hover:text-sky-300 transition-colors">Problem Statement</a>
            <a href="#workflow" className="hover:text-sky-600 dark:hover:text-sky-300 transition-colors">Workflow</a>
            <a href="#technology" className="hover:text-sky-600 dark:hover:text-sky-300 transition-colors">Algorithms</a>
            <a href="#results" className="hover:text-sky-600 dark:hover:text-sky-300 transition-colors">Benchmarks</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <button
              onClick={() => openWorkbench('dashboard')}
              className="px-4.5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-all border border-sky-400/30 shadow-md shadow-sky-600/20"
            >
              Open Workbench
            </button>

            <button
              className="md:hidden p-1.5 text-slate-900 dark:text-white"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[60px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 text-sm font-medium text-slate-800 dark:text-slate-200 md:hidden">
          <a href="#home" onClick={() => setMobileOpen(false)} className="py-2 border-b border-slate-100 dark:border-slate-800">Overview</a>
          <a href="#mission" onClick={() => setMobileOpen(false)} className="py-2 border-b border-slate-100 dark:border-slate-800">Mission</a>
          <a href="#workflow" onClick={() => setMobileOpen(false)} className="py-2 border-b border-slate-100 dark:border-slate-800">Workflow</a>
          <a href="#technology" onClick={() => setMobileOpen(false)} className="py-2 border-b border-slate-100 dark:border-slate-800">Algorithms</a>
          <a href="#results" onClick={() => setMobileOpen(false)} className="py-2 border-b border-slate-100 dark:border-slate-800">Benchmarks</a>
          <button
            className="mt-2 py-3 text-sm font-semibold rounded-lg bg-sky-600 text-white flex items-center justify-center gap-2"
            onClick={() => {
              setMobileOpen(false);
              openWorkbench('dashboard');
            }}
          >
            Launch Workbench
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
