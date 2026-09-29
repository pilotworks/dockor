import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'surface';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    const variantStyles = {
      primary:
        'bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm hover:shadow-[0_0_15px_rgba(37,99,235,0.25)] border border-blue-500/50 active:scale-[0.98]',
      secondary:
        'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium border border-zinc-200 dark:border-zinc-700/60 shadow-sm active:scale-[0.98]',
      surface:
        'bg-white hover:bg-zinc-50 dark:bg-[#18181D] dark:hover:bg-[#202027] text-zinc-800 dark:text-zinc-200 font-medium border border-zinc-200 dark:border-[#272730] shadow-sm active:scale-[0.98]',
      outline:
        'border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-transparent text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/60',
      ghost:
        'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
      destructive:
        'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800/60 shadow-sm active:scale-[0.98]',
    };

    const sizeStyles = {
      xs: 'h-6 px-2 text-[10px] rounded-md gap-1',
      sm: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
      md: 'h-8 px-3.5 text-xs font-medium rounded-lg gap-2',
      lg: 'h-9 px-4 text-xs font-semibold rounded-lg gap-2',
      icon: 'h-8 w-8 p-1.5 rounded-lg flex items-center justify-center',
      'icon-sm': 'h-7 w-7 p-1 rounded-md flex items-center justify-center',
    };

    return (
      <Comp
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center transition-all select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
