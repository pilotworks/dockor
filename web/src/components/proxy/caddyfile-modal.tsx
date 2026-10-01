import { useState } from 'react';
import {
  IconX,
  IconCopy,
  IconCheck,
  IconFileCode,
  IconServer,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useCaddyfile, useProxyStatus } from '../../hooks/use-proxy';
import { toast } from 'sonner';

interface CaddyfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaddyfileModal({ isOpen, onClose }: CaddyfileModalProps) {
  const { data: caddyfileData, isLoading } = useCaddyfile();
  const { data: status } = useProxyStatus();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const content = caddyfileData?.caddyfile || '# No Caddyfile generated';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Caddyfile copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-4 text-zinc-900 dark:text-zinc-100 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
              <IconFileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Generated Caddyfile</h3>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {status?.config_path || 'data/caddy/Caddyfile'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Automatically rendered configuration synchronized with Caddy daemon.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-900 text-zinc-100 rounded-xl p-4 font-mono text-xs leading-relaxed border border-zinc-800">
          {isLoading ? (
            <div className="py-8 text-center text-zinc-500">Loading Caddyfile...</div>
          ) : (
            <pre className="whitespace-pre-wrap select-text">{content}</pre>
          )}
        </div>

        {/* Footer / Instructions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-[#23232A] shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <IconServer className="w-4 h-4 text-zinc-400" />
            <span>Hot reload endpoint: </span>
            <code className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
              {status?.admin_url || 'http://localhost:2019'}/load
            </code>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="surface" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <IconCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Caddyfile'}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
