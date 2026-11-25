'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ICON = {
  ok: CheckCircle2,
  err: XCircle,
  warn: AlertTriangle,
  info: Info,
};

const TONE = {
  ok: 'border-ok/30 text-ok',
  err: 'border-danger/30 text-danger',
  warn: 'border-warn/30 text-warn',
  info: 'border-brand/30 text-brand',
};

export function ToastHost() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[330px] flex-col gap-2">
      {items.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto animate-fadeUp rounded-card border bg-ink-panel/95 px-3 py-2.5 shadow-pop backdrop-blur',
              TONE[t.kind]
            )}
          >
            <div className="flex items-start gap-2">
              <Icon size={14} className="mt-[3px] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium leading-snug text-txt">{t.title}</div>
                {t.desc ? (
                  <div className="mt-0.5 text-[11.5px] leading-relaxed text-txt-mute">{t.desc}</div>
                ) : null}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="mt-0.5 text-txt-mute/70 transition-colors hover:text-txt"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
