import { create } from 'zustand';

export type NavTab = 'templates' | 'stacks' | 'containers' | 'nodes';
export type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('dockor-theme');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return 'dark'; // default to dark
}

function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('dockor-theme', theme);
}

// Apply on startup
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme());
}

interface AppState {
  activeTab: NavTab;
  selectedNodeId: string;
  theme: Theme;
  setActiveTab: (tab: NavTab) => void;
  setSelectedNodeId: (nodeId: string) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'templates',
  selectedNodeId: 'node_local',
  theme: getInitialTheme(),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));
