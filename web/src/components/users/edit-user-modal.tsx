import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { IconUserCog, IconLoader2, IconShield, IconEye, IconEyeOff } from '@tabler/icons-react';
import { api } from '../../lib/api';
import { User, UserRole } from '../../types';
import { toast } from 'sonner';

interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserModal({ user, isOpen, onClose, onSuccess }: EditUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('developer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setRole(user.role);
      setPassword('');
      setError(null);
    }
  }, [user]);

  const handleClose = () => {
    if (loading) return;
    setPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }
    if (password && password.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.updateUser(user.id, {
        email: email.trim().toLowerCase(),
        role,
        ...(password.trim() ? { password: password.trim() } : {}),
      });

      toast.success(`User "${user.username}" updated successfully`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40">
              <IconUserCog className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Edit User: {user?.username}</DialogTitle>
              <DialogDescription>
                Modify permissions, contact info, or reset access password.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <IconShield className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              Role Permission
            </label>
            <Select value={role} onValueChange={(val) => setRole(val as UserRole)} disabled={loading}>
              <SelectTrigger className="w-full h-auto min-h-12 py-2 px-3 text-sm [&>span]:line-clamp-none">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="developer" className="py-2.5 my-0.5">
                  <div className="flex flex-col text-left gap-0.5">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Developer</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Manage containers, stacks, files, and images</span>
                  </div>
                </SelectItem>
                <SelectItem value="admin" className="py-2.5 my-0.5">
                  <div className="flex flex-col text-left gap-0.5">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Admin</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Full system access, manage users, nodes, and registries</span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer" className="py-2.5 my-0.5">
                  <div className="flex flex-col text-left gap-0.5">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Viewer</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Read-only monitoring access across all resources</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-[#1F1F24]">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>Reset Password (Optional)</span>
              <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">Leave blank to keep unchanged</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="New password (min. 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-10 text-sm"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1"
              >
                {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <IconLoader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default EditUserModal;
