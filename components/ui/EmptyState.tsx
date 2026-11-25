'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  desc,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  desc?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-panel border border-dashed border-ink-line/90 bg-ink-panel/40 text-center',
        compact ? 'px-4 py-7' : 'px-6 py-12',
        className
      )}
    >
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-[11px] border border-ink-line bg-ink-sub text-txt-mute">
        {icon}
      </div>
      <div className="text-[13.5px] font-medium text-txt-dim">{title}</div>
      {desc ? (
        <div className="mt-1.5 max-w-[380px] text-[12px] leading-relaxed text-txt-mute">{desc}</div>
      ) : null}
      {action ? <div className="mt-4 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Progress({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'ok' | 'warn' }) {
  const color =
    tone === 'ok'
      ? 'bg-ok'
      : tone === 'warn'
      ? 'bg-warn'
      : 'bg-[linear-gradient(90deg,#4d8dff,#7b5cff)]';
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/[.06]">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-white/[.045]',
        'after:absolute after:inset-y-0 after:w-1/3 after:animate-sweep after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)]',
        className
      )}
    />
  );
}
