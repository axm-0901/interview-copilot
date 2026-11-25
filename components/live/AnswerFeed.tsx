'use client';

import { Activity, Mic, Radio, Sparkles } from 'lucide-react';
import { AnswerCard } from './AnswerCard';
import { ReviewCard } from '@/components/review/ReviewCard';
import { EmptyState } from '@/components/ui/EmptyState';
import type { PendingAnswer } from './useLiveSession';
import type { AnswerStyle, Review, SessionMode, Turn } from '@/lib/types';

export function AnswerFeed({
  mode,
  pending,
  turns,
  practice,
  practiceQ,
  onRetryPending,
  onRegenerate,
  onAddToCard,
  cardCount,
}: {
  mode: SessionMode;
  pending: PendingAnswer | null;
  turns: Turn[];
  practice: { turn: Turn; review: Review }[];
  practiceQ: string;
  onRetryPending: () => void;
  onRegenerate: (t: Turn, s: AnswerStyle) => void;
  onAddToCard: (r: Review, t: Turn) => void;
  cardCount: number;
}) {
  const count = mode === 'practice' ? practice.length : turns.length;

  return (
    <div className="flex min-w-0 flex-col rounded-panel border border-ink-line bg-[#0a0d12]/40 xl:h-full xl:min-h-0">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-line/60 px-3.5 py-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-txt">
          <Activity size={12} className="text-brand" />
          {mode === 'practice' ? '作答与点评' : '答稿'}
        </div>
        <span className="text-[10px] text-txt-mute">
          {count ? `本轮 ${count} 条` : '等待第一题'}
        </span>
      </div>

      {mode === 'practice' && practiceQ ? (
        <div className="mx-3 mt-2.5 rounded-card border border-brand-violet/30 bg-brand-violet/[.07] px-3 py-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[#b6a5ff]">
            <Sparkles size={9} />
            面试官提问
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-txt">{practiceQ}</div>
        </div>
      ) : null}

      <div className="scroll-thin min-h-[160px] max-h-[60vh] space-y-2 overflow-y-auto p-3 xl:min-h-0 xl:max-h-none xl:flex-1">
        {pending ? <AnswerCard pending={pending} onRetry={onRetryPending} /> : null}

        {mode === 'assist'
          ? turns.map((t) => (
              <AnswerCard
                key={t.id}
                turn={t}
                onRetry={(s: AnswerStyle) => onRegenerate(t, s)}
              />
            ))
          : practice.map(({ turn, review }, i) => (
              <ReviewCard
                key={turn.id}
                turn={turn}
                review={review}
                index={practice.length - 1 - i}
                onAddToCard={onAddToCard}
              />
            ))}

        {!pending && count === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              compact
              icon={mode === 'practice' ? <Sparkles size={16} /> : <Mic size={16} />}
              title={mode === 'practice' ? '等面试官出题' : '等第一句话'}
              desc={
                mode === 'practice'
                  ? '点左侧「让面试官出下一题」，然后用语音或文字作答，提交后会逐条点评。'
                  : '点麦克风开始听题，或直接在左下角输入框里打字。命中标准问答会直接显示你准备好的答案；没命中再结合简历和 JD 现场生成。'
              }
            />
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-ink-line/60 px-3.5 py-1.5 text-[10px] text-txt-mute">
        <span className="inline-flex items-center gap-1">
          <Radio size={9} />
          {mode === 'practice'
            ? '练习模式：每题独立点评，不生成答稿'
            : '标准问答优先：命中直接出答案，没命中再调模型'}
        </span>
        <span className="inline-flex items-center gap-1">
          {pending ? '生成中…' : cardCount ? `${cardCount} 张卡在上下文` : '无卡上下文'}
        </span>
      </div>
    </div>
  );
}
