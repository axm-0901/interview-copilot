'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SelectHTMLAttributes } from 'react';

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn('field appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-mute"
      />
    </div>
  );
}
