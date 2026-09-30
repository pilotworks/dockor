import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'info';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variantStyles = {
    default:
      'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100',
    destructive:
      'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 [&>svg]:text-red-600 dark:[&>svg]:text-red-400',
    warning:
      'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
    info:
      'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
  };

  return (
    <div
      role="alert"
      className={cn(
        'relative w-full rounded-xl border p-4 text-xs [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-100', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-xs opacity-90 leading-relaxed', className)} {...props} />;
}
