import { useState, useEffect } from 'react';
import { IconTag, IconLoader2, IconX } from '@tabler/icons-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { api } from '../../lib/api';

interface TagImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageId: string;
  imageShortId?: string;
  currentTags?: string[];
  onSuccess?: () => void;
}

export function TagImageModal({
  isOpen,
  onClose,
  imageId,
  imageShortId,
  currentTags = [],
  onSuccess,
}: TagImageModalProps) {
  const [repo, setRepo] = useState('');
  const [tag, setTag] = useState('latest');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Suggest based on existing tags if available
      const validTag = currentTags.find((t) => t && t !== '<none>:<none>');
      if (validTag && validTag.includes(':')) {
        const parts = validTag.split(':');
        setRepo(parts.slice(0, -1).join(':'));
        setTag('latest');
      } else {
        setRepo('');
        setTag('latest');
      }
    }
  }, [isOpen, currentTags]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim()) {
      toast.error('Repository name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.tagImage(imageId, repo.trim(), (tag.trim() || 'latest'));
      toast.success(`Image tagged successfully: ${repo.trim()}:${tag.trim() || 'latest'}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error('Failed to tag image', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#121216] border border-zinc-200 dark:border-[#23232A] rounded-2xl shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#202026]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <IconTag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Tag Image</h2>
              <p className="text-[11px] text-zinc-500 font-mono">
                {imageShortId ? `Target: ${imageShortId}` : 'Add a new repository tag'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Repository Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. username/my-service or registry.com/org/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="h-9 font-mono text-xs"
              autoFocus
              required
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Docker Hub, GitHub Packages, or private registry path.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block mb-1">
              Tag Name
            </label>
            <Input
              type="text"
              placeholder="e.g. latest, v1.0.0, dev"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="h-9 font-mono text-xs"
            />
          </div>

          {repo.trim() && (
            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/30 text-xs">
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 block mb-0.5">
                Resulting Image Reference:
              </span>
              <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 break-all">
                {repo.trim()}:{tag.trim() || 'latest'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#202026]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !repo.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  Tagging...
                </>
              ) : (
                <>
                  <IconTag className="w-3.5 h-3.5" />
                  Add Tag
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
