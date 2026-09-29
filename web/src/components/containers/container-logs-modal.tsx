import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  IconFileText,
  IconRefresh,
  IconClearAll,
  IconCopy,
  IconCircleFilled,
  IconArrowDownCircle,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface ContainerLogsModalProps {
  containerId: string;
  containerName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ContainerLogsModal({
  containerId,
  containerName,
  isOpen,
  onClose,
}: ContainerLogsModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const logsBufferRef = useRef<string>('');

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [tail, setTail] = useState<string>('200');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

    setStatus('connecting');
    logsBufferRef.current = '';

    // Initialize xterm.js instance for logs viewer
    const term = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#09090b',
        selectionBackground: '#2563eb55',
        black: '#18181b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Connect WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/api/v1/containers/${containerId}/logs?follow=true&tail=${tail}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        logsBufferRef.current += event.data;
        term.write(event.data);
        if (autoScroll) {
          term.scrollToBottom();
        }
      }
    };

    ws.onerror = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[31m[WebSocket connection error]\x1b[0m');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    const handleResize = () => {
      fitAddonInstance.current?.fit();
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
      socketRef.current = null;
    };
  }, [isOpen, containerId, tail]);

  const handleClear = () => {
    logsBufferRef.current = '';
    xtermInstance.current?.clear();
  };

  const handleCopy = () => {
    if (!logsBufferRef.current) {
      toast.info('No logs to copy');
      return;
    }
    navigator.clipboard.writeText(logsBufferRef.current);
    toast.success('Logs copied to clipboard');
  };

  const handleReconnect = () => {
    // Re-trigger useEffect by toggling tail
    setTail((prev) => (prev === '200' ? '201' : '200'));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col bg-[#09090b] border-zinc-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Top Header */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-800 bg-[#0d0d11] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <IconFileText className="w-4 h-4" />
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
                  {status}
                </Badge>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Live Container Stream (stdout/stderr)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            {/* Tail Selector */}
            <select
              value={tail}
              onChange={(e) => setTail(e.target.value)}
              className="h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="50">Last 50 lines</option>
              <option value="100">Last 100 lines</option>
              <option value="200">Last 200 lines</option>
              <option value="500">Last 500 lines</option>
              <option value="1000">Last 1000 lines</option>
            </select>

            {/* Auto Scroll Toggle */}
            <Button
              variant={autoScroll ? 'primary' : 'surface'}
              size="sm"
              onClick={() => {
                const next = !autoScroll;
                setAutoScroll(next);
                if (next) xtermInstance.current?.scrollToBottom();
              }}
              className="h-7 px-2 text-xs gap-1"
              title="Toggle Auto Scroll"
            >
              <IconArrowDownCircle className="w-3.5 h-3.5" />
              Scroll
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2.5 text-xs gap-1 border-zinc-800 text-zinc-300 hover:text-white"
              title="Copy Output"
            >
              <IconCopy className="w-3.5 h-3.5" />
              Copy
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleClear}
              className="h-7 px-2.5 text-xs gap-1 border-zinc-800 text-zinc-300 hover:text-white"
              title="Clear Terminal Output"
            >
              <IconClearAll className="w-3.5 h-3.5" />
              Clear
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleReconnect}
              className="h-7 px-2.5 text-xs gap-1 border-zinc-800 text-zinc-300 hover:text-white"
              title="Reconnect Stream"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        {/* Logs Terminal Output */}
        <div ref={terminalRef} className="flex-1 w-full h-full p-3 overflow-hidden bg-[#09090b]" />
      </DialogContent>
    </Dialog>
  );
}
