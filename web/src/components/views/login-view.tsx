import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/use-auth-store';
import { useAppStore } from '../../stores/use-app-store';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DockorLogo } from '../brand/dockor-logo';
import {
  IconLock,
  IconUser,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconAlertCircle,
  IconShieldLock,
  IconKey,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { theme, toggleTheme } = useAppStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login({
        username: username.trim(),
        password,
      });

      setAuth(res.access_token, res.user);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setUsername('admin');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800/80 transition-colors border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-[#121216]/90 backdrop-blur-sm shadow-xs cursor-pointer"
        >
          {theme === 'dark' ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
        </button>
      </div>

      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 select-text">
        <div className="relative rounded-2xl border border-zinc-200/90 dark:border-[#23232A] bg-white dark:bg-[#121216] shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-8 sm:p-10 space-y-8">
          {/* Header & Logo */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/40 shadow-xs p-2.5">
              <DockorLogo className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-2">
                Dockor Control Plane
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Enter your credentials to access your container fleet
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs animate-in fade-in-50 duration-200">
              <IconAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <IconUser className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                Username
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                  className="h-10 pl-3.5 pr-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <IconLock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  Password
                </span>
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="h-10 pl-3.5 pr-10 text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1"
                >
                  {showPassword ? (
                    <IconEyeOff className="w-4 h-4" />
                  ) : (
                    <IconEye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full h-10 font-semibold text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <IconLoader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <IconShieldLock className="w-4 h-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Credentials helper */}
          <div className="pt-2 border-t border-zinc-100 dark:border-[#1F1F24] text-center">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors py-1 px-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer"
            >
              <IconKey className="w-3.5 h-3.5 text-blue-500" />
              <span>Default credentials: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">admin</strong> / <strong className="font-semibold text-zinc-800 dark:text-zinc-200">admin123</strong></span>
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5">
          <IconShieldLock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured with HMAC-SHA256 JWT &amp; AES-256 encrypted storage</span>
        </div>
      </div>
    </div>
  );
}

export default LoginView;
