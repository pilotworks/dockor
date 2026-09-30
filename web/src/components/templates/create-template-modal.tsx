import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  IconPlus,
  IconX,
  IconTemplate,
  IconFileCode,
  IconLoader2,
} from '@tabler/icons-react';
import { ComposeEditor } from '../editor/compose-editor';
import { toast } from 'sonner';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEFAULT_COMPOSE = `services:
  web:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "8080:80"
`;

export function CreateTemplateModal({ isOpen, onClose, onSuccess }: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [composeYaml, setComposeYaml] = useState(DEFAULT_COMPOSE);
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

  const handleNameChange = (val: string) => {
    setName(val);
    if (!id || id === name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')) {
      setId(val.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    setLoading(true);
    try {
      await api.createTemplate({
        metadata: {
          id: id.trim() || name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
          name: name.trim(),
          category: category.trim() || 'General',
          description: description.trim(),
          icon: icon.trim() || undefined,
          version: '1.0.0',
        },
        compose_yaml: composeYaml,
      });

      toast.success(`Template "${name}" created successfully`);
      setName('');
      setId('');
      setDescription('');
      setIcon('');
      setComposeYaml(DEFAULT_COMPOSE);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error('Failed to create template: ' + err.message);
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
        className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#111115] border border-zinc-200 dark:border-[#23232A] p-6 shadow-2xl space-y-5 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconTemplate className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Create Custom Application Template
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Design a reusable container stack template with docker-compose definition.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Template Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Next.js & Supabase"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Identifier (Slug)
              </label>
              <Input
                placeholder="e.g. nextjs-supabase"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Category
              </label>
              <Input
                placeholder="e.g. Web, Database, Monitoring"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Icon URL (Optional)
              </label>
              <Input
                placeholder="https://.../logo.png"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <Input
              placeholder="Brief summary of what this application stack provides..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Compose YAML */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <IconFileCode className="w-4 h-4 text-purple-500" />
                <span>docker-compose.yml definition</span>
              </label>
              <Badge variant="outline" className="text-[10px] font-mono">
                YAML
              </Badge>
            </div>
            <div className="border border-zinc-200 dark:border-[#272730] rounded-xl overflow-hidden">
              <ComposeEditor
                value={composeYaml}
                onChange={(val) => setComposeYaml(val || '')}
                height="240px"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#1E1E24]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={loading || !name.trim()}
              className="text-xs gap-1.5"
            >
              {loading ? (
                <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <IconPlus className="w-3.5 h-3.5" />
              )}
              <span>Create Template</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
