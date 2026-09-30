import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { IconDownload, IconX, IconSparkles, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { toast } from 'sonner';

interface PullImageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_IMAGES = [
  'alpine:latest',
  'nginx:alpine',
  'redis:alpine',
  'postgres:16-alpine',
  'node:20-alpine',
  'traefik:v3.1',
  'python:3.12-alpine',
];

interface PullEvent {
  id?: string;
  status?: string;
  progress?: string;
  progressDetail?: { current?: number; total?: number };
}

export function PullImageModal({ isOpen, onClose }: PullImageModalProps) {
  const [imageName, setImageName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullEvents, setPullEvents] = useState<PullEvent[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPulling) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isPulling]);

  if (!isOpen) return null;

  const handlePull = async (targetImage?: string) => {
    const img = (targetImage || imageName).trim();
    if (!img) {
      toast.error('Image name is required');
      return;
    }

    setIsPulling(true);
    setPullEvents([]);

    const layerMap = new Map<string, PullEvent>();

    try {
      await api.pullImage(img, (event: PullEvent) => {
        if (event.id) {
          layerMap.set(event.id, event);
          setPullEvents(Array.from(layerMap.values()));
        } else if (event.status) {
          layerMap.set(`msg-${Date.now()}`, event);
          setPullEvents(Array.from(layerMap.values()));
        }
      });

      toast.success(`Successfully pulled image "${img}"`);
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['system-disk-usage'] });
    } catch (err: any) {
      toast.error('Failed to pull image', { description: err.message });
    } finally {
      setIsPulling(false);
    }
  };

  const handleSelectPreset = (preset: string) => {
    setImageName(preset);
    if (!isPulling) {
      handlePull(preset);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPulling) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#282832] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-[#22222a] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconDownload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pull Docker Image</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Download container images from public or private registries</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPulling}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Image Reference <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. redis:7-alpine, ghcr.io/owner/repo:tag"
                value={imageName}
                onChange={(e) => setImageName(e.target.value)}
                disabled={isPulling}
                className="h-9 font-mono text-xs"
                autoFocus
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handlePull()}
                disabled={isPulling || !imageName.trim()}
                className="gap-1.5 shrink-0"
              >
                {isPulling ? <IconLoader2 className="w-3.5 h-3.5 animate-spin" /> : <IconDownload className="w-3.5 h-3.5" />}
                {isPulling ? 'Pulling...' : 'Pull'}
              </Button>
            </div>
          </div>

          {/* Popular Presets */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <IconSparkles className="w-3 h-3 text-amber-500" />
              <span>Popular Starter Images</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_IMAGES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  disabled={isPulling}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Stream View */}
          {pullEvents.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-[#22222a]">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>Pull Progress & Layers</span>
                {isPulling && <span className="animate-pulse text-blue-500 font-mono text-[11px]">Streaming layers...</span>}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-[11px] border border-zinc-800">
                {pullEvents.map((ev, idx) => (
                  <div key={ev.id || idx} className="flex items-center justify-between gap-3 text-xs py-0.5">
                    <div className="flex items-center gap-2 truncate">
                      {ev.id && <span className="text-zinc-400 font-bold shrink-0">{ev.id}:</span>}
                      <span className="text-zinc-200 truncate">{ev.status}</span>
                    </div>
                    {ev.progress ? (
                      <span className="text-zinc-400 text-[10px] shrink-0">{ev.progress}</span>
                    ) : ev.status?.includes('Complete') || ev.status?.includes('Already exists') ? (
                      <IconCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-zinc-200 dark:border-[#22222a] shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPulling}>
            {isPulling ? 'Pulling in background...' : 'Close'}
          </Button>
        </div>
      </div>
    </div>
  );
}
