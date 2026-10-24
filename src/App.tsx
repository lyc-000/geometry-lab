import { useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { BusyOverlay } from './components/BusyOverlay';
import { HelpDialog } from './components/HelpDialog';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { ToastViewport } from './components/ToastViewport';
import { TopBar } from './components/TopBar';
import { Viewport } from './components/Viewport';
import { WelcomeDialog } from './components/WelcomeDialog';
import { markWelcomeSeen, shouldShowWelcome } from './lib/onboarding';

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(shouldShowWelcome);

  const closeWelcome = () => {
    setWelcomeOpen(false);
    markWelcomeSeen();
  };

  return (
    <TooltipPrimitive.Provider delayDuration={240}>
      <div className="studio-app">
        <TopBar onOpenGuide={() => setHelpOpen(true)} />
        <main className="workspace">
          <LeftPanel />
          <Viewport />
          <RightPanel />
        </main>
        <BusyOverlay />
        <ToastViewport />
      </div>

      <WelcomeDialog
        open={welcomeOpen}
        onOpenChange={(open) => {
          if (open) setWelcomeOpen(true);
          else closeWelcome();
        }}
        onOpenGuide={() => {
          closeWelcome();
          setHelpOpen(true);
        }}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipPrimitive.Provider>
  );
}
