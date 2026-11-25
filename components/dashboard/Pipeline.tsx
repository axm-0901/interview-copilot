'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  label: string;
  metric: string;
  state: 'done' | 'current' | 'todo';
  href: string;
}

export function Pipeline({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-0 flex-1 items-center gap-1">
          <Link
            href={s.href}
            className={cn(
              'group flex min-w-0 flex-1 flex-col gap-1.5 rounded-[9px] border px-2.5 py-2 transition-colors',
              s.state === 'done' && 'border-ok/25 bg-ok/[.06] hover:bg-ok/[.1]',
              s.state === 'current' && 'border-brand/40 bg-brand/[.09] hover:bg-brand/[.14]',
              s.state === 'todo' && 'border-ink-line bg-white/[.015] hover:bg-white/[.04]'
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full text-[9px] font-semibold',
                  s.state === 'done' && 'bg-ok/20 text-ok',
                  s.state === 'current' && 'bg-[linear-gradient(135deg,#4d8dff,#7b5cff)] text-white',
                  s.state === 'todo' && 'bg-white/[.07] text-txt-mute'
                )}
              >
                {s.state === 'done' ? <Check size={9} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'truncate text-[11.5px] font-medium',
                  s.state === 'todo' ? 'text-txt-mute' : 'text-txt'
                )}
              >
                {s.label}
              </span>
            </div>
            <div className="truncate pl-[21px] text-[10.5px] text-txt-mute">{s.metric}</div>
          </Link>
          {i < steps.length - 1 ? (
            <ChevronRight size={12} className="hidden shrink-0 text-ink-line2 sm:block" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function NextAction({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-panel border border-brand/30 bg-[linear-gradient(120deg,rgba(77,141,255,.1),rgba(123,92,255,.07))] p-3.5 transition-colors hover:border-brand/50"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-brand/20 blur-2xl" />
      <div className="relative">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.16em] text-[#8db6ff]">
          下一步
        </div>
        <div className="mt-1 text-[13px] font-medium text-txt">{title}</div>
        <div className="mt-1 text-[11.5px] leading-relaxed text-txt-dim">{desc}</div>
        <div className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-[#9cc0ff]">
          {cta}
          <ArrowUpRight
            size={11}
            className="transition-transform group-hover:-translate-y-[1px] group-hover:translate-x-[1px]"
          />
        </div>
      </div>
    </Link>
  );
}
