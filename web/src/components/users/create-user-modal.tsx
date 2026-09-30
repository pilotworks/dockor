import { useState } from 'react';
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
import { IconUserPlus, IconLoader2, IconShield, IconEye, IconEyeOff } from '@tabler/icons-react';
import { api } from '../../lib/api';
import { UserRole } from '../../types';
import { toast } from 'sonner';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateUserModal({ isOpen, onClose, onSuccess }: CreateUserModalProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('developer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (loading) return;
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('developer');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) {
      setError('All fields are required');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!email.includes('@')) {
      setError('Please provide a valid email address');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createUser({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      toast.success(`User "${username}" created successfully`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
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
              <IconUserPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Provision a new operator account with specific role permissions.
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
              Username
            </label>
            <Input
              type="text"
              placeholder="e.g. dev_johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="operator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Initial Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <IconShield className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
              Assigned Role
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
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export default CreateUserModal;
