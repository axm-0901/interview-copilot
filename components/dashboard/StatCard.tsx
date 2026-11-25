'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: string;
  tone?: 'brand' | 'ok' | 'warn' | 'violet';
}) {
  const toneCls = {
    brand: 'text-brand border-brand/25 bg-brand/10',
    ok: 'text-ok border-ok/25 bg-ok/10',
    warn: 'text-warn border-warn/25 bg-warn/10',
    violet: 'text-brand-violet border-brand-violet/25 bg-brand-violet/10',
  }[tone];

  return (
    <div className="card group relative overflow-hidden px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-txt-mute">{label}</span>
        <span className={cn('grid h-[22px] w-[22px] place-items-center rounded-[6px] border', toneCls)}>
          {icon}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="font-mono text-[22px] font-semibold leading-none tracking-tight text-txt">
          {value}
        </span>
        {unit ? <span className="text-[11px] text-txt-mute">{unit}</span> : null}
      </div>
      <div className="mt-1 text-[10.5px] text-txt-mute">{sub ?? '\u00A0'}</div>
    </div>
  );
}

export function MiniBar({
  label,
  value,
  max,
  tone = 'brand',
}: {
  label: string;
  value: number;
  max: number;
  tone?: 'brand' | 'warn' | 'danger';
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color =
    tone === 'danger'
      ? 'bg-[linear-gradient(90deg,#ff5f6d,#ff8a5f)]'
      : tone === 'warn'
      ? 'bg-[linear-gradient(90deg,#f5a623,#ffcf6b)]'
      : 'bg-[linear-gradient(90deg,#4d8dff,#7b5cff)]';
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[64px] shrink-0 truncate text-[11.5px] text-txt-dim">{label}</span>
      <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[.05]">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-[26px] shrink-0 text-right font-mono text-[11px] text-txt-mute">{value}</span>
    </div>
  );
}
