import { Toaster as Sonner } from 'sonner';
import { useAppStore } from '../../stores/use-app-store';

export function Toaster() {
  const theme = useAppStore((s) => s.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-[#121722] group-[.toaster]:text-zinc-900 dark:group-[.toaster]:text-slate-100 group-[.toaster]:border-zinc-200 dark:group-[.toaster]:border-slate-800 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl text-xs font-medium',
          description: 'group-[.toast]:text-zinc-500 dark:group-[.toast]:text-slate-400 text-xs',
          actionButton:
            'group-[.toast]:bg-blue-600 group-[.toast]:text-white font-semibold text-xs rounded-lg',
          cancelButton:
            'group-[.toast]:bg-zinc-100 dark:group-[.toast]:bg-slate-800 group-[.toast]:text-zinc-700 dark:group-[.toast]:text-slate-300 text-xs rounded-lg',
          success: 'group-[.toast]:border-emerald-600/40 dark:group-[.toast]:border-emerald-800/60',
          error: 'group-[.toast]:border-red-600/40 dark:group-[.toast]:border-red-800/60',
          warning: 'group-[.toast]:border-amber-600/40 dark:group-[.toast]:border-amber-800/60',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
