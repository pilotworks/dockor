import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { DeployModal } from '../templates/deploy-modal';
import { CommandPalette } from '../navigation/command-palette';
import { ActivityDrawer } from '../navigation/activity-drawer';
import { useCommandPaletteStore } from '../../stores/use-command-palette';
import { useDockerEvents } from '../../hooks/use-docker-events';

interface ShellProps {
  children?: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  // Activate global real-time Docker events stream and cache invalidation
  useDockerEvents();

  const { isOpen, close, toggle } = useCommandPaletteStore();

  // Global Cmd+K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-blue-600/30 selection:text-blue-600 dark:selection:text-blue-200 transition-colors">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>

      {/* Global Deploy Modal */}
      <DeployModal />

      {/* Global Command Palette (Cmd + K) */}
      <CommandPalette isOpen={isOpen} onClose={close} />

      {/* Real-time Docker Activity Drawer */}
      <ActivityDrawer />
    </div>
  );
}
