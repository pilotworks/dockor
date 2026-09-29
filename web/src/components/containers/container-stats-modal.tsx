import { useEffect, useRef, useState } from 'react';
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

interface ContainerStatsModalProps {
  containerId: string;
  containerName: string;
  isOpen: boolean;
  onClose: () => void;
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

interface SparklineProps {
  data: number[];
  color: string;
  gradientId: string;
  maxVal?: number;
  height?: number;
}

function Sparkline({ data, color, gradientId, maxVal, height = 48 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center text-[10px] text-zinc-600 font-mono">
        Collecting live metrics...
      </div>
    );
  }

  const computedMax = maxVal ?? Math.max(...data, 1);
  const width = 300;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const norm = Math.min(1, Math.max(0, val / computedMax));
    const y = height - norm * (height - 6) - 3;
    return { x, y };
  });

  const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ContainerStatsModal({
  containerId,
  containerName,
  isOpen,
  onClose,
}: ContainerStatsModalProps) {
  const [mountedElement, setMountedElement] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = isPaused;

  const [currentStats, setCurrentStats] = useState<ContainerStatsData | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [rxHistory, setRxHistory] = useState<number[]>([]);
  const [txHistory, setTxHistory] = useState<number[]>([]);
  const [blockHistory, setBlockHistory] = useState<number[]>([]);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isOpen || !mountedElement) return;

    setStatus('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173'
      ? `${window.location.hostname}:9000`
      : window.location.host;
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/stats`;

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
          const data: ContainerStatsData = JSON.parse(event.data);
          setCurrentStats(data);

          setCpuHistory((prev) => [...prev.slice(-29), data.cpu_percent]);
          setMemHistory((prev) => [...prev.slice(-29), data.memory_usage]);
          setRxHistory((prev) => [...prev.slice(-29), data.network_rx_rate]);
          setTxHistory((prev) => [...prev.slice(-29), data.network_tx_rate]);
          setBlockHistory((prev) => [...prev.slice(-29), data.block_read_rate + data.block_write_rate]);
        } catch (e) {
          console.warn('[Stats WS] Parse error:', e);
        }
      };

      const triggerFallback = () => {
        if (!hasOpened && window.location.port === '5173') {
          hasOpened = true;
          targetWs.close();
          const fallbackHost = window.location.host;
          const fallbackUrl = `ws://${fallbackHost}/api/v1/containers/${containerId}/stats`;
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
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0 flex flex-col bg-[#09090b] dark:bg-[#09090b] border-zinc-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Top Header */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-800 bg-[#0d0d11] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
              <IconActivity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold text-zinc-100 font-mono">
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
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                    {currentStats.online_cpus} CPU{currentStats.online_cpus > 1 ? 's' : ''} • {currentStats.pids_count} PIDs
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Real-Time Container Telemetry & Resource Profiler (1s interval)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              variant="surface"
              size="sm"
              onClick={() => setIsPaused((prev) => !prev)}
              className="h-7 px-2.5 text-xs gap-1 border-zinc-800 text-zinc-300 hover:text-white"
              title={isPaused ? 'Resume live streaming' : 'Pause metrics stream'}
            >
              {isPaused ? <IconPlayerPlay className="w-3.5 h-3.5 text-emerald-400" /> : <IconPlayerPause className="w-3.5 h-3.5" />}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleReconnect}
              className="h-7 px-2.5 text-xs gap-1 border-zinc-800 text-zinc-300 hover:text-white"
              title="Refresh Stream"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Reconnect
            </Button>
          </div>
        </DialogHeader>

        {/* Dashboard Content Container */}
        <div ref={setMountedElement} className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#09090b]">
          {/* Top Row: CPU & RAM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. CPU Usage Card */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <IconCpu className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">CPU Usage</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-bold text-blue-400">
                    {currentStats ? `${currentStats.cpu_percent.toFixed(1)}%` : '--'}
                  </span>
                </div>
              </div>

              {/* Sparkline Graph */}
              <div className="bg-zinc-900/40 rounded-lg p-2 border border-zinc-900">
                <Sparkline data={cpuHistory} color="#38bdf8" gradientId="cpuGrad" maxVal={100} height={52} />
              </div>

              {/* Per-Core Breakdown */}
              {currentStats?.per_cpu_usage && currentStats.per_cpu_usage.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
                    Per-Core Distribution ({currentStats.per_cpu_usage.length} Cores)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {currentStats.per_cpu_usage.map((corePct, idx) => (
                      <div key={idx} className="bg-zinc-900/80 border border-zinc-800/60 rounded px-2 py-1 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-zinc-400">C{idx}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, corePct)}%` }} />
                          </div>
                          <span className="text-zinc-200">{corePct.toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Memory Usage Card */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <IconServer className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">Memory Usage</span>
                </div>
                <div className="text-right flex items-baseline gap-1.5">
                  <span className="text-lg font-mono font-bold text-emerald-400">
                    {currentStats ? formatBytes(currentStats.memory_usage) : '--'}
                  </span>
                  {currentStats?.memory_limit ? (
                    <span className="text-[11px] font-mono text-zinc-400">
                      / {formatBytes(currentStats.memory_limit)}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Progress Bar & Details */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">
                    Allocation ({currentStats ? `${currentStats.memory_percent.toFixed(1)}%` : '0%'})
                  </span>
                  {currentStats && currentStats.memory_cache > 0 && (
                    <span className="text-zinc-400">
                      Cache: {formatBytes(currentStats.memory_cache)}
                    </span>
                  )}
                </div>
                <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/60">
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

              {/* Sparkline Graph */}
              <div className="bg-zinc-900/40 rounded-lg p-2 border border-zinc-900">
                <Sparkline
                  data={memHistory}
                  color="#34d399"
                  gradientId="memGrad"
                  maxVal={currentStats?.memory_limit || undefined}
                  height={52}
                />
              </div>
            </div>
          </div>

          {/* Bottom Row: Network I/O & Block I/O */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 3. Network I/O Card */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <IconArrowsExchange className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">Network Traffic</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-emerald-400">
                    ↓ {currentStats ? formatRate(currentStats.network_rx_rate) : '--'}
                  </span>
                  <span className="text-blue-400">
                    ↑ {currentStats ? formatRate(currentStats.network_tx_rate) : '--'}
                  </span>
                </div>
              </div>

              {/* Dual Sparklines */}
              <div className="bg-zinc-900/40 rounded-lg p-2 border border-zinc-900 space-y-2">
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                    <span className="text-emerald-400">Inbound (Rx)</span>
                    <span>{currentStats ? formatRate(currentStats.network_rx_rate) : '--'}</span>
                  </div>
                  <Sparkline data={rxHistory} color="#10b981" gradientId="rxGrad" height={36} />
                </div>
                <div className="border-t border-zinc-900/80 pt-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-0.5">
                    <span className="text-blue-400">Outbound (Tx)</span>
                    <span>{currentStats ? formatRate(currentStats.network_tx_rate) : '--'}</span>
                  </div>
                  <Sparkline data={txHistory} color="#3b82f6" gradientId="txGrad" height={36} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-900 text-[11px] font-mono">
                <div className="bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[10px]">Total Inbound</span>
                  <span className="text-zinc-200 font-semibold">{currentStats ? formatBytes(currentStats.network_rx_bytes) : '0 B'}</span>
                </div>
                <div className="bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[10px]">Total Outbound</span>
                  <span className="text-zinc-200 font-semibold">{currentStats ? formatBytes(currentStats.network_tx_bytes) : '0 B'}</span>
                </div>
              </div>
            </div>

            {/* 4. Block I/O (Storage Disk) Card */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <IconDatabase className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">Disk Block I/O</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-amber-400">
                    R: {currentStats ? formatRate(currentStats.block_read_rate) : '--'}
                  </span>
                  <span className="text-orange-400">
                    W: {currentStats ? formatRate(currentStats.block_write_rate) : '--'}
                  </span>
                </div>
              </div>

              {/* Sparkline */}
              <div className="bg-zinc-900/40 rounded-lg p-2 border border-zinc-900 space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span>I/O Throughput</span>
                  <span>Read + Write</span>
                </div>
                <Sparkline data={blockHistory} color="#f59e0b" gradientId="blockGrad" height={44} />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-900 text-[11px] font-mono">
                <div className="bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[10px]">Total Read</span>
                  <span className="text-zinc-200 font-semibold">{currentStats ? formatBytes(currentStats.block_read_bytes) : '0 B'}</span>
                </div>
                <div className="bg-zinc-900/60 rounded px-2.5 py-1.5 border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[10px]">Total Write</span>
                  <span className="text-zinc-200 font-semibold">{currentStats ? formatBytes(currentStats.block_write_bytes) : '0 B'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
