import {
  IconLayoutDashboard,
  IconTemplate,
  IconStack2,
  IconBox,
  IconNetwork,
  IconDatabase,
  IconDisc,
  IconServer,
  IconCpu,
  IconExternalLink,
  IconCircleFilled,
  IconCheck,
  IconSun,
  IconMoon,
  IconServer2,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/use-app-store';
import { useAuthStore } from '../../stores/use-auth-store';
import { useHealth, useNodes } from '../../hooks/use-nodes';
import { useContainers } from '../../hooks/use-containers';
import { useStacks } from '../../hooks/use-stacks';
import { useTemplates } from '../../hooks/use-templates';
import { useNetworks } from '../../hooks/use-networks';
import { useVolumes } from '../../hooks/use-volumes';
import { useImages } from '../../hooks/use-images';
import { useRegistries } from '../../hooks/use-registries';
import { useProxyRoutes } from '../../hooks/use-proxy';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { DockorLogo } from '../brand/dockor-logo';

export function Sidebar() {
  const { selectedNodeId, theme, toggleTheme } = useAppStore();
  const currentUser = useAuthStore((state) => state.user);
  const location = useLocation();
  const { data: health } = useHealth();
  const { data: nodes = [] } = useNodes();
  const { data: containers = [] } = useContainers();
  const { data: stacks = [] } = useStacks();
  const { data: templatesData } = useTemplates({ limit: 1 });
  const { data: networks = [] } = useNetworks();
  const { data: volumes = [] } = useVolumes();
  const { data: images = [] } = useImages();
  const { data: registries = [] } = useRegistries();
  const { data: proxyRoutes = [] } = useProxyRoutes();

  const totalTemplates = templatesData?.total ?? 0;
  const runningContainers = containers.filter((c) => c.state === 'running').length;
  const isDockerConnected = health?.docker === 'connected';

  const navItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: IconLayoutDashboard,
    },
    {
      path: '/templates',
      label: 'App Catalog',
      icon: IconTemplate,
      badge: totalTemplates > 0 ? `${totalTemplates}` : undefined,
    },
    {
      path: '/stacks',
      label: 'Stacks (Compose)',
      icon: IconStack2,
      badge: stacks.length > 0 ? `${stacks.length}` : undefined,
    },
    {
      path: '/containers',
      label: 'Containers',
      icon: IconBox,
      badge: runningContainers > 0 ? `${runningContainers}` : '0',
      badgeVariant: runningContainers > 0 ? ('success' as const) : ('neutral' as const),
    },
    {
      path: '/networks',
      label: 'Networks',
      icon: IconNetwork,
      badge: networks.length > 0 ? `${networks.length}` : undefined,
    },
    {
      path: '/volumes',
      label: 'Volumes',
      icon: IconDatabase,
      badge: volumes.length > 0 ? `${volumes.length}` : undefined,
    },
    {
      path: '/images',
      label: 'Images',
      icon: IconDisc,
      badge: images.length > 0 ? `${images.length}` : undefined,
    },
    {
      path: '/proxy',
      label: 'Proxy & SSL',
      icon: IconWorld,
      badge: proxyRoutes.length > 0 ? `${proxyRoutes.length}` : undefined,
    },
    {
      path: '/registries',
      label: 'Registries',
      icon: IconServer2,
      badge: registries.length > 0 ? `${registries.length}` : undefined,
    },
    {
      path: '/nodes',
      label: 'Cluster Nodes',
      icon: IconServer,
      badge: nodes.length > 1 ? `${nodes.length}` : undefined,
    },
    ...(currentUser?.role === 'admin'
      ? [
          {
            path: '/users',
            label: 'Users & RBAC',
            icon: IconUsers,
          },
        ]
      : []),
  ];

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-[#1F1F24] bg-white dark:bg-[#09090B] flex flex-col justify-between select-none shrink-0 h-screen sticky top-0 z-30 transition-colors">
      {/* Top Branding & Host Selector */}
      <div className="p-4 space-y-4">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-center p-0.5 shadow-xs shrink-0">
              <DockorLogo className="w-full h-full" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Dockor</span>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700/50">
                v0.1
              </span>
            </div>
          </div>

          <Badge
            variant={isDockerConnected ? 'success' : 'destructive'}
            dot
            className="text-[10px] px-1.5 py-0.5"
          >
            {isDockerConnected ? 'Live' : 'Offline'}
          </Badge>
        </div>

        {/* Node Environment Switcher */}
        {(() => {
          const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
          return (
            <div className="bg-zinc-50 dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-lg p-2 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-2 overflow-hidden">
                <IconCircleFilled
                  className={cn(
                    'w-2 h-2 shrink-0',
                    isDockerConnected ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' : 'text-zinc-400 dark:text-zinc-600'
                  )}
                />
                <div className="truncate text-left min-w-0">
                  <div className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-200 truncate">
                    {activeNode?.name || 'Local Docker Host'}
                  </div>
                  <div
                    className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate"
                    title={activeNode?.endpoint || 'unix:///var/run/docker.sock'}
                  >
                    {activeNode?.endpoint || 'unix:///var/run/docker.sock'}
                  </div>
                </div>
              </div>
              <IconCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            </div>
          );
        })()}

        {/* Navigation Links */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-400 tracking-wider uppercase">
            Platform
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800/90 text-zinc-900 dark:text-white shadow-sm border border-zinc-200 dark:border-zinc-700/60'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/60'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <Badge
                    variant={item.badgeVariant || (isActive ? 'info' : 'neutral')}
                    className="text-[10px] px-1.5 py-0 font-mono"
                  >
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Daemon Status Widget & Theme Switch */}
      <div className="p-3 border-t border-zinc-200 dark:border-[#1F1F24] bg-zinc-50/50 dark:bg-[#0C0C0E]/50 space-y-2 transition-colors">
        <div className="p-2.5 rounded-lg bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <IconCpu className="w-3.5 h-3.5 text-zinc-400" />
              Engine Status
            </span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px]">
              {isDockerConnected ? 'Ready' : 'Unavailable'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
            <span>Socket API</span>
            <span>v1.45</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {theme === 'dark' ? (
              <>
                <IconMoon className="w-3.5 h-3.5 text-blue-400" />
                <span>Theme: Dark</span>
              </>
            ) : (
              <>
                <IconSun className="w-3.5 h-3.5 text-amber-500" />
                <span>Theme: Light</span>
              </>
            )}
          </button>

          <a
            href="https://github.com/pilotworks/dockor"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <span>GitHub</span>
            <IconExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </aside>
  );
}
