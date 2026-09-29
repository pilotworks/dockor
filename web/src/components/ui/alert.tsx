import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'info';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  const variantStyles = {
    default: 'bg-slate-900 border-slate-800 text-slate-200',
    destructive: 'bg-red-950/40 border-red-800/60 text-red-200 [&>svg]:text-red-400',
    warning: 'bg-amber-950/40 border-amber-800/60 text-amber-200 [&>svg]:text-amber-400',
    info: 'bg-blue-950/40 border-blue-800/60 text-blue-200 [&>svg]:text-blue-400',
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
  return <h5 className={cn('mb-1 font-semibold leading-none tracking-tight text-white', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-xs opacity-90 leading-relaxed', className)} {...props} />;
}
