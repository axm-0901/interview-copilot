'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'outline' | 'ghost' | 'subtle' | 'danger';
type Size = 'xs' | 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white bg-[linear-gradient(97deg,#4d8dff,#7b5cff)] border border-white/10 ' +
    'hover:brightness-110 active:brightness-95 shadow-[0_6px_20px_-10px_rgba(77,141,255,.9)]',
  outline:
    'border border-ink-line bg-transparent text-txt-dim hover:text-txt hover:border-ink-line2 hover:bg-white/[.035]',
  ghost: 'border border-transparent text-txt-dim hover:text-txt hover:bg-white/[.05]',
  subtle: 'border border-ink-line bg-ink-sub text-txt hover:bg-ink-raise hover:border-ink-line2',
  danger:
    'border border-danger/35 bg-danger/10 text-danger hover:bg-danger/16 hover:border-danger/55',
};

const SIZES: Record<Size, string> = {
  xs: 'h-[26px] px-2 text-[11.5px] gap-1 rounded-[7px]',
  sm: 'h-[30px] px-2.5 text-[12.5px] gap-1.5 rounded-btn',
  md: 'h-[36px] px-3.5 text-[13px] gap-2 rounded-btn',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'subtle', size = 'sm', loading, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : null}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(function IconButton({ className, active, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-[30px] w-[30px] items-center justify-center rounded-btn border border-transparent',
        'text-txt-mute transition-colors hover:bg-white/[.06] hover:text-txt',
        active && 'border-brand/30 bg-brand/12 text-brand',
        'disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
