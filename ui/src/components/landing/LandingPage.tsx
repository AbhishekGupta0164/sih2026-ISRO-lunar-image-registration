import React from 'react';
import { TopNav } from './TopNav';
import { HeroSection } from './HeroSection';
import { ScrollSequenceHero } from './ScrollSequenceHero';
import { MissionSection } from './MissionSection';
import { WorkflowSection } from './WorkflowSection';
import { TechnologySection } from './TechnologySection';
import { ResultsSection } from './ResultsSection';
import { LandingFooter } from './LandingFooter';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 selection:bg-sky-600 selection:text-white dark:selection:bg-sky-400 dark:selection:text-slate-950 transition-colors">
      <TopNav />
      <main className="relative z-10 space-y-2 pb-8">
        <HeroSection />
        <ScrollSequenceHero />
        <MissionSection />
        <WorkflowSection />
        <TechnologySection />
        <ResultsSection />
      </main>
      <LandingFooter />
    </div>
  );
};
