'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  desc,
  icon,
  right,
  className,
}: {
  title: ReactNode;
  desc?: ReactNode;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-3.5 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <div className="mt-[3px] text-brand">{icon}</div> : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-txt">{title}</div>
          {desc ? <div className="mt-0.5 text-[12px] leading-relaxed text-txt-mute">{desc}</div> : null}
        </div>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-1.5">{right}</div> : null}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-txt-mute',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('hairline my-3', className)} />;
}
