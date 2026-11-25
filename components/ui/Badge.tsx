'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'ok' | 'warn' | 'danger' | 'muted' | 'violet';

const TONES: Record<Tone, string> = {
  brand: 'border-brand/30 bg-brand/12 text-[#93bbff]',
  ok: 'border-ok/28 bg-ok/12 text-ok',
  warn: 'border-warn/28 bg-warn/12 text-warn',
  danger: 'border-danger/28 bg-danger/12 text-danger',
  muted: 'border-ink-line bg-ink-sub text-txt-mute',
  violet: 'border-brand-violet/32 bg-brand-violet/12 text-[#b6a5ff]',
};

export function Badge({
  children,
  tone = 'muted',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[1px] text-[11px] font-medium leading-[17px]',
        TONES[tone],
        className
      )}
    >
      {dot ? <span className="h-[5px] w-[5px] rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({ state }: { state: 'on' | 'off' | 'warn' | 'busy' }) {
  const color =
    state === 'on' ? 'bg-ok' : state === 'warn' ? 'bg-warn' : state === 'busy' ? 'bg-brand' : 'bg-txt-mute/60';
  return (
    <span className="relative inline-flex h-2 w-2">
      {state !== 'off' ? (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-40', color)} />
      ) : null}
      <span className={cn('relative h-2 w-2 rounded-full', color)} />
    </span>
  );
}
