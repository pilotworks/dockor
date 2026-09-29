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
  IconClearAll,
  IconRefresh,
  IconCircleFilled,
} from '@tabler/icons-react';
import { useAppStore } from '../../stores/use-app-store';

interface ContainerTerminalModalProps {
  containerId: string;
  containerName: string;
  isOpen: boolean;
  onClose: () => void;
}

const lightTheme = {
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

const darkTheme = {
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

export function ContainerTerminalModal({
  containerId,
  containerName,
  isOpen,
  onClose,
}: ContainerTerminalModalProps) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';

  const [terminalElement, setTerminalElement] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [shell, setShell] = useState<string>('/bin/sh');
  const [reconnectKey, setReconnectKey] = useState<number>(0);

  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Dynamically update xterm theme on theme toggle
  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = isDark ? darkTheme : lightTheme;
    }
  }, [isDark]);

  useEffect(() => {
    if (!isOpen || !terminalElement) return;

    setStatus('connecting');

    // 1. Initialize xterm.js instance
    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      theme: isDark ? darkTheme : lightTheme,
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
    const wsUrl = `${proto}//${primaryHost}/api/v1/containers/${containerId}/exec?shell=${encodeURIComponent(shell)}`;

    let hasOpened = false;

    const setupWsHandlers = (targetWs: WebSocket) => {
      socketRef.current = targetWs;
      targetWs.binaryType = 'arraybuffer';

      targetWs.onopen = () => {
        hasOpened = true;
        setStatus('connected');
        term.focus();

        setTimeout(() => {
          try {
            fitAddonInstance.current?.fit();
            if (targetWs.readyState === WebSocket.OPEN) {
              targetWs.send(
                JSON.stringify({
                  type: 'resize',
                  cols: term.cols,
                  rows: term.rows,
                })
              );
            }
          } catch {
            // ignore fit error
          }
        }, 50);
      };

      const textDecoder = new TextDecoder();
      targetWs.onmessage = (event) => {
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          term.write(textDecoder.decode(event.data));
        }
      };

      const triggerFallback = () => {
        if (!hasOpened && window.location.port === '5173') {
          hasOpened = true; // prevent infinite loop
          targetWs.close();
          const fallbackHost = window.location.host;
          const fallbackUrl = `ws://${fallbackHost}/api/v1/containers/${containerId}/exec?shell=${encodeURIComponent(shell)}`;
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
        term.writeln('\r\n\x1b[31m[WebSocket connection error: Check if backend is reachable]\x1b[0m');
      };

      targetWs.onclose = () => {
        if (triggerFallback()) return;
        setStatus('disconnected');
      };
    };

    const initialWs = new WebSocket(wsUrl);
    setupWsHandlers(initialWs);

    // 3. User input forward to WebSocket
    const onDataDisposable = term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: 'input',
            data,
          })
        );
      }
    });

    // 4. Handle resize
    const handleResize = () => {
      try {
        fitAddonInstance.current?.fit();
      } catch {
        // ignore layout resize error
      }
      if (xtermInstance.current && socketRef.current?.readyState === WebSocket.OPEN) {
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
      <DialogContent className="max-w-5xl h-[80vh] p-0 gap-0 flex flex-col bg-white dark:bg-[#0F0F13] border-zinc-200 dark:border-[#272730] shadow-2xl rounded-2xl overflow-hidden transition-colors">
        {/* Top Header */}
        <DialogHeader className="px-5 py-3 border-b border-zinc-200 dark:border-[#1F1F24] bg-zinc-50 dark:bg-[#0A0A0D] flex flex-row items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconTerminal2 className="w-4 h-4" />
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
                  {status}
                </Badge>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                Interactive Container Shell (WebSocket TTY)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            {/* Shell Selector */}
            <Select value={shell} onValueChange={(val) => setShell(val)}>
              <SelectTrigger className="h-7 w-[110px] px-2.5 text-[11px] font-mono focus:ring-0 focus:border-blue-500 shadow-none">
                <SelectValue placeholder="Shell" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
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
              className="h-7 px-2.5 text-xs gap-1"
              title="Clear Terminal Output"
            >
              <IconClearAll className="w-3.5 h-3.5" />
              Clear
            </Button>

            <Button
              variant="surface"
              size="sm"
              onClick={handleReconnect}
              className="h-7 px-2.5 text-xs gap-1"
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
          className="flex-1 w-full h-full p-3 overflow-hidden bg-white dark:bg-[#09090b] cursor-text transition-colors"
          onClick={() => xtermInstance.current?.focus()}
        />
      </DialogContent>
    </Dialog>
  );
}
