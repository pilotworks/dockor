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
  IconTerminal2,
  IconRefresh,
  IconClearAll,
  IconCircleFilled,
} from '@tabler/icons-react';

interface ContainerTerminalModalProps {
  containerId: string;
  containerName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ContainerTerminalModal({
  containerId,
  containerName,
  isOpen,
  onClose,
}: ContainerTerminalModalProps) {
  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [shell, setShell] = useState<string>('/bin/sh');
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  useEffect(() => {
    if (!isOpen || !terminalElement) return;

    setStatus('connecting');

    // 1. Initialize xterm.js instance
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: {
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
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalElement);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // 2. Connect WebSocket: in Vite dev mode (port 5173), connect directly to backend on 9000 to avoid proxy hang
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const primaryHost = window.location.port === '5173'
      ? `${window.location.hostname}:9000`
      : window.location.host;
    const cleanCmd = shell.trim() || '/bin/sh';
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/exec?cmd=${encodeURIComponent(cleanCmd)}`;

    let hasOpened = false;

    const setupWsHandlers = (targetWs: WebSocket) => {
      targetWs.binaryType = 'arraybuffer';
      socketRef.current = targetWs;

      targetWs.onopen = () => {
        hasOpened = true;
        setStatus('connected');
        term.focus();
        try {
          fitAddon.fit();
        } catch {
          // ignore layout fit errors
        }
        if (targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      };

      targetWs.onmessage = (event) => {
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(event.data));
        }
      };

      const triggerFallback = () => {
        if (!hasOpened && window.location.port === '5173') {
          hasOpened = true; // prevent infinite fallback loop
          targetWs.close();
          const fallbackHost = window.location.host;
          const fallbackUrl = `ws://${fallbackHost}/api/v1/containers/${containerId}/exec?cmd=${encodeURIComponent(cleanCmd)}`;
          console.log('[Terminal WS] Retrying connection via fallback:', fallbackUrl);
          const fallbackWs = new WebSocket(fallbackUrl);
          setupWsHandlers(fallbackWs);
          return true;
        }
        return false;
      };

      targetWs.onerror = (e) => {
        console.warn('[Terminal WS Error]', e);
        if (triggerFallback()) return;
        setStatus('disconnected');
        term.writeln('\r\n\x1b[31m[WebSocket Connection Error: Check if container is running and Docker is reachable]\x1b[0m');
      };

      targetWs.onclose = (e) => {
        if (triggerFallback()) return;
        setStatus('disconnected');
        if (e.code !== 1000) {
          term.writeln(`\r\n\x1b[33m[Session Terminated (code: ${e.code})]\x1b[0m`);
        }
      };
    };

    const initialWs = new WebSocket(wsUrl);
    setupWsHandlers(initialWs);

    // Forward user keystrokes to container stdin
    const onDataDisposable = term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (!fitAddonInstance.current || !xtermInstance.current) return;
      try {
        fitAddonInstance.current.fit();
      } catch {
        // ignore layout resize error
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'resize',
            cols: xtermInstance.current.cols,
            rows: xtermInstance.current.rows,
          })
        );
      }
    };

    window.addEventListener('resize', handleResize);

    // Fit terminal once modal dialog animation settles
    const timer = setTimeout(handleResize, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      socketRef.current?.close();
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
      socketRef.current = null;
    };
  }, [isOpen, terminalElement, containerId, shell, reconnectKey]);

  const handleReconnect = () => {
    setReconnectKey((prev) => prev + 1);
  };

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 gap-0 flex flex-col bg-[#09090b] dark:bg-[#09090b] border-zinc-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Top Header */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-800 bg-[#0d0d11] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
              <IconTerminal2 className="w-4 h-4" />
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
                Interactive Container Shell (WebSocket TTY)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            {/* Shell Selector */}
            <Select value={shell} onValueChange={(val) => setShell(val)}>
              <SelectTrigger className="h-7 w-[110px] px-2.5 bg-zinc-900 border-zinc-800 text-[11px] font-mono text-zinc-300 focus:ring-0 focus:border-blue-500 shadow-none">
                <SelectValue placeholder="Shell" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200 z-[100]">
                <SelectItem value="/bin/sh" className="text-[11px] font-mono">
                  /bin/sh
                </SelectItem>
                <SelectItem value="/bin/bash" className="text-[11px] font-mono">
                  /bin/bash
                </SelectItem>
                <SelectItem value="sh" className="text-[11px] font-mono">
                  sh
                </SelectItem>
              </SelectContent>
            </Select>

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
              title="Reconnect Shell"
            >
              <IconRefresh className="w-3.5 h-3.5" />
              Reconnect
            </Button>
          </div>
        </DialogHeader>

        {/* Terminal Canvas Container */}
        <div
          ref={setTerminalElement}
          className="flex-1 w-full h-full p-3 overflow-hidden bg-[#09090b] cursor-text"
          onClick={() => xtermInstance.current?.focus()}
        />
      </DialogContent>
    </Dialog>

  );
}
