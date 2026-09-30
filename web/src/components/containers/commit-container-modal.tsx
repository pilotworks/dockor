import { useState, useEffect } from 'react';
import {
  IconDeviceFloppy,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { api } from '../../lib/api';

interface CommitContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  containerId: string;
  containerName?: string;
  onSuccess?: (newImageId: string) => void;
}

export function CommitContainerModal({
  isOpen,
  onClose,
  containerId,
  containerName,
  onSuccess,
}: CommitContainerModalProps) {
  const [repo, setRepo] = useState('');
  const [tag, setTag] = useState('latest');
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');
  const [pause, setPause] = useState(true);
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cleanName = (containerName || '').replace(/^\//, '');
      setRepo(cleanName ? `${cleanName}-backup` : '');
      setTag('latest');
      setComment(`Snapshot of ${cleanName || containerId.slice(0, 12)}`);
      setAuthor('');
      setPause(true);
    }
  }, [isOpen, containerName, containerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCommitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCommitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsCommitting(true);
    try {
      const res = await api.commitContainer(containerId, {
        repo: repo.trim(),
        tag: tag.trim() || 'latest',
        comment: comment.trim(),
        author: author.trim(),
        pause,
      });

      toast.success(`Container committed into image: ${repo.trim()}:${tag.trim() || 'latest'}`);
      onSuccess?.(res.image_id);
      onClose();
    } catch (err: any) {
      toast.error('Failed to commit container', { description: err.message });
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCommitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#202026]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <IconDeviceFloppy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Commit Container</h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {containerName ? containerName : containerId.slice(0, 12)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isCommitting}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                New Image Repository <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. my-app-backup"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="h-9 font-mono text-xs"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
                Tag
              </label>
              <Input
                type="text"
                placeholder="latest"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="h-9 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Commit Message / Comment
            </label>
            <Input
              type="text"
              placeholder="e.g. Installed curl and modified configs"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Author
            </label>
            <Input
              type="text"
              placeholder="e.g. John Doe <john@example.com>"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="h-9 text-xs font-mono"
            />
          </div>

          {/* Pause checkbox */}
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Checkbox
              checked={pause}
              onCheckedChange={setPause}
              label="Pause container during commit"
              description="Freezes container processes while capturing the filesystem layer to prevent data corruption."
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#202026]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isCommitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isCommitting || !repo.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
            >
              {isCommitting ? (
                <>
                  <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <IconDeviceFloppy className="w-3.5 h-3.5" />
                  Create Image
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
