import { useState } from 'react';
import {
  IconRefresh,
  IconSearch,
  IconPlus,
  IconSun,
  IconMoon,
  IconTrash,
  IconActivity,
  IconKey,
  IconLogout,
  IconShield,
  IconChevronDown,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/use-app-store';
import { useCommandPaletteStore } from '../../stores/use-command-palette';
import { useEventStore } from '../../stores/use-event-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { toast } from 'sonner';
import { SystemPruneModal } from '../system/system-prune-modal';
import { ChangePasswordModal } from '../auth/change-password-modal';

export function Topbar() {
  const { theme, toggleTheme } = useAppStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { open: openPalette } = useCommandPaletteStore();
  const { toggleDrawer, unreadCount } = useEventStore();
  const queryClient = useQueryClient();
  const [isPruneOpen, setIsPruneOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

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
    registries: {
      title: 'Container Registries',
      subtitle: 'Encrypted Docker Hub, GHCR, and private registry credentials',
    },
    users: {
      title: 'Users & Access Control',
      subtitle: 'Operator accounts, security roles, and RBAC permissions',
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
        {/* Global Quick Filter / Search - triggers Command Palette */}
        <div
          onClick={openPalette}
          className="relative w-64 cursor-pointer group"
          title="Open Command Palette (⌘K)"
        >
          <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 z-10 pointer-events-none group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
          <div className="w-full h-8 pl-8 pr-12 text-xs flex items-center text-zinc-400 dark:text-zinc-500 bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#272730] group-hover:border-zinc-300 dark:group-hover:border-zinc-700 rounded-md transition-all select-none">
            <span>Search or command...</span>
          </div>
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-200/60 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700/50 pointer-events-none">
            ⌘K
          </kbd>
        </div>

        {/* Real-time Docker Activity Drawer Button */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleDrawer}
          title="Docker Daemon Live Activity Stream"
          className="relative border-zinc-200 dark:border-[#272730]"
        >
          <IconActivity className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : (
            <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
        </Button>

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

        {/* User Session Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border border-border/70 hover:border-border hover:bg-muted/50 transition-colors focus:outline-none">
              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[11px]">
                {user?.username ? user.username.substring(0, 2).toUpperCase() : 'OP'}
              </div>
              <span className="text-xs font-medium text-foreground max-w-[80px] truncate">
                {user?.username || 'Operator'}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 h-3.5 border-0 font-semibold ${
                  user?.role === 'admin'
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : user?.role === 'viewer'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-blue-500/15 text-blue-400'
                }`}
              >
                {user?.role || 'dev'}
              </Badge>
              <IconChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none">{user?.username}</p>
                <p className="text-[11px] leading-none text-muted-foreground truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="cursor-pointer">
              <IconKey className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Change Password</span>
            </DropdownMenuItem>
            {user?.role === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/users')} className="cursor-pointer">
                <IconShield className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Manage Users</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <IconLogout className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global Docker System Prune Modal */}
      <SystemPruneModal isOpen={isPruneOpen} onClose={() => setIsPruneOpen(false)} />

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </header>
  );
}
