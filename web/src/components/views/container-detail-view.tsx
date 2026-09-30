import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContainer, useContainerAction } from '../../hooks/use-containers';
import { useNetworks, useConnectNetwork, useDisconnectNetwork } from '../../hooks/use-networks';
import { useTabQuery } from '../../hooks/use-tab-query';
import {
  IconBox,
  IconArrowLeft,
  IconPlayerPlay,
  IconPlayerStop,
  IconRotateClockwise,
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconTerminal2,
  IconFileText,
  IconActivity,
  IconInfoCircle,
  IconCode,
  IconExternalLink,
  IconNetwork,
  IconDatabase,
  IconLoader2,
  IconArrowDownCircle,
  IconClearAll,
  IconRefresh,
  IconPlus,
  IconUnlink,
  IconDeviceFloppy,
  IconTrash,
  IconFolder,
  IconDownload,
  IconSearch,
  IconTextWrap,
} from '@tabler/icons-react';
import { ContainerFileBrowser } from '../containers/container-file-browser';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { JsonViewer } from '../editor/json-viewer';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { CommitContainerModal } from '../containers/commit-container-modal';
import { useAppStore } from '../../stores/use-app-store';
import { confirmDialog } from '../../stores/use-dialog-store';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ContainerStatsData } from '../../types';

function formatBytes(bytes?: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  return `${val} ${sizes[i]}`;
}


const lightXtermTheme = {
  background: '#ffffff',
  foreground: '#18181b',
  cursor: '#2563eb',
  cursorAccent: '#ffffff',
  selectionBackground: '#2563eb33',
  black: '#000000',
  red: '#dc2626',
  green: '#16a34a',
  yellow: '#ca8a04',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#71717a',
  brightBlack: '#52525b',
  brightRed: '#ef4444',
  brightGreen: '#22c55e',
  brightYellow: '#eab308',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#18181b',
};

const darkXtermTheme = {
  background: '#09090b',
  foreground: '#f4f4f5',
  cursor: '#38bdf8',
  cursorAccent: '#09090b',
  selectionBackground: '#2563eb55',
  black: '#18181b',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#fafafa',
  brightBlack: '#71717a',
  brightRed: '#f87171',
  brightGreen: '#34d399',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

export function ContainerDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: container, isLoading, refetch } = useContainer(id);
  const actionMutation = useContainerAction();

  const [activeTab, setActiveTab] = useTabQuery(
    ['overview', 'network', 'logs', 'terminal', 'stats', 'files', 'inspect'] as const,
    'overview'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [envSearch, setEnvSearch] = useState('');

  // Networking Hooks & State
  const { data: allNetworks = [] } = useNetworks();
  const connectMutation = useConnectNetwork();
  const disconnectMutation = useDisconnectNetwork();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState('');

  const connectedNetworkList = useMemo(() => {
    return Object.entries(container?.network_settings?.networks || {});
  }, [container?.network_settings?.networks]);

  const unconnectedNetworks = useMemo(() => {
    const connectedNames = new Set(Object.keys(container?.network_settings?.networks || {}));
    return allNetworks.filter((n) => !connectedNames.has(n.Name) && !connectedNames.has(n.Id));
  }, [allNetworks, container?.network_settings?.networks]);

  const handleConnectNetwork = async () => {
    if (!id || !selectedNetworkId) return;
    try {
      await connectMutation.mutateAsync({
        networkId: selectedNetworkId,
        containerId: id,
      });
      toast.success('Container connected to network');
      setIsConnectModalOpen(false);
      setSelectedNetworkId('');
      refetch();
    } catch (err: any) {
      toast.error('Failed to connect container to network', { description: err.message });
    }
  };

  const handleDisconnectNetwork = async (netName: string, netId: string) => {
    if (!id) return;
    const confirmed = await confirmDialog({
      title: 'Disconnect Network',
      description: `Are you sure you want to disconnect this container from network "${netName}"?`,
      confirmText: 'Disconnect',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await disconnectMutation.mutateAsync({
          networkId: netId,
          containerId: id,
          force: true,
        });
        toast.success(`Disconnected from "${netName}"`);
        refetch();
      } catch (err: any) {
        toast.error('Failed to disconnect from network', { description: err.message });
      }
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [loadingAction, setLoadingAction] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [isCommitOpen, setIsCommitOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!id || !container) return;
    setLoadingAction(action);
    try {
      await actionMutation.mutateAsync({ id, action });
      toast.success(`Container ${container.name} ${action}ed`);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to ${action} container`, { description: err.message });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!id || !container) return;
    const isRunning = Boolean(container.state?.running);
    const containerName = (container.name || '').replace(/^\//, '') || container.id?.slice(0, 12) || 'container';
    const confirmed = await confirmDialog({
      title: isRunning ? 'Force Delete Running Container' : 'Delete Container',
      description: isRunning
        ? `Container "${containerName}" is currently running. Deleting it will forcibly stop and remove it. Are you sure you want to proceed?`
        : `Are you sure you want to permanently delete container "${containerName}"? This action cannot be undone.`,
      confirmText: isRunning ? 'Force Delete' : 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await api.deleteContainer(id, isRunning);
      toast.success(`Container ${containerName} deleted successfully`);
      navigate('/containers');
    } catch (err: any) {
      toast.error('Failed to delete container', { description: err.message });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3">
        <IconLoader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        <p className="text-xs text-zinc-500 font-mono">Inspecting container specifications...</p>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="py-24 text-center space-y-3">
        <IconBox className="w-10 h-10 text-zinc-400 mx-auto" />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Container Not Found</h3>
        <p className="text-xs text-zinc-500">The requested container ID does not exist or has been removed.</p>
        <Button variant="surface" size="sm" onClick={() => navigate('/containers')} className="gap-1.5 mt-2">
          <IconArrowLeft className="w-4 h-4" /> Back to Containers
        </Button>
      </div>
    );
  }

  const isRunning = Boolean(container.state?.running);
  const isPaused = Boolean(container.state?.paused);
  const isRestarting = Boolean(container.state?.restarting);

  const stateVariant = isRunning
    ? 'success'
    : isRestarting
    ? 'warning'
    : isPaused
    ? 'warning'
    : 'neutral';

  const containerName = (container.name || '').replace(/^\//, '') || container.id || 'Unnamed Container';
  const shortId = (container.id || '').slice(0, 12);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <Button
            variant="surface"
            size="sm"
            onClick={() => navigate('/containers')}
            className="gap-1 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            <IconArrowLeft className="w-3.5 h-3.5" />
            Containers
          </Button>
          <span className="text-zinc-400">/</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{containerName}</span>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="surface"
              size="sm"
              disabled={Boolean(loadingAction) || actionMutation.isPending}
              onClick={() => handleAction('stop')}
              className="gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
              title="Stop container"
            >
              {loadingAction === 'stop' ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconPlayerStop className="w-3.5 h-3.5" />
              )}
              {loadingAction === 'stop' ? 'Stopping...' : 'Stop'}
            </Button>
          ) : (
            <Button
              variant="surface"
              size="sm"
              disabled={Boolean(loadingAction) || actionMutation.isPending}
              onClick={() => handleAction('start')}
              className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              title="Start container"
            >
              {loadingAction === 'start' ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconPlayerPlay className="w-3.5 h-3.5" />
              )}
              {loadingAction === 'start' ? 'Starting...' : 'Start'}
            </Button>
          )}

          <Button
            variant="surface"
            size="sm"
            disabled={Boolean(loadingAction) || actionMutation.isPending}
            onClick={() => handleAction('restart')}
            className="gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            title="Restart container"
          >
            {loadingAction === 'restart' ? (
              <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <IconRotateClockwise className="w-3.5 h-3.5" />
            )}
            {loadingAction === 'restart' ? 'Restarting...' : 'Restart'}
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setIsCommitOpen(true)}
            className="gap-1.5 text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
            title="Commit container changes to a new image"
          >
            <IconDeviceFloppy className="w-3.5 h-3.5" />
            Commit
          </Button>

          <Button
            variant="surface"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
            className="gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            title="Delete container"
          >
            <IconTrash className="w-3.5 h-3.5" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-[#09090B] border border-blue-200 dark:border-[#272730] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner shrink-0">
              <IconBox className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">
                  {containerName}
                </h1>
                <Badge variant={stateVariant} dot className="text-xs capitalize font-medium">
                  {container.state?.status || 'unknown'}
                </Badge>
                {container.config?.labels?.['com.docker.compose.project'] && (
                  <Badge variant="neutral" className="text-[10px] font-mono">
                    Stack: {container.config.labels['com.docker.compose.project']}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 dark:text-zinc-400 flex-wrap">
                <button
                  type="button"
                  onClick={() => copyToClipboard(container.id, 'id')}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  title="Click to copy full Container ID"
                >
                  <span>ID: {shortId}</span>
                  {copiedKey === 'id' ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3 text-zinc-400" />}
                </button>

                <span>•</span>

                <button
                  type="button"
                  onClick={() => copyToClipboard(container.config?.image || container.image || '', 'img')}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  title="Click to copy image tag"
                >
                  <span className="truncate max-w-[280px]">Image: {container.config?.image || container.image || 'Unknown'}</span>
                  {copiedKey === 'img' ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3 text-zinc-400" />}
                </button>

                <span>•</span>
                <span>Created: {container.created ? new Date(container.created).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Highlights */}
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
            <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg px-3 py-1.5 text-right font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block">IP Address</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {container.network_settings?.ip_address || 'Host/None'}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg px-3 py-1.5 text-right font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Platform</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {container.platform || 'linux/amd64'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-[#202026] overflow-x-auto select-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconInfoCircle className="w-4 h-4" />
          <span>Overview & Specs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'network'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconNetwork className="w-4 h-4" />
          <span>Networking</span>
          {connectedNetworkList.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {connectedNetworkList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconFileText className="w-4 h-4" />
          <span>Live Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'terminal'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconTerminal2 className="w-4 h-4" />
          <span>Web Terminal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconActivity className="w-4 h-4" />
          <span>Telemetry & Metrics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'files'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconFolder className="w-4 h-4" />
          <span>Files</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inspect')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'inspect'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <IconCode className="w-4 h-4" />
          <span>Raw Inspect</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Top Row: Ports & Networks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Port Forwardings */}
            <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <IconExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  Port Mappings
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {Object.keys(container.network_settings?.ports || {}).length} configured
                </span>
              </div>

              {Object.keys(container.network_settings?.ports || {}).length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 font-mono">
                  No public ports exposed on host
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
                  {Object.entries(container.network_settings?.ports || {}).map(([cPort, bindings], idx) => {
                    const hasBinding = bindings && bindings.length > 0;
                    const hostPort = hasBinding ? bindings[0].host_port : null;
                    const hostIp = hasBinding ? bindings[0].host_ip || '0.0.0.0' : null;

                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400 font-bold">{cPort}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          {hasBinding ? (
                            <span className="text-zinc-900 dark:text-zinc-100">
                              {hostIp}:{hostPort}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Not bound</span>
                          )}
                        </div>

                        {hasBinding && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`http://${window.location.hostname}:${hostPort}`, `port-${idx}`)}
                              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                              title="Copy URL"
                            >
                              {copiedKey === `port-${idx}` ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                            </button>
                            <a
                              href={`http://${window.location.hostname}:${hostPort}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              Open <IconExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Network Interfaces */}
            <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <IconNetwork className="w-3.5 h-3.5 text-purple-500" />
                  Network Topology
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {Object.keys(container.network_settings?.networks || {}).length} networks
                </span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {Object.entries(container.network_settings?.networks || {}).map(([netName, netInfo], idx) => (
                  <div key={idx} className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-zinc-100">
                      <span>{netName}</span>
                      <Badge variant="neutral" className="text-[9px] px-1 py-0">Connected</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                      <div>IP: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.ip_address || '--'}</span></div>
                      <div>Gateway: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.gateway || '--'}</span></div>
                      <div>MAC: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.mac_address || '--'}</span></div>
                      <div>Mode: <span className="text-zinc-800 dark:text-zinc-200">{container.host_config?.network_mode || 'default'}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Mounts & Volumes */}
          <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <IconDatabase className="w-3.5 h-3.5 text-amber-500" />
                Storage Mounts & Volumes
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {(container.mounts || []).length} mounts
              </span>
            </div>

            {(container.mounts || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400 font-mono">
                No storage volumes or bind mounts attached
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase text-zinc-400">
                      <th className="py-2">Type</th>
                      <th className="py-2">Source / Host Path</th>
                      <th className="py-2">Destination / Target</th>
                      <th className="py-2 text-right">Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {(container.mounts || []).map((m, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <td className="py-2.5">
                          <Badge variant="neutral" className="text-[10px] uppercase">{m.type}</Badge>
                        </td>
                        <td className="py-2.5 text-zinc-800 dark:text-zinc-200 truncate max-w-xs" title={m.source}>
                          {m.name || m.source}
                        </td>
                        <td className="py-2.5 text-blue-600 dark:text-blue-400 font-semibold truncate max-w-xs" title={m.destination}>
                          {m.destination}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`text-[10px] font-semibold ${m.rw ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {m.rw ? 'Read-Write (rw)' : 'Read-Only (ro)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Environment Variables Table */}
          <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Environment Variables ({container.config?.env?.length || 0})
                </span>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  type="text"
                  placeholder="Search variables..."
                  value={envSearch}
                  onChange={(e) => setEnvSearch(e.target.value)}
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-[10px] uppercase text-zinc-400 sticky top-0 bg-white dark:bg-[#121216]">
                    <th className="py-2 w-1/3">Key</th>
                    <th className="py-2">Value</th>
                    <th className="py-2 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {(container.config?.env || [])
                    .filter((e) => e.toLowerCase().includes(envSearch.toLowerCase()))
                    .map((envStr, idx) => {
                      const eqIdx = envStr.indexOf('=');
                      const key = eqIdx > -1 ? envStr.slice(0, eqIdx) : envStr;
                      const val = eqIdx > -1 ? envStr.slice(eqIdx + 1) : '';
                      const isSecret = key.toLowerCase().includes('pass') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key') || key.toLowerCase().includes('token');
                      const revealed = showSecrets[key];

                      return (
                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="py-2 font-semibold text-zinc-800 dark:text-zinc-200">{key}</td>
                          <td className="py-2 text-zinc-600 dark:text-zinc-400 break-all">
                            {isSecret && !revealed ? '••••••••••••••••' : val}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isSecret && (
                                <button
                                  type="button"
                                  onClick={() => setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))}
                                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                  title={revealed ? 'Mask secret' : 'Reveal secret'}
                                >
                                  {revealed ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(val, `env-${idx}`)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                title="Copy value"
                              >
                                {copiedKey === `env-${idx}` ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Networking & Ports Tab */}
      {activeTab === 'network' && (
        <div className="space-y-5">
          {/* Top Network Action & Overview Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <IconNetwork className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Network Connectivity
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Connected to {connectedNetworkList.length} network{connectedNetworkList.length === 1 ? '' : 's'} • Mode: <span className="font-mono text-zinc-700 dark:text-zinc-300">{container.host_config?.network_mode || 'bridge'}</span>
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-1.5 self-start sm:self-auto"
            >
              <IconPlus className="w-4 h-4" /> Connect Network
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Connected Networks */}
            <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <IconNetwork className="w-3.5 h-3.5 text-purple-500" />
                  Connected Networks
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {connectedNetworkList.length} total
                </span>
              </div>

              {connectedNetworkList.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 font-mono">
                  No active network interfaces attached
                </div>
              ) : (
                <div className="space-y-3">
                  {connectedNetworkList.map(([netName, netInfo], idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 space-y-2.5 font-mono text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">{netName}</span>
                          <Badge variant="neutral" className="text-[9px] px-1 py-0">Connected</Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/networks`)}
                            className="h-6 px-1.5 text-[10px] gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                            title="View Networks"
                          >
                            <IconExternalLink className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={disconnectMutation.isPending}
                            onClick={() => handleDisconnectNetwork(netName, netInfo.network_id || netName)}
                            className="h-6 px-1.5 text-[10px] gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Disconnect from network"
                          >
                            <IconUnlink className="w-3 h-3" /> Disconnect
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                        <div>IP Address: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{netInfo.ip_address || '--'}</span></div>
                        <div>Gateway: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.gateway || '--'}</span></div>
                        <div>MAC: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.mac_address || '--'}</span></div>
                        <div>Endpoint: <span className="text-zinc-800 dark:text-zinc-200 truncate">{netInfo.endpoint_id ? netInfo.endpoint_id.slice(0, 12) : '--'}</span></div>
                        {netInfo.global_ipv6_address && (
                          <div className="col-span-2">IPv6: <span className="text-zinc-800 dark:text-zinc-200">{netInfo.global_ipv6_address}</span></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Port Forwardings */}
            <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <IconExternalLink className="w-3.5 h-3.5 text-blue-500" />
                  Port Mappings & Exposure
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {Object.keys(container.network_settings?.ports || {}).length} configured
                </span>
              </div>

              {Object.keys(container.network_settings?.ports || {}).length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-400 font-mono">
                  No public ports exposed on host
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {Object.entries(container.network_settings?.ports || {}).map(([cPort, bindings], idx) => {
                    const hasBinding = bindings && bindings.length > 0;
                    const hostPort = hasBinding ? bindings[0].host_port : null;
                    const hostIp = hasBinding ? bindings[0].host_ip || '0.0.0.0' : null;

                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-600 dark:text-zinc-400 font-bold">{cPort}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          {hasBinding ? (
                            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">
                              {hostIp}:{hostPort}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic">Not bound to host</span>
                          )}
                        </div>

                        {hasBinding && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`http://${window.location.hostname}:${hostPort}`, `net-port-${idx}`)}
                              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                              title="Copy URL"
                            >
                              {copiedKey === `net-port-${idx}` ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3" />}
                            </button>
                            <a
                              href={`http://${window.location.hostname}:${hostPort}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              Open <IconExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* DNS & Host Configuration Card */}
          <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm font-mono text-xs">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-sans flex items-center gap-1.5">
              <IconInfoCircle className="w-3.5 h-3.5 text-zinc-400" />
              DNS & Host Network Configuration
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block font-sans">Hostname</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate block">
                  {container.config?.hostname || '--'}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block font-sans">Primary IP</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-semibold truncate block">
                  {container.network_settings?.ip_address || 'Host/None'}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block font-sans">Gateway</span>
                <span className="text-zinc-800 dark:text-zinc-200 truncate block">
                  {container.network_settings?.gateway || '--'}
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-zinc-400 block font-sans">MAC Address</span>
                <span className="text-zinc-800 dark:text-zinc-200 truncate block">
                  {container.network_settings?.mac_address || '--'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Embedded Live Logs Tab */}
      {activeTab === 'logs' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-0 overflow-hidden shadow-sm">
          <EmbeddedContainerLogs containerId={container.id} />
        </Card>
      )}

      {/* Embedded Terminal Tab */}
      {activeTab === 'terminal' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-0 overflow-hidden shadow-sm">
          <EmbeddedContainerTerminal containerId={container.id} />
        </Card>
      )}

      {/* Embedded Telemetry Tab */}
      {activeTab === 'stats' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-5 shadow-sm">
          <EmbeddedContainerStats containerId={container.id} />
        </Card>
      )}

      {/* Container Files Tab */}
      {activeTab === 'files' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-0 overflow-hidden shadow-sm">
          <ContainerFileBrowser containerId={container.id} />
        </Card>
      )}

      {/* Raw JSON Inspect Tab */}
      {activeTab === 'inspect' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-[#0E0E12] border-b border-zinc-200 dark:border-[#202026]">
            <div className="flex items-center gap-2">
              <IconCode className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                Docker Engine JSON Specification
              </span>
            </div>
            <Button
              variant="surface"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(container, null, 2));
                toast.success('Inspect JSON copied to clipboard');
              }}
              className="gap-1.5 text-xs h-7"
            >
              <IconCopy className="w-3.5 h-3.5" />
              Copy JSON
            </Button>
          </div>
          <JsonViewer data={container} height="65vh" />
        </Card>
      )}

      {/* Connect Container to Network Modal */}
      <Dialog open={isConnectModalOpen} onOpenChange={setIsConnectModalOpen}>
        <DialogContent className="max-w-md p-0 bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
          <DialogHeader className="px-6 py-4 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <IconNetwork className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Connect to Network
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 mt-0.5">
                  Attach container `{containerName}` to a Docker network.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Select Network
              </label>
              {unconnectedNetworks.length === 0 ? (
                <p className="text-xs text-zinc-500">This container is already attached to all available networks.</p>
              ) : (
                <Select value={selectedNetworkId} onValueChange={setSelectedNetworkId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose a network..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unconnectedNetworks.map((net) => (
                      <SelectItem key={net.Id} value={net.Id}>
                        {net.Name} ({net.Driver})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#1E1E24]">
              <Button variant="ghost" size="sm" onClick={() => setIsConnectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConnectNetwork}
                disabled={!selectedNetworkId || connectMutation.isPending}
                className="gap-1.5"
              >
                {connectMutation.isPending && <IconLoader2 className="w-3.5 h-3.5 animate-spin" />}
                Connect Network
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commit Container to Image Modal */}
      <CommitContainerModal
        isOpen={isCommitOpen}
        onClose={() => setIsCommitOpen(false)}
        containerId={id || ''}
        containerName={containerName}
      />
    </div>
  );
}

// Embedded Logs Component - Logs Stream Pro
function EmbeddedContainerLogs({ containerId }: { containerId: string }) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const [tail, setTail] = useState('150');
  const [autoScroll, setAutoScroll] = useState(true);
  const [reconnectKey, setReconnectKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [severity, setSeverity] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [wrapLines, setWrapLines] = useState(true);

  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const logsBufferRef = useRef<string>('');
  const allLinesRef = useRef<string[]>([]);

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = isDark ? darkXtermTheme : lightXtermTheme;
    }
  }, [isDark]);

  const matchesFilter = (line: string, query: string, useRegex: boolean, level: 'all' | 'error' | 'warn' | 'info') => {
    const plain = line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const lower = plain.toLowerCase();

    if (level !== 'all') {
      const isErr = lower.includes('error') || lower.includes('err') || lower.includes('fatal') || lower.includes('panic') || lower.includes('failed') || lower.includes('exception');
      const isWrn = lower.includes('warn') || lower.includes('warning');
      const isInf = !isErr && !isWrn;
      if (level === 'error' && !isErr) return false;
      if (level === 'warn' && !isWrn) return false;
      if (level === 'info' && !isInf) return false;
    }

    if (!query.trim()) return true;

    if (useRegex) {
      try {
        const rx = new RegExp(query, 'i');
        return rx.test(plain);
      } catch {
        return true;
      }
    }
    return lower.includes(query.toLowerCase());
  };

  // Re-render filtered lines into xterm
  const replayFilteredLogs = (query: string, useRegex: boolean, level: 'all' | 'error' | 'warn' | 'info') => {
    const term = xtermInstance.current;
    if (!term) return;
    term.clear();
    const matched = allLinesRef.current.filter((line) => matchesFilter(line, query, useRegex, level));
    if (matched.length === 0 && (query || level !== 'all')) {
      term.writeln('\x1b[33m[No log lines match current filters]\x1b[0m\r\n');
    } else {
      matched.forEach((line) => term.writeln(line));
    }
    if (autoScroll) term.scrollToBottom();
  };

  useEffect(() => {
    replayFilteredLogs(searchQuery, isRegex, severity);
  }, [searchQuery, isRegex, severity]);

  const handleDownload = () => {
    const activeLines = (searchQuery || severity !== 'all')
      ? allLinesRef.current.filter((l) => matchesFilter(l, searchQuery, isRegex, severity))
      : (allLinesRef.current.length > 0 ? allLinesRef.current : [logsBufferRef.current]);
    const plainText = activeLines.map((l) => l.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')).join('\n');
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `container-${containerId.slice(0, 12)}-logs.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported to file');
  };

  const handleClear = () => {
    allLinesRef.current = [];
    logsBufferRef.current = '';
    xtermInstance.current?.clear();
    toast.success('Log buffer cleared');
  };

  useEffect(() => {
    if (!terminalElement) return;

    logsBufferRef.current = '';
    allLinesRef.current = [];
    const term = new Terminal({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 10000,
      theme: isDark ? darkXtermTheme : lightXtermTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173' ? `${window.location.hostname}:9000` : window.location.host;
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/logs?follow=true&tail=${tail}`;

    const textDecoder = new TextDecoder();
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      term.writeln('\x1b[32m[Logs Stream connected successfully]\x1b[0m\r\n');
      setTimeout(() => fitAddon.fit(), 50);
    };

    let partialChunk = '';
    ws.onmessage = (event) => {
      const chunk = typeof event.data === 'string' ? event.data : textDecoder.decode(event.data);
      logsBufferRef.current += chunk;

      const lines = (partialChunk + chunk).split(/\r?\n/);
      partialChunk = lines.pop() || '';

      lines.forEach((line) => {
        allLinesRef.current.push(line);
        if (allLinesRef.current.length > 8000) {
          allLinesRef.current.shift();
        }
        if (matchesFilter(line, searchQuery, isRegex, severity)) {
          term.writeln(line);
        }
      });

      if (autoScroll) term.scrollToBottom();
    };

    const handleResize = () => {
      try {
        fitAddonInstance.current?.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [terminalElement, containerId, tail, reconnectKey]);

  return (
    <div className="flex flex-col h-[70vh]">
      {/* Top Filter and Controls Toolbar */}
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E0E12] flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors">
        {/* Left Side: Search & Regex Filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
          <div className="relative flex-1">
            <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder={isRegex ? 'Regex filter (e.g. error|warn|fatal)...' : 'Search logs...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-xs bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-[#272730] rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-zinc-800 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={() => setIsRegex(!isRegex)}
              title={isRegex ? 'Disable Regex' : 'Enable Regex'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1 py-0.5 rounded transition-colors ${
                isRegex
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              .*
            </button>
          </div>

          {/* Severity Filter Buttons */}
          <div className="flex items-center rounded-md border border-zinc-200 dark:border-[#272730] p-0.5 bg-zinc-100/80 dark:bg-[#18181B] text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setSeverity('all')}
              className={`px-2 py-0.5 rounded transition-all ${
                severity === 'all'
                  ? 'bg-white dark:bg-[#272730] text-zinc-900 dark:text-white font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSeverity('error')}
              className={`px-2 py-0.5 rounded transition-all ${
                severity === 'error'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              Error
            </button>
            <button
              type="button"
              onClick={() => setSeverity('warn')}
              className={`px-2 py-0.5 rounded transition-all ${
                severity === 'warn'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              Warn
            </button>
            <button
              type="button"
              onClick={() => setSeverity('info')}
              className={`px-2 py-0.5 rounded transition-all ${
                severity === 'info'
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Info
            </button>
          </div>
        </div>

        {/* Right Side Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Select value={tail} onValueChange={(val) => setTail(val)}>
            <SelectTrigger className="h-7 w-[105px] px-2 text-[11px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="150">Last 150</SelectItem>
              <SelectItem value="500">Last 500</SelectItem>
              <SelectItem value="1000">Last 1000</SelectItem>
              <SelectItem value="5000">Last 5000</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={wrapLines ? 'primary' : 'surface'}
            size="sm"
            onClick={() => setWrapLines(!wrapLines)}
            className="h-7 px-2 text-xs gap-1"
            title={wrapLines ? 'Disable line wrap' : 'Enable line wrap'}
          >
            <IconTextWrap className="w-3.5 h-3.5" /> Wrap
          </Button>

          <Button
            variant={autoScroll ? 'primary' : 'surface'}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-7 px-2 text-xs gap-1"
            title="Auto scroll to bottom"
          >
            <IconArrowDownCircle className="w-3.5 h-3.5" /> Scroll
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2 text-xs gap-1 text-zinc-700 dark:text-zinc-300"
            title="Export / Download logs to file"
          >
            <IconDownload className="w-3.5 h-3.5" /> Export
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(logsBufferRef.current);
              toast.success('Logs copied to clipboard');
            }}
            className="h-7 px-2 text-xs gap-1"
            title="Copy logs to clipboard"
          >
            <IconCopy className="w-3.5 h-3.5" /> Copy
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-xs gap-1 text-red-600 dark:text-red-400"
            title="Clear current log buffer"
          >
            <IconClearAll className="w-3.5 h-3.5" /> Clear
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setReconnectKey((k) => k + 1)}
            className="h-7 px-2 text-xs gap-1"
            title="Reconnect logs stream"
          >
            <IconRefresh className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={setTerminalElement}
        className={`flex-1 w-full p-3 overflow-hidden bg-white dark:bg-[#09090B] ${
          wrapLines ? '' : 'overflow-x-auto whitespace-pre'
        }`}
      />
    </div>
  );
}

// Embedded Terminal Component
function EmbeddedContainerTerminal({ containerId }: { containerId: string }) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const [shell, setShell] = useState('/bin/sh');
  const [reconnectKey, setReconnectKey] = useState(0);

  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = isDark ? darkXtermTheme : lightXtermTheme;
    }
  }, [isDark]);

  useEffect(() => {
    if (!terminalElement) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: isDark ? darkXtermTheme : lightXtermTheme,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173' ? `${window.location.hostname}:9000` : window.location.host;
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/exec?shell=${encodeURIComponent(shell)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      term.focus();
      setTimeout(() => {
        try {
          fitAddon.fit();
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        } catch {
          // ignore
        }
      }, 50);
    };

    const textDecoder = new TextDecoder();
    ws.onmessage = (event) => {
      term.write(typeof event.data === 'string' ? event.data : textDecoder.decode(event.data));
    };

    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      try {
        fitAddonInstance.current?.fit();
        if (ws.readyState === WebSocket.OPEN && xtermInstance.current) {
          ws.send(JSON.stringify({ type: 'resize', cols: xtermInstance.current.cols, rows: xtermInstance.current.rows }));
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      ws.close();
      term.dispose();
    };
  }, [terminalElement, containerId, shell, reconnectKey]);

  return (
    <div className="flex flex-col h-[65vh]">
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E0E12] flex items-center justify-between shrink-0 transition-colors">
        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
          Interactive Shell (TTY)
        </span>
        <div className="flex items-center gap-2">
          <Select value={shell} onValueChange={(val) => setShell(val)}>
            <SelectTrigger className="h-7 w-[110px] px-2 text-[11px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="/bin/sh">/bin/sh</SelectItem>
              <SelectItem value="/bin/bash">/bin/bash</SelectItem>
              <SelectItem value="sh">sh</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="surface"
            size="sm"
            onClick={() => xtermInstance.current?.clear()}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <IconClearAll className="w-3.5 h-3.5" /> Clear
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setReconnectKey((k) => k + 1)}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <IconRefresh className="w-3.5 h-3.5" /> Reconnect
          </Button>
        </div>
      </div>
      <div
        ref={setTerminalElement}
        className="flex-1 w-full p-3 overflow-hidden bg-white dark:bg-[#09090B] cursor-text"
        onClick={() => xtermInstance.current?.focus()}
      />
    </div>
  );
}

// Embedded Telemetry Component
function EmbeddedContainerStats({ containerId }: { containerId: string }) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const tickColor = isDark ? '#71717a' : '#a1a1aa';

  const [currentStats, setCurrentStats] = useState<ContainerStatsData | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173' ? `${window.location.hostname}:9000` : window.location.host;
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/stats`;

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const stats: ContainerStatsData = JSON.parse(event.data);
        setCurrentStats(stats);
        const timeLabel = new Date(stats.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const pt = {
          time: timeLabel,
          cpu: parseFloat(stats.cpu_percent.toFixed(2)),
          memoryMB: parseFloat((stats.memory_usage / (1024 * 1024)).toFixed(1)),
          rxKB: parseFloat((stats.network_rx_rate / 1024).toFixed(1)),
          txKB: parseFloat((stats.network_tx_rate / 1024).toFixed(1)),
          blockReadKB: parseFloat((stats.block_read_rate / 1024).toFixed(1)),
          blockWriteKB: parseFloat((stats.block_write_rate / 1024).toFixed(1)),
        };
        setHistory((prev) => [...prev, pt].slice(-30));
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, [containerId]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU Chart */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">CPU Usage</span>
            <span className="text-xl font-mono font-bold text-sky-500">
              {currentStats ? `${currentStats.cpu_percent.toFixed(1)}%` : '--'}
            </span>
          </div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={[0, (dataMax: number) => Math.max(5, Math.ceil(dataMax * 1.2))]}
                  unit="%"
                  tick={{ fontSize: 10, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <Area type="monotone" dataKey="cpu" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Memory Chart */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">Memory Allocation</span>
            <span className="text-xl font-mono font-bold text-emerald-500">
              {currentStats ? formatBytes(currentStats.memory_usage) : '--'}
            </span>
          </div>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                <XAxis dataKey="time" hide />
                <YAxis
                  domain={[0, (dataMax: number) => Math.max(10, Math.ceil(dataMax * 1.2))]}
                  unit="MB"
                  tick={{ fontSize: 10, fill: tickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <Area type="monotone" dataKey="memoryMB" stroke="#10b981" fill="#10b981" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
