import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContainer, useContainerAction } from '../../hooks/use-containers';
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
} from '@tabler/icons-react';
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
import { toast } from 'sonner';
import { useAppStore } from '../../stores/use-app-store';
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

  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'terminal' | 'stats' | 'inspect'>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [envSearch, setEnvSearch] = useState('');

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!id || !container) return;
    try {
      await actionMutation.mutateAsync({ id, action });
      toast.success(`Container ${container.name} ${action}ed`);
      refetch();
    } catch (err: any) {
      toast.error(`Failed to ${action} container`, { description: err.message });
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

  const isRunning = container.state.running;
  const isPaused = container.state.paused;
  const isRestarting = container.state.restarting;

  const stateVariant = isRunning
    ? 'success'
    : isRestarting
    ? 'warning'
    : isPaused
    ? 'warning'
    : 'neutral';

  const containerName = container.name.replace(/^\//, '');
  const shortId = container.id.slice(0, 12);

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
              disabled={actionMutation.isPending}
              onClick={() => handleAction('stop')}
              className="gap-1.5 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
              title="Stop container"
            >
              <IconPlayerStop className="w-3.5 h-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              variant="surface"
              size="sm"
              disabled={actionMutation.isPending}
              onClick={() => handleAction('start')}
              className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              title="Start container"
            >
              <IconPlayerPlay className="w-3.5 h-3.5" />
              Start
            </Button>
          )}

          <Button
            variant="surface"
            size="sm"
            disabled={actionMutation.isPending}
            onClick={() => handleAction('restart')}
            className="gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            title="Restart container"
          >
            <IconRotateClockwise className="w-3.5 h-3.5" />
            Restart
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
                  {container.state.status}
                </Badge>
                {container.config.labels?.['com.docker.compose.project'] && (
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
                  onClick={() => copyToClipboard(container.config.image || container.image, 'img')}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  title="Click to copy image tag"
                >
                  <span className="truncate max-w-[280px]">Image: {container.config.image || container.image}</span>
                  {copiedKey === 'img' ? <IconCheck className="w-3 h-3 text-emerald-500" /> : <IconCopy className="w-3 h-3 text-zinc-400" />}
                </button>

                <span>•</span>
                <span>Created: {new Date(container.created).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats Highlights */}
          <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-100 dark:border-zinc-800">
            <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-[#202026] rounded-lg px-3 py-1.5 text-right font-mono">
              <span className="text-[10px] uppercase font-semibold text-zinc-400 block">IP Address</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {container.network_settings.ip_address || 'Host/None'}
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
                  {Object.keys(container.network_settings.ports || {}).length} configured
                </span>
              </div>

              {Object.keys(container.network_settings.ports || {}).length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 font-mono">
                  No public ports exposed on host
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-[#1C1C22]">
                  {Object.entries(container.network_settings.ports || {}).map(([cPort, bindings], idx) => {
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
                  {Object.keys(container.network_settings.networks || {}).length} networks
                </span>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {Object.entries(container.network_settings.networks || {}).map(([netName, netInfo], idx) => (
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
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
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
                  Environment Variables ({container.config.env?.length || 0})
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
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                  {(container.config.env || [])
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

      {/* Raw JSON Inspect Tab */}
      {activeTab === 'inspect' && (
        <Card className="bg-white dark:bg-[#121216] border-zinc-200 dark:border-[#23232A] p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Docker Engine JSON Specification
            </span>
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
          <div className="bg-zinc-50 dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 overflow-auto max-h-[65vh]">
            <pre className="text-xs font-mono text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(container, null, 2)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

// Embedded Logs Component
function EmbeddedContainerLogs({ containerId }: { containerId: string }) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const [tail, setTail] = useState('150');
  const [autoScroll, setAutoScroll] = useState(true);
  const [reconnectKey, setReconnectKey] = useState(0);

  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const logsBufferRef = useRef<string>('');

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = isDark ? darkXtermTheme : lightXtermTheme;
    }
  }, [isDark]);

  useEffect(() => {
    if (!terminalElement) return;

    logsBufferRef.current = '';
    const term = new Terminal({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 5000,
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
      term.writeln('\x1b[32m[Stream connected successfully]\x1b[0m\r\n');
      setTimeout(() => fitAddon.fit(), 50);
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === 'string' ? event.data : textDecoder.decode(event.data);
      logsBufferRef.current += data;
      term.write(data);
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
    <div className="flex flex-col h-[65vh]">
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0E0E12] flex items-center justify-between shrink-0 transition-colors">
        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
          Container Logs Stream
        </span>
        <div className="flex items-center gap-2">
          <Select value={tail} onValueChange={(val) => setTail(val)}>
            <SelectTrigger className="h-7 w-[120px] px-2 text-[11px] font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="150">Last 150</SelectItem>
              <SelectItem value="500">Last 500</SelectItem>
              <SelectItem value="1000">Last 1000</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={autoScroll ? 'primary' : 'surface'}
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-7 px-2 text-xs gap-1"
          >
            <IconArrowDownCircle className="w-3.5 h-3.5" /> Scroll
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(logsBufferRef.current);
              toast.success('Logs copied');
            }}
            className="h-7 px-2 text-xs gap-1"
          >
            <IconCopy className="w-3.5 h-3.5" /> Copy
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => xtermInstance.current?.clear()}
            className="h-7 px-2 text-xs gap-1"
          >
            <IconClearAll className="w-3.5 h-3.5" /> Clear
          </Button>

          <Button
            variant="surface"
            size="sm"
            onClick={() => setReconnectKey((k) => k + 1)}
            className="h-7 px-2 text-xs gap-1"
          >
            <IconRefresh className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>
      <div ref={setTerminalElement} className="flex-1 w-full p-3 overflow-hidden bg-white dark:bg-[#09090B]" />
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
