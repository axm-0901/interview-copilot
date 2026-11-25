'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  desc?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const w =
    width === 'sm' ? 'max-w-[420px]' : width === 'lg' ? 'max-w-[820px]' : width === 'xl' ? 'max-w-[1080px]' : 'max-w-[620px]';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto px-4 py-[6vh]">
      <div
        className="fixed inset-0 bg-[#05070b]/72 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full animate-fadeUp rounded-panel border border-ink-line bg-ink-panel shadow-pop',
          w
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-line/80 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold text-txt">{title}</div>
            {desc ? <div className="mt-1 text-[12px] leading-relaxed text-txt-mute">{desc}</div> : null}
          </div>
          <button
            onClick={onClose}
            className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-txt-mute transition-colors hover:bg-white/[.07] hover:text-txt"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-ink-line/80 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
