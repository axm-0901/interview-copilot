'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Segmented<T extends string>({
  value,
  onChange,
  items,
  size = 'sm',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: ReactNode }[];
  size?: 'sm' | 'xs';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-[3px] rounded-[10px] border border-ink-line bg-[#0e131a] p-[3px]',
        className
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative rounded-[7px] font-medium transition-all duration-150',
              size === 'xs' ? 'px-2 py-[3px] text-[11.5px]' : 'px-2.5 py-[5px] text-[12px]',
              active
                ? 'bg-[linear-gradient(97deg,rgba(77,141,255,.22),rgba(123,92,255,.22))] text-txt shadow-[inset_0_0_0_1px_rgba(123,92,255,.28)]'
                : 'text-txt-mute hover:bg-white/[.04] hover:text-txt-dim'
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex items-center gap-1 border-b border-ink-line/70">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative -mb-px px-3 py-2 text-[12.5px] font-medium transition-colors',
              active ? 'text-txt' : 'text-txt-mute hover:text-txt-dim'
            )}
          >
            <span className="flex items-center gap-1.5">
              {it.label}
              {typeof it.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10.5px]',
                    active ? 'bg-brand/18 text-[#9cc0ff]' : 'bg-white/[.06] text-txt-mute'
                  )}
                >
                  {it.count}
                </span>
              ) : null}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[linear-gradient(90deg,#4d8dff,#7b5cff)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
