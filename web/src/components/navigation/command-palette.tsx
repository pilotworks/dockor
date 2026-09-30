import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconSearch,
  IconLayoutDashboard,
  IconTemplate,
  IconStack2,
  IconBox,
  IconNetwork,
  IconDatabase,
  IconDisc,
  IconServer2,
  IconServer,
  IconMoon,
  IconSun,
  IconTrash,
  IconRefresh,
  IconPlus,
  IconCornerDownLeft,
} from '@tabler/icons-react';
import { useContainers } from '../../hooks/use-containers';
import { useStacks } from '../../hooks/use-stacks';
import { useImages } from '../../hooks/use-images';
import { useVolumes } from '../../hooks/use-volumes';
import { useNetworks } from '../../hooks/use-networks';
import { useAppStore } from '../../stores/use-app-store';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface PaletteItem {
  id: string;
  category: 'Actions' | 'Navigation' | 'Containers' | 'Stacks' | 'Images' | 'Volumes' | 'Networks';
  title: string;
  subtitle?: string;
  icon: any;
  action: () => void;
  badge?: string;
  badgeColor?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrune?: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenPrune }: CommandPaletteProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: containers = [] } = useContainers();
  const { data: stacks = [] } = useStacks();
  const { data: images = [] } = useImages();
  const { data: volumes = [] } = useVolumes();
  const { data: networks = [] } = useNetworks();

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list: PaletteItem[] = [];

    // 1. Quick Actions
    list.push({
      id: 'action-deploy',
      category: 'Actions',
      title: 'Deploy New App from Catalog',
      subtitle: 'Browse pre-configured application templates',
      icon: IconPlus,
      action: () => {
        navigate('/templates');
        onClose();
      },
    });

    list.push({
      id: 'action-refresh',
      category: 'Actions',
      title: 'Synchronize All Docker State',
      subtitle: 'Invalidate cache and fetch fresh daemon data',
      icon: IconRefresh,
      action: async () => {
        onClose();
        await queryClient.invalidateQueries();
        toast.success('Docker Engine state refreshed');
      },
    });

    list.push({
      id: 'action-theme',
      category: 'Actions',
      title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: `Current theme: ${theme}`,
      icon: theme === 'dark' ? IconSun : IconMoon,
      action: () => {
        toggleTheme();
        onClose();
      },
    });

    if (onOpenPrune) {
      list.push({
        id: 'action-prune',
        category: 'Actions',
        title: 'System Prune & Cleanup',
        subtitle: 'Remove unused containers, networks, dangling images, and build cache',
        icon: IconTrash,
        action: () => {
          onClose();
          onOpenPrune();
        },
      });
    }

    // 2. Navigation items
    const navs = [
      { id: 'nav-dash', title: 'Go to Dashboard', path: '/dashboard', icon: IconLayoutDashboard },
      { id: 'nav-containers', title: 'Go to Containers', path: '/containers', icon: IconBox },
      { id: 'nav-stacks', title: 'Go to Stacks (Compose)', path: '/stacks', icon: IconStack2 },
      { id: 'nav-images', title: 'Go to Images', path: '/images', icon: IconDisc },
      { id: 'nav-registries', title: 'Go to Registries', path: '/registries', icon: IconServer2 },
      { id: 'nav-volumes', title: 'Go to Volumes', path: '/volumes', icon: IconDatabase },
      { id: 'nav-networks', title: 'Go to Networks', path: '/networks', icon: IconNetwork },
      { id: 'nav-templates', title: 'Go to Application Catalog', path: '/templates', icon: IconTemplate },
      { id: 'nav-nodes', title: 'Go to Cluster Nodes', path: '/nodes', icon: IconServer },
    ];
    navs.forEach((n) => {
      list.push({
        id: n.id,
        category: 'Navigation',
        title: n.title,
        icon: n.icon,
        action: () => {
          navigate(n.path);
          onClose();
        },
      });
    });

    // 3. Containers
    containers.forEach((c) => {
      const name = (c.names && c.names[0] ? c.names[0] : c.id).replace(/^\//, '');
      const isRunning = c.state === 'running';
      list.push({
        id: `container-${c.id}`,
        category: 'Containers',
        title: name,
        subtitle: `${c.image || 'Unknown'} • ${isRunning ? 'Running' : 'Stopped'}`,
        icon: IconBox,
        badge: isRunning ? 'running' : 'stopped',
        badgeColor: isRunning ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-500/10 text-zinc-500',
        action: () => {
          navigate(`/containers/${c.id}`);
          onClose();
        },
      });
    });

    // 4. Stacks
    stacks.forEach((s) => {
      list.push({
        id: `stack-${s.id}`,
        category: 'Stacks',
        title: s.name,
        subtitle: `Status: ${s.status}`,
        icon: IconStack2,
        badge: s.status,
        badgeColor: s.status === 'running' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-500/10 text-zinc-500',
        action: () => {
          navigate(`/stacks/${s.id}`);
          onClose();
        },
      });
    });

    // 5. Images
    images.slice(0, 15).forEach((img) => {
      const tag = img.repo_tags && img.repo_tags.length > 0 ? img.repo_tags[0] : img.short_id || img.id.slice(0, 12);
      list.push({
        id: `image-${img.id}`,
        category: 'Images',
        title: tag,
        subtitle: `ID: ${img.short_id || img.id.slice(0, 12)}`,
        icon: IconDisc,
        action: () => {
          navigate(`/images/${img.id}`);
          onClose();
        },
      });
    });

    // 6. Volumes
    volumes.slice(0, 10).forEach((vol) => {
      list.push({
        id: `volume-${vol.name}`,
        category: 'Volumes',
        title: vol.name,
        subtitle: `Driver: ${vol.driver || 'local'}`,
        icon: IconDatabase,
        action: () => {
          navigate(`/volumes/${vol.name}`);
          onClose();
        },
      });
    });

    // 7. Networks
    networks.slice(0, 10).forEach((net) => {
      list.push({
        id: `net-${net.Id}`,
        category: 'Networks',
        title: net.Name,
        subtitle: `Driver: ${net.Driver} • Scope: ${net.Scope}`,
        icon: IconNetwork,
        action: () => {
          navigate(`/networks/${net.Id}`);
          onClose();
        },
      });
    });

    return list;
  }, [containers, stacks, images, volumes, networks, theme, onOpenPrune, navigate, onClose, queryClient, toggleTheme]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Prioritize actions & navigation when search is empty
      return items.filter((i) => i.category === 'Actions' || i.category === 'Navigation');
    }
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    // Scroll active item into view
    const list = listRef.current;
    if (list) {
      const activeEl = list.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-start justify-center pt-[12vh] p-4 animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#272730] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-[#202026] bg-zinc-50/50 dark:bg-[#0E0E12]/80 shrink-0">
          <IconSearch className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search containers, stacks, images, volumes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm font-sans text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          <kbd className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700/50">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 divide-y divide-transparent">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              No matching commands or resources found for "{query}"
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">{item.title}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full uppercase font-bold tracking-wider ${
                              isSelected ? 'bg-white/20 text-white' : item.badgeColor || 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-blue-100' : 'text-zinc-400'
                          }`}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60'
                      }`}
                    >
                      {item.category}
                    </span>
                    {isSelected && <IconCornerDownLeft className="w-3.5 h-3.5 text-white/80" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-[#202026] bg-zinc-50 dark:bg-[#0A0A0D] flex items-center justify-between text-[11px] text-zinc-400 font-mono shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">↵</kbd> select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700">esc</kbd> close
            </span>
          </div>
          <span>Dockor Command Palette</span>
        </div>
      </div>
    </div>
  );
}
