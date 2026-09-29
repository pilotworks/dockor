import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const logsBufferRef = useRef<string>('');

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [tail, setTail] = useState<string>('200');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !terminalElement) return;

    setStatus('connecting');
    logsBufferRef.current = '';

    // Initialize xterm.js instance for logs viewer
    const term = new Terminal({
      convertEol: true,
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
    term.open(terminalElement);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // Connect WebSocket: in Vite dev mode (port 5173), connect directly to backend on 9000 to avoid proxy hang
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173'
      ? `${window.location.hostname}:9000`
      : window.location.host;
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/logs?follow=true&tail=${tail}`;

    let hasOpened = false;
    const textDecoder = new TextDecoder();

    const setupWsHandlers = (targetWs: WebSocket) => {
      targetWs.binaryType = 'arraybuffer';
      socketRef.current = targetWs;

      targetWs.onopen = () => {
        hasOpened = true;
        setStatus('connected');
        try {
          fitAddon.fit();
        } catch {
          // ignore layout fit error
        }
      };

      targetWs.onmessage = (event) => {
        if (typeof event.data === 'string') {
          logsBufferRef.current += event.data;
          term.write(event.data);
          if (autoScroll) {
            term.scrollToBottom();
          }
        } else if (event.data instanceof ArrayBuffer) {
          const text = textDecoder.decode(event.data);
          logsBufferRef.current += text;
          term.write(new Uint8Array(event.data));
          if (autoScroll) {
            term.scrollToBottom();
          }
        }
      };

      const triggerFallback = () => {
        if (!hasOpened && window.location.port === '5173') {
          hasOpened = true; // prevent infinite fallback loop
          targetWs.close();
          const fallbackHost = window.location.host;
          const fallbackUrl = `ws://${fallbackHost}/api/v1/containers/${containerId}/logs?follow=true&tail=${tail}`;
          console.log('[Logs WS] Retrying connection via fallback:', fallbackUrl);
          const fallbackWs = new WebSocket(fallbackUrl);
          setupWsHandlers(fallbackWs);
          return true;
        }
        return false;
      };

      targetWs.onerror = (e) => {
        console.warn('[Logs WS Error]', e);
        if (triggerFallback()) return;
        setStatus('disconnected');
        term.writeln('\r\n\x1b[31m[WebSocket connection error: Check if backend is reachable]\x1b[0m');
      };

      targetWs.onclose = () => {
        if (triggerFallback()) return;
        setStatus('disconnected');
      };
    };

    const initialWs = new WebSocket(wsUrl);
    setupWsHandlers(initialWs);

    const handleResize = () => {
      try {
        fitAddonInstance.current?.fit();
      } catch {
        // ignore layout resize error
      }
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      socketRef.current?.close();
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
      socketRef.current = null;
    };
  }, [isOpen, terminalElement, containerId, tail, autoScroll, reconnectKey]);

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
    setReconnectKey((prev) => prev + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 gap-0 flex flex-col bg-[#09090b] dark:bg-[#09090b] border-zinc-800 shadow-2xl rounded-2xl overflow-hidden">
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
            <Select value={tail} onValueChange={(val) => setTail(val)}>
              <SelectTrigger className="h-7 w-[130px] px-2.5 bg-zinc-900 border-zinc-800 text-[11px] font-mono text-zinc-300 focus:ring-0 focus:border-blue-500 shadow-none">
                <SelectValue placeholder="Lines" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200 z-[100]">
                <SelectItem value="50" className="text-[11px] font-mono">
                  Last 50 lines
                </SelectItem>
                <SelectItem value="100" className="text-[11px] font-mono">
                  Last 100 lines
                </SelectItem>
                <SelectItem value="200" className="text-[11px] font-mono">
                  Last 200 lines
                </SelectItem>
                <SelectItem value="500" className="text-[11px] font-mono">
                  Last 500 lines
                </SelectItem>
                <SelectItem value="1000" className="text-[11px] font-mono">
                  Last 1000 lines
                </SelectItem>
              </SelectContent>
            </Select>

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
        <div ref={setTerminalElement} className="flex-1 w-full h-full p-3 overflow-hidden bg-[#09090b]" />
      </DialogContent>
    </Dialog>
  );
}
