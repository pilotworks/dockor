import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  IconDownload,
  IconX,
  IconTemplate,
  IconLoader2,
} from '@tabler/icons-react';
import { toast } from 'sonner';

interface ImportCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_CATALOGS = [
  {
    name: 'Official Portainer v2 Catalog',
    desc: 'Popular standard container templates from Portainer team',
    url: 'https://raw.githubusercontent.com/portainer/templates/master/templates-2.0.json',
  },
  {
    name: 'Lissy93 Self-Hosted Community Stack',
    desc: '50+ privacy-focused homelab and productivity apps',
    url: 'https://raw.githubusercontent.com/Lissy93/portainer-templates/main/templates.json',
  },
];

export function ImportCatalogModal({ isOpen, onClose, onSuccess }: ImportCatalogModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleImport = async (targetUrl?: string) => {
    const importUrl = targetUrl || url;
    if (!importUrl.trim()) {
      toast.error('Catalog URL is required');
      return;
    }

    setLoading(true);
    try {
      const res = await api.importCatalog(importUrl.trim());
      toast.success(res.message || `Successfully imported ${res.imported} templates`);
      setUrl('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error('Failed to import catalog: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <IconDownload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Import Template Catalog
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sync external JSON template catalogs or community app stores into Dockor.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#1A1A22] transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Popular Community Catalogs
          </span>
          <div className="space-y-2">
            {PRESET_CATALOGS.map((item) => (
              <div
                key={item.url}
                className="p-3 rounded-xl border border-zinc-200 dark:border-[#22222A] bg-zinc-50/50 dark:bg-[#0E0E12] flex items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-800 transition-colors"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-900 dark:text-zinc-100">
                    <IconTemplate className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">{item.desc}</p>
                </div>
                <Button
                  size="xs"
                  variant="surface"
                  disabled={loading}
                  onClick={() => handleImport(item.url)}
                  className="shrink-0 text-xs gap-1"
                >
                  <IconDownload className="w-3 h-3" />
                  <span>Import</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Custom URL Input */}
        <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-[#1E1E24]">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Custom Catalog URL (JSON)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="url"
              placeholder="https://raw.githubusercontent.com/.../templates-2.0.json"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-xs font-mono h-9 flex-1"
              disabled={loading}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={loading || !url.trim()}
              onClick={() => handleImport()}
              className="h-9 gap-1.5 text-xs shrink-0"
            >
              {loading ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconDownload className="w-3.5 h-3.5" />
              )}
              <span>Fetch & Import</span>
            </Button>
          </div>
          <span className="text-[11px] text-zinc-500 block">
            Supports standard community `templates-2.0.json` or Dockor catalog formats.
          </span>
        </div>
      </div>
    </div>
  );
}
