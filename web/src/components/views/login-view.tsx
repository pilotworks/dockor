import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/use-auth-store';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  IconLock,
  IconUser,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconAlertCircle,
  IconBrandDocker,
  IconShieldLock,
  IconKey,
} from '@tabler/icons-react';

export function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

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
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-background overflow-hidden selection:bg-primary/20">
      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl p-8 sm:p-10 space-y-8">
          {/* Header & Logo */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 ring-4 ring-primary/10">
              <IconBrandDocker className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
                Dockor Control Plane
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your credentials to access your container fleet
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in-50 duration-200">
              <IconAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <IconUser className="w-3.5 h-3.5 text-muted-foreground" />
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
                  className="h-10 pl-3.5 pr-3 bg-muted/30 border-border/70 focus:border-primary transition-colors text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <IconLock className="w-3.5 h-3.5 text-muted-foreground" />
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
                  className="h-10 pl-3.5 pr-10 bg-muted/30 border-border/70 focus:border-primary transition-colors text-sm"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              disabled={loading}
              className="w-full h-10 font-semibold shadow-md shadow-primary/20 text-sm flex items-center justify-center gap-2"
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
          <div className="pt-2 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={handleFillDemo}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-muted/40"
            >
              <IconKey className="w-3.5 h-3.5 text-primary/80" />
              <span>Default credentials: <strong>admin</strong> / <strong>admin123</strong></span>
            </button>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <IconShieldLock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured with HMAC-SHA256 JWT &amp; AES-256 encrypted storage</span>
        </div>
      </div>
    </div>
  );
}
export default LoginView;
