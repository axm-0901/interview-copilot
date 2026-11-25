'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Layers, Plus, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { cn, scoreBg } from '@/lib/utils';
import type { Review, Turn } from '@/lib/types';

export function ReviewCard({
  turn,
  review,
  index,
  onAddToCard,
  compact,
}: {
  turn: Turn;
  review?: Review;
  index?: number;
  onAddToCard?: (review: Review, turn: Turn) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const score = review?.score ?? 0;

  return (
    <div className="relative pl-[22px]">
      <span className="absolute left-[5px] top-[9px] h-[7px] w-[7px] rounded-full border border-brand/50 bg-[#0b0e13]">
        <span className="absolute inset-[1.5px] rounded-full bg-brand/70" />
      </span>

      <div className="rounded-panel border border-ink-line bg-ink-panel/80">
        <div className="flex items-start justify-between gap-2 px-3 pb-1.5 pt-2.5">
          <div className="flex min-w-0 items-start gap-2">
            {typeof index === 'number' ? (
              <span className="mt-[2px] shrink-0 font-mono text-[10px] text-txt-mute">
                {String(index + 1).padStart(2, '0')}
              </span>
            ) : null}
            <div className="min-w-0 text-[12.5px] font-medium leading-relaxed text-txt">{turn.question}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {review ? (
              <>
                <Badge tone="muted">{review.type}</Badge>
                <span
                  className={cn(
                    'rounded-[5px] border px-1.5 py-px font-mono text-[11px] font-semibold',
                    scoreBg(score)
                  )}
                >
                  {score}
                </span>
              </>
            ) : (
              <Badge tone="warn">待点评</Badge>
            )}
          </div>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="mb-1 flex items-center gap-1 text-[10px] text-txt-mute transition-colors hover:text-txt-dim"
          >
            <ArrowRight size={9} className={cn('transition-transform', open && 'rotate-90')} />
            我的回答
            <span className="text-txt-mute/60">（{turn.answerMd.replace(/\s+/g, '').length} 字）</span>
          </button>
          {open ? (
            <div className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-txt-dim">
              {turn.answerMd || '（没有作答）'}
            </div>
          ) : null}

          {review ? (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-start gap-1.5 rounded-[7px] border border-danger/20 bg-danger/[.045] px-2.5 py-1.5">
                <AlertTriangle size={10} className="mt-[3px] shrink-0 text-danger/80" />
                <div className="text-[11px] leading-relaxed text-[#ff9aa2]">{review.fatal}</div>
              </div>

              {!compact ? (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-txt-mute">
                    <Layers size={9} />
                    30 秒改写示范
                  </div>
                  <div className="rounded-[7px] border border-ok/20 bg-ok/[.035] px-2.5 py-1.5">
                    <Markdown text={review.rewrite} dense />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-ink-line bg-[#0e131a]/60 px-2 py-[1px] text-[10px] text-txt-dim">
                  <Timer size={8} />
                  {review.reminder}
                </span>
                {onAddToCard ? (
                  <button
                    onClick={() => onAddToCard(review, turn)}
                    className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-[2px] text-[10px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
                  >
                    <Plus size={9} />
                    加入技能卡
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-[7px] border border-dashed border-ink-line px-2.5 py-2 text-[10.5px] text-txt-mute">
              这一条还没有点评。点上方「生成复盘」后补齐。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReviewEmpty({ onGenerate }: { onGenerate?: () => void }) {
  return (
    <div className="rounded-panel border border-dashed border-ink-line px-6 py-10 text-center">
      <div className="text-[12.5px] text-txt-dim">还没有复盘数据</div>
      <div className="mt-1 text-[11px] text-txt-mute">先完成一场问答，再生成逐条点评。</div>
      {onGenerate ? (
        <Button variant="primary" size="sm" className="mt-3" onClick={onGenerate}>
          生成复盘
        </Button>
      ) : null}
    </div>
  );
}
