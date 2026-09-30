import { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  IconActivity,
  IconCpu,
  IconServer,
  IconArrowsExchange,
  IconDatabase,
  IconCircleFilled,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
} from '@tabler/icons-react';
import { ContainerStatsData } from '../../types';
import { getAuthToken } from '../../lib/api';
import { useAppStore } from '../../stores/use-app-store';

interface ContainerStatsModalProps {
  containerId: string;
  containerName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface MetricPoint {
  time: string;
  cpu: number;
  memoryMB: number;
  rxKB: number;
  txKB: number;
  blockReadKB: number;
  blockWriteKB: number;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
  return `${val} ${sizes[i]}`;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const val = parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

// Custom Adaptive Tooltip Component
function CustomChartTooltip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-xl text-[11px] font-mono space-y-1">
      <div className="text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800 pb-1 mb-1">{label}</div>
      {payload.map((item: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={{ color: item.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}:
          </span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100">
            {typeof item.value === 'number' ? item.value.toFixed(1) : item.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ContainerStatsModal({
  containerId,
  containerName,
  isOpen,
  onClose,
}: ContainerStatsModalProps) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#27272a' : '#e4e4e7';
  const tickColor = isDark ? '#71717a' : '#a1a1aa';

  const [mountedElement, setMountedElement] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = isPaused;

  const [currentStats, setCurrentStats] = useState<ContainerStatsData | null>(null);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isOpen || !mountedElement) return;

    setStatus('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173'
      ? `${window.location.hostname}:9000`
      : window.location.host;
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/stats${tokenParam}`;

    let hasOpened = false;

    const setupWsHandlers = (targetWs: WebSocket) => {
      socketRef.current = targetWs;

      targetWs.onopen = () => {
        hasOpened = true;
        setStatus('connected');
      };

      targetWs.onmessage = (event) => {
        if (isPausedRef.current) return;

        try {
          const stats: ContainerStatsData = JSON.parse(event.data);
          setCurrentStats(stats);

          const timeLabel = new Date(stats.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const point: MetricPoint = {
            time: timeLabel,
            cpu: parseFloat(stats.cpu_percent.toFixed(2)),
            memoryMB: parseFloat((stats.memory_usage / (1024 * 1024)).toFixed(1)),
            rxKB: parseFloat((stats.network_rx_rate / 1024).toFixed(1)),
            txKB: parseFloat((stats.network_tx_rate / 1024).toFixed(1)),
            blockReadKB: parseFloat((stats.block_read_rate / 1024).toFixed(1)),
            blockWriteKB: parseFloat((stats.block_write_rate / 1024).toFixed(1)),
          };

          setHistory((prev) => {
            const next = [...prev, point];
            if (next.length > 30) {
              return next.slice(next.length - 30);
            }
            return next;
          });
        } catch (e) {
          console.warn('[Stats WS] Parse error:', e);
        }
      };

      const triggerFallback = () => {
        if (!hasOpened && window.location.port === '5173') {
          hasOpened = true;
          targetWs.close();
          const fallbackHost = window.location.host;
          const fallbackUrl = `ws://${fallbackHost}/api/v1/containers/${containerId}/stats${tokenParam}`;
          console.log('[Stats WS] Retrying connection via fallback:', fallbackUrl);
          const fallbackWs = new WebSocket(fallbackUrl);
          setupWsHandlers(fallbackWs);
          return true;
        }
        return false;
      };

      targetWs.onerror = (e) => {
        console.warn('[Stats WS Error]', e);
        if (triggerFallback()) return;
        setStatus('disconnected');
      };

      targetWs.onclose = () => {
        if (triggerFallback()) return;
        setStatus('disconnected');
      };
    };

    const initialWs = new WebSocket(wsUrl);
    setupWsHandlers(initialWs);

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [isOpen, mountedElement, containerId, reconnectKey]);

  const handleReconnect = () => {
    setReconnectKey((prev) => prev + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        {/* Top Header */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconActivity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                  {containerName}
                </DialogTitle>
                <Badge
                  variant={status === 'connected' ? 'success' : status === 'connecting' ? 'warning' : 'neutral'}
                  className="text-[10px] gap-1 px-1.5 py-0"
                >
                  <IconCircleFilled className="w-1.5 h-1.5" />
                  {status === 'connected' && isPaused ? 'paused' : status}
                </Badge>
                {currentStats && (
                  <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 px-1.5 py-0.5 rounded">
                    {currentStats.online_cpus} Core{currentStats.online_cpus > 1 ? 's' : ''} • {currentStats.pids_count} PIDs
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Real-Time Container Telemetry & Resource Profiler (Recharts • 1s stream)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              variant="surface"
              size="sm"
              onClick={() => setIsPaused((prev) => !prev)}
              className="h-7 px-2.5 text-xs gap-1"
              title={isPaused ? 'Resume live streaming' : 'Pause metrics stream'}
            >
              {isPaused ? <IconPlayerPlay className="w-3.5 h-3.5 text-emerald-500" /> : <IconPlayerPause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleReconnect}
              className="h-7 px-2.5 text-xs gap-1"
              title="Refresh Stream"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Reconnect
            </Button>
          </div>
        </DialogHeader>

        {/* Dashboard Content Container */}
        <div ref={setMountedElement} className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/50 dark:bg-[#09090B]">
          {/* Top Row: CPU & RAM */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. CPU Usage Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                    <IconCpu className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 block">CPU Utilization</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Last 30 seconds trend</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-sky-600 dark:text-sky-400">
                    {currentStats ? `${currentStats.cpu_percent.toFixed(1)}%` : '--'}
                  </span>
                </div>
              </div>

              {/* Recharts Area Chart */}
              <div className="h-36 w-full bg-zinc-50/80 dark:bg-zinc-900/30 rounded-lg p-2 border border-zinc-200/80 dark:border-zinc-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={[
                        0,
                        (dataMax: number) => {
                          if (!dataMax || dataMax <= 0) return 5;
                          if (dataMax < 5) return 5;
                          if (dataMax < 20) return Math.ceil(dataMax * 1.3);
                          return Math.ceil(dataMax * 1.15);
                        },
                      ]}
                      unit="%"
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip unit="%" />} />
                    <Area
                      type="monotone"
                      name="CPU"
                      dataKey="cpu"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#cpuGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Per-Core Breakdown */}
              {currentStats?.per_cpu_usage && currentStats.per_cpu_usage.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-900">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 block">
                    Per-Core Distribution ({currentStats.per_cpu_usage.length} Cores)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currentStats.per_cpu_usage.map((corePct, idx) => (
                      <div key={idx} className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/60 rounded px-2 py-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-500 dark:text-zinc-400">C{idx}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500 rounded-full" style={{ width: `${Math.min(100, corePct)}%` }} />
                          </div>
                          <span className="text-zinc-800 dark:text-zinc-200">{corePct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Memory Usage Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <IconServer className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 block">Memory Allocation</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {currentStats?.memory_limit ? `Limit: ${formatBytes(currentStats.memory_limit)}` : 'Active memory'}
                    </span>
                  </div>
                </div>
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {currentStats ? formatBytes(currentStats.memory_usage) : '--'}
                  </span>
                  {currentStats?.memory_limit ? (
                    <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                      ({currentStats.memory_percent.toFixed(1)}%)
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Recharts Area Chart */}
              <div className="h-36 w-full bg-zinc-50/80 dark:bg-zinc-900/30 rounded-lg p-2 border border-zinc-200/80 dark:border-zinc-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={[
                        0,
                        (dataMax: number) => {
                          if (!dataMax || dataMax <= 0) return 10;
                          return Math.max(10, Math.ceil(dataMax * 1.2));
                        },
                      ]}
                      unit="MB"
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip unit="MB" />} />
                    <Area
                      type="monotone"
                      name="Memory"
                      dataKey="memoryMB"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#memGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Progress Bar & Details */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-900">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Capacity Used: <span className="text-zinc-800 dark:text-zinc-200 font-medium">{currentStats ? `${currentStats.memory_percent.toFixed(1)}%` : '0%'}</span>
                  </span>
                  {currentStats && currentStats.memory_cache > 0 && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Cache: <span className="text-zinc-700 dark:text-zinc-300">{formatBytes(currentStats.memory_cache)}</span>
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800/60">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out bg-emerald-500"
                    style={{
                      width: `${Math.min(100, currentStats?.memory_percent || 0)}%`,
                      backgroundColor:
                        (currentStats?.memory_percent || 0) > 85
                          ? '#ef4444'
                          : (currentStats?.memory_percent || 0) > 70
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Network I/O & Block I/O */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 3. Network I/O Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <IconArrowsExchange className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 block">Network Traffic</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Download vs Upload Throughput</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    ↓ {currentStats ? formatRate(currentStats.network_rx_rate) : '--'}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    ↑ {currentStats ? formatRate(currentStats.network_tx_rate) : '--'}
                  </span>
                </div>
              </div>

              {/* Recharts Dual Area Chart */}
              <div className="h-36 w-full bg-zinc-50/80 dark:bg-zinc-900/30 rounded-lg p-2 border border-zinc-200/80 dark:border-zinc-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={[
                        0,
                        (dataMax: number) => {
                          if (!dataMax || dataMax <= 0) return 5;
                          return Math.max(5, Math.ceil(dataMax * 1.2));
                        },
                      ]}
                      unit="K"
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip unit="KB/s" />} />
                    <Area
                      type="monotone"
                      name="Inbound (Rx)"
                      dataKey="rxKB"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#rxGradient)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      name="Outbound (Tx)"
                      dataKey="txKB"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#txGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-900 text-[11px] font-mono">
                <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">Total Inbound</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{currentStats ? formatBytes(currentStats.network_rx_bytes) : '0 B'}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">Total Outbound</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">{currentStats ? formatBytes(currentStats.network_tx_bytes) : '0 B'}</span>
                </div>
              </div>
            </div>

            {/* 4. Block I/O Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950/60 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <IconDatabase className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 block">Disk Block I/O</span>
                    <span className="text-[10px] text-zinc-500 font-mono">Storage Read & Write Activity</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    R: {currentStats ? formatRate(currentStats.block_read_rate) : '--'}
                  </span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    W: {currentStats ? formatRate(currentStats.block_write_rate) : '--'}
                  </span>
                </div>
              </div>

              {/* Recharts Area Chart */}
              <div className="h-36 w-full bg-zinc-50/80 dark:bg-zinc-900/30 rounded-lg p-2 border border-zinc-200/80 dark:border-zinc-900">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="readGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="writeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} opacity={0.6} />
                    <XAxis dataKey="time" hide />
                    <YAxis
                      domain={[
                        0,
                        (dataMax: number) => {
                          if (!dataMax || dataMax <= 0) return 5;
                          return Math.max(5, Math.ceil(dataMax * 1.2));
                        },
                      ]}
                      unit="K"
                      tick={{ fontSize: 10, fill: tickColor }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip unit="KB/s" />} />
                    <Area
                      type="monotone"
                      name="Disk Read"
                      dataKey="blockReadKB"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#readGradient)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      name="Disk Write"
                      dataKey="blockWriteKB"
                      stroke="#f97316"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#writeGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-900 text-[11px] font-mono">
                <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">Total Read</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{currentStats ? formatBytes(currentStats.block_read_bytes) : '0 B'}</span>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800/60">
                  <span className="text-zinc-500 dark:text-zinc-400 block text-[10px]">Total Write</span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">{currentStats ? formatBytes(currentStats.block_write_bytes) : '0 B'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
