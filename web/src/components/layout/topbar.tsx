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
  IconServer,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/use-app-store';
import { useCommandPaletteStore } from '../../stores/use-command-palette';
import { useEventStore } from '../../stores/use-event-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useNodes } from '../../hooks/use-nodes';
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
  const { theme, toggleTheme, selectedNodeId, setSelectedNodeId } = useAppStore();
  const { user, logout } = useAuthStore();
  const { data: nodes = [] } = useNodes();
  const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes.find((n) => n.is_local) || nodes[0];
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

  interface BreadcrumbItem {
    label: string;
    path?: string;
  }

  const path = location.pathname;

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    // 1. Detail Pages
    if (/^\/stacks\/[^/]+$/.test(path)) {
      return [
        { label: 'Stacks (Compose)', path: '/stacks' },
        { label: 'Stack Detail' },
      ];
    }
    if (/^\/containers\/[^/]+$/.test(path)) {
      return [
        { label: 'Containers', path: '/containers' },
        { label: 'Container Detail' },
      ];
    }
    if (/^\/networks\/[^/]+$/.test(path)) {
      return [
        { label: 'Networks', path: '/networks' },
        { label: 'Network Detail' },
      ];
    }
    if (/^\/volumes\/[^/]+$/.test(path)) {
      return [
        { label: 'Volumes', path: '/volumes' },
        { label: 'Volume Detail' },
      ];
    }
    if (/^\/images\/[^/]+$/.test(path)) {
      return [
        { label: 'Images', path: '/images' },
        { label: 'Image Detail' },
      ];
    }

    // 2. Main Platform Sections
    if (path === '/' || path === '/dashboard') {
      return [{ label: 'Dashboard' }];
    }
    if (path.startsWith('/templates')) {
      return [{ label: 'App Catalog' }];
    }
    if (path.startsWith('/stacks')) {
      return [{ label: 'Stacks (Compose)' }];
    }
    if (path.startsWith('/containers')) {
      return [{ label: 'Containers' }];
    }
    if (path.startsWith('/networks')) {
      return [{ label: 'Networks' }];
    }
    if (path.startsWith('/volumes')) {
      return [{ label: 'Volumes' }];
    }
    if (path.startsWith('/images')) {
      return [{ label: 'Images' }];
    }
    if (path.startsWith('/proxy')) {
      return [{ label: 'Proxy & SSL' }];
    }
    if (path.startsWith('/registries')) {
      return [{ label: 'Registries' }];
    }
    if (path.startsWith('/nodes')) {
      return [{ label: 'Cluster Nodes' }];
    }
    if (path.startsWith('/users')) {
      return [{ label: 'Users & RBAC' }];
    }

    return [{ label: 'Dashboard' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-[#1F1F24] bg-white/90 dark:bg-[#09090B]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 select-none transition-colors">
      {/* Breadcrumb & Section Name */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-semibold text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          Dockor
        </button>

        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-zinc-300 dark:text-zinc-700 select-none">/</span>
              {crumb.path && !isLast ? (
                <button
                  type="button"
                  onClick={() => navigate(crumb.path!)}
                  className="font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {crumb.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Global Actions */}
      <div className="flex items-center gap-2.5">
        {/* Cluster Node Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-xs border border-zinc-200 dark:border-[#272730] px-2.5 max-w-[200px]"
              title="Switch Active Docker Host"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeNode?.status === 'online'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : 'bg-red-500'
                  }`}
                />
                <IconServer className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                  {activeNode ? activeNode.name : 'Local Engine'}
                </span>
              </div>
              <IconChevronDown className="w-3 h-3 text-zinc-400 shrink-0 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-zinc-400">
              Cluster Node Topology
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {nodes.map((n) => {
              const isSelected = n.id === activeNode?.id;
              const isOnline = n.status === 'online';
              return (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => {
                    setSelectedNodeId(n.id);
                    toast.info(`Switched active host to: ${n.name}`);
                  }}
                  className={`flex items-center justify-between text-xs py-2 cursor-pointer ${
                    isSelected ? 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-blue-600 dark:text-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isOnline ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="truncate text-left">
                      <div className="truncate">{n.name}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {n.hostname || '127.0.0.1'} {n.is_local ? '• Local' : '• Remote Agent'}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/nodes')}
              className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer justify-center"
            >
              Manage Nodes & Enrollment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
            <button className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors focus:outline-none cursor-pointer">
              <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center font-bold text-[11px]">
                {user?.username ? user.username.substring(0, 2).toUpperCase() : 'OP'}
              </div>
              <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 max-w-[80px] truncate">
                {user?.username || 'Operator'}
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 h-3.5 border-0 font-semibold ${
                  user?.role === 'admin'
                    ? 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400'
                    : user?.role === 'viewer'
                    ? 'bg-amber-500/15 text-amber-500 dark:text-amber-400'
                    : 'bg-blue-500/15 text-blue-500 dark:text-blue-400'
                }`}
              >
                {user?.role || 'dev'}
              </Badge>
              <IconChevronDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold leading-none text-zinc-900 dark:text-zinc-100">{user?.username}</p>
                <p className="text-[11px] leading-none text-zinc-500 dark:text-zinc-400 truncate">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)} className="cursor-pointer">
              <IconKey className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              <span>Change Password</span>
            </DropdownMenuItem>
            {user?.role === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/users')} className="cursor-pointer">
                <IconShield className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                <span>Manage Users</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer"
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
