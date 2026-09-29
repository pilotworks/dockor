import { useState } from 'react';
import { IconRefresh, IconSearch, IconPlus, IconSun, IconMoon, IconTrash } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/use-app-store';
import { useTemplateStore } from '../../stores/use-template-store';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { SystemPruneModal } from '../system/system-prune-modal';

export function Topbar() {
  const { theme, toggleTheme } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery } = useTemplateStore();
  const queryClient = useQueryClient();
  const [isPruneOpen, setIsPruneOpen] = useState(false);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
    toast.success('Data synchronized with Docker Engine');
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    templates: {
      title: 'Application Catalog',
      subtitle: 'Verified container stacks with dynamic schema configurations',
    },
    stacks: {
      title: 'Compose Stacks',
      subtitle: 'Multi-service declarative deployments running on this node',
    },
    containers: {
      title: 'Container Engine',
      subtitle: 'Direct inspection of Docker containers, ports, and lifecycle states',
    },
    networks: {
      title: 'Virtual Networks',
      subtitle: 'Software-defined networking namespaces, subnets, and container routing',
    },
    nodes: {
      title: 'Cluster Topology',
      subtitle: 'Connected Docker engines and remote agent endpoints',
    },
  };

  const path = location.pathname;
  const isStackDetail = /^\/stacks\/[^/]+$/.test(path);
  const isContainerDetail = /^\/containers\/[^/]+$/.test(path);
  const isNetworkDetail = /^\/networks\/[^/]+$/.test(path);

  const current = path.startsWith('/stacks')
    ? titles.stacks
    : path.startsWith('/containers')
    ? titles.containers
    : path.startsWith('/networks')
    ? titles.networks
    : path.startsWith('/nodes')
    ? titles.nodes
    : titles.templates;

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-[#1F1F24] bg-white/90 dark:bg-[#09090B]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors">
      {/* Breadcrumb & Section Name */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300"
          onClick={() => navigate('/templates')}
        >
          Dockor
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        {isStackDetail ? (
          <>
            <span
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              onClick={() => navigate('/stacks')}
            >
              Compose Stacks
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Stack Detail</span>
          </>
        ) : isContainerDetail ? (
          <>
            <span
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              onClick={() => navigate('/containers')}
            >
              Containers
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Container Detail</span>
          </>
        ) : isNetworkDetail ? (
          <>
            <span
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
              onClick={() => navigate('/networks')}
            >
              Networks
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Network Detail</span>
          </>
        ) : (
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{current.title}</span>
        )}
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-2.5">
        {/* Global Quick Filter / Search */}
        <div className="relative w-64">
          <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 z-10 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search resources... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-12 h-8"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700/50 pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* Theme Toggle (Light / Dark) */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Current: Dark Mode (Click for Light)' : 'Current: Light Mode (Click for Dark)'}
          className="border-zinc-200 dark:border-[#272730]"
        >
          {theme === 'dark' ? (
            <IconMoon className="w-3.5 h-3.5 text-blue-400 hover:text-blue-300 transition-colors" />
          ) : (
            <IconSun className="w-3.5 h-3.5 text-amber-500 hover:text-amber-600 transition-colors" />
          )}
        </Button>

        {/* Sync / Refresh Button */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleRefresh}
          title="Refresh All State"
          className="border-zinc-200 dark:border-[#272730]"
        >
          <IconRefresh className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
        </Button>

        {/* Docker Prune / Clean System Button */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setIsPruneOpen(true)}
          title="Docker System Prune & Cleanup"
          className="border-zinc-200 dark:border-[#272730] hover:border-amber-400 dark:hover:border-amber-500/60"
        >
          <IconTrash className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 hover:text-amber-500" />
        </Button>

        {/* Quick Launch Custom Stack Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate('/templates')}
          className="gap-1.5 font-medium"
        >
          <IconPlus className="w-3.5 h-3.5" />
          Deploy App
        </Button>
      </div>

      {/* Global Docker System Prune Modal */}
      <SystemPruneModal isOpen={isPruneOpen} onClose={() => setIsPruneOpen(false)} />
    </header>
  );
}
