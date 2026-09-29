import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [shell, setShell] = useState<string>('/bin/sh');

  useEffect(() => {
    if (!isOpen || !terminalRef.current) return;

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
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    // 2. Connect WebSocket to backend exec endpoint
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/api/v1/containers/${containerId}/exec?cmd=${encodeURIComponent(shell)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      term.focus();
      // Send initial terminal resize geometry
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      }
    };

    ws.onerror = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[31m[WebSocket Connection Error]\x1b[0m');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[33m[Session Terminated]\x1b[0m');
    };

    // Forward user keystrokes to container stdin
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (!fitAddonInstance.current || !xtermInstance.current) return;
      fitAddonInstance.current.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'resize',
            cols: xtermInstance.current.cols,
            rows: xtermInstance.current.rows,
          })
        );
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial delayed fit to ensure modal dialog layout rendered
    const timer = setTimeout(handleResize, 150);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      ws.close();
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
      socketRef.current = null;
    };
  }, [isOpen, containerId, shell]);

  const handleReconnect = () => {
    // Toggling state triggers effect re-run
    setShell((prev) => (prev === '/bin/sh' ? '/bin/sh ' : '/bin/sh'));
  };

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] p-0 flex flex-col bg-[#09090b] border-zinc-800 shadow-2xl rounded-2xl overflow-hidden">
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
            <select
              value={shell.trim()}
              onChange={(e) => setShell(e.target.value)}
              className="h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-blue-500"
            >
              <option value="/bin/sh">/bin/sh</option>
              <option value="/bin/bash">/bin/bash</option>
              <option value="sh">sh</option>
            </select>

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
          ref={terminalRef}
          className="flex-1 w-full h-full p-3 overflow-hidden bg-[#09090b] cursor-text"
          onClick={() => xtermInstance.current?.focus()}
        />
      </DialogContent>
    </Dialog>
  );
}
