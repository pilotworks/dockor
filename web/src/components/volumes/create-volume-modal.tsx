import { useState, useEffect } from 'react';
import { useCreateVolume } from '../../hooks/use-volumes';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { IconDatabase, IconPlus, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';

interface CreateVolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateVolumeModal({ isOpen, onClose }: CreateVolumeModalProps) {
  const [name, setName] = useState('');
  const [driver, setDriver] = useState('local');
  const [labels, setLabels] = useState<{ key: string; value: string }[]>([]);
  const [driverOpts, setDriverOpts] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const createMutation = useCreateVolume();

  if (!isOpen) return null;

  const handleAddLabel = () => setLabels([...labels, { key: '', value: '' }]);
  const handleRemoveLabel = (index: number) => setLabels(labels.filter((_, i) => i !== index));
  const handleLabelChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...labels];
    updated[index][field] = val;
    setLabels(updated);
  };

  const handleAddOpt = () => setDriverOpts([...driverOpts, { key: '', value: '' }]);
  const handleRemoveOpt = (index: number) => setDriverOpts(driverOpts.filter((_, i) => i !== index));
  const handleOptChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...driverOpts];
    updated[index][field] = val;
    setDriverOpts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Volume name is required');
      return;
    }

    const labelsMap: Record<string, string> = {};
    for (const l of labels) {
      if (l.key.trim()) labelsMap[l.key.trim()] = l.value.trim();
    }

    const optsMap: Record<string, string> = {};
    for (const o of driverOpts) {
      if (o.key.trim()) optsMap[o.key.trim()] = o.value.trim();
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        driver: driver.trim() || 'local',
        labels: Object.keys(labelsMap).length ? labelsMap : undefined,
        driver_opts: Object.keys(optsMap).length ? optsMap : undefined,
      });
      toast.success(`Volume "${name}" created successfully`);
      setName('');
      setDriver('local');
      setLabels([]);
      setDriverOpts([]);
      onClose();
    } catch (err: any) {
      toast.error('Failed to create volume', { description: err.message });
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#282832] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-[#22222a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconDatabase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Create Docker Volume</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Provision persistent storage for your containers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Volume Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. postgres_data, redis_cache"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Driver
            </label>
            <Input
              type="text"
              placeholder="local"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              className="h-9"
            />
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">Default is `local`. Supports custom volume driver plugins.</p>
          </div>

          {/* Driver Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Driver Options</label>
              <Button type="button" size="xs" variant="ghost" onClick={handleAddOpt} className="gap-1 text-xs">
                <IconPlus className="w-3 h-3" /> Add Option
              </Button>
            </div>
            {driverOpts.length === 0 ? (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">No driver options configured.</p>
            ) : (
              driverOpts.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Option Key"
                    value={opt.key}
                    onChange={(e) => handleOptChange(i, 'key', e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={opt.value}
                    onChange={(e) => handleOptChange(i, 'value', e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="button" size="xs" variant="ghost" onClick={() => handleRemoveOpt(i)} className="text-zinc-400 hover:text-red-500">
                    <IconX className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Labels</label>
              <Button type="button" size="xs" variant="ghost" onClick={handleAddLabel} className="gap-1 text-xs">
                <IconPlus className="w-3 h-3" /> Add Label
              </Button>
            </div>
            {labels.length === 0 ? (
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">No custom labels.</p>
            ) : (
              labels.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Label Key"
                    value={l.key}
                    onChange={(e) => handleLabelChange(i, 'key', e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    placeholder="Value"
                    value={l.value}
                    onChange={(e) => handleLabelChange(i, 'value', e.target.value)}
                    className="h-8 text-xs flex-1"
                  />
                  <Button type="button" size="xs" variant="ghost" onClick={() => handleRemoveLabel(i)} className="text-zinc-400 hover:text-red-500">
                    <IconX className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-[#22222a]">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Volume'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
