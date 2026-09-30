import * as React from 'react';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      indeterminate,
      onCheckedChange,
      onChange,
      disabled,
      id: providedId,
      size = 'md',
      label,
      description,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || (label ? generatedId : undefined);
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = Boolean(indeterminate);
      }
    }, [indeterminate]);

    const isChecked = Boolean(checked) && !indeterminate;
    const isIndeterminate = Boolean(indeterminate);

    const sizeClasses = {
      sm: 'h-3.5 w-3.5 rounded',
      md: 'h-4 w-4 rounded-[5px]',
      lg: 'h-5 w-5 rounded-md',
    };

    const iconSizes = {
      sm: 'w-2.5 h-2.5 stroke-[3]',
      md: 'w-3 h-3 stroke-[2.75]',
      lg: 'w-3.5 h-3.5 stroke-[2.5]',
    };

    const checkboxBox = (
      <span
        className={cn(
          'relative inline-flex items-center justify-center shrink-0 leading-none select-none transition-all duration-150',
          sizeClasses[size]
        )}
      >
        <input
          type="checkbox"
          id={id}
          ref={innerRef}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10 m-0"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center justify-center w-full h-full border transition-all duration-150 pointer-events-none',
            sizeClasses[size],
            // Unchecked state
            !isChecked && !isIndeterminate && [
              'bg-white dark:bg-[#0A0A0C]',
              'border-zinc-300 dark:border-[#2E2E38]',
              'peer-hover:border-zinc-400 dark:peer-hover:border-zinc-600',
              'shadow-xs',
            ],
            // Checked or Indeterminate state
            (isChecked || isIndeterminate) && [
              'bg-blue-600 border-blue-600 text-white',
              'peer-hover:bg-blue-500 peer-hover:border-blue-500',
              'shadow-xs shadow-blue-500/20',
            ],
            // Focus state
            'peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-[#121216]',
            // Disabled state
            disabled &&
              'opacity-40 cursor-not-allowed peer-hover:border-zinc-300 dark:peer-hover:border-[#2E2E38] peer-hover:bg-white dark:peer-hover:bg-[#0A0A0C]',
            className
          )}
        >
          {isChecked && (
            <IconCheck className={cn('text-white animate-in zoom-in-75 duration-100', iconSizes[size])} />
          )}
          {isIndeterminate && (
            <IconMinus className={cn('text-white animate-in zoom-in-75 duration-100', iconSizes[size])} />
          )}
        </span>
      </span>
    );

    if (!label && !description) {
      return checkboxBox;
    }

    if (!description) {
      return (
        <div className="flex items-center gap-2.5">
          {checkboxBox}
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-xs font-medium text-zinc-900 dark:text-zinc-100 select-none cursor-pointer leading-normal',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {label}
            </label>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-start gap-2.5">
        <div className="pt-0.5 shrink-0">{checkboxBox}</div>
        <div className="space-y-0.5 text-xs">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'font-medium text-zinc-900 dark:text-zinc-100 select-none cursor-pointer block leading-normal',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {label}
            </label>
          )}
          <p className={cn('text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal', disabled && 'opacity-50')}>
            {description}
          </p>
        </div>
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
