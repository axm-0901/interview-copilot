'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Copy,
  Layers,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Timer,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Markdown } from '@/components/ui/Markdown';
import { cn, copyText } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { analyzeQuestion, metaFor } from '@/lib/playbook';
import { readableText } from '@/lib/answer';
import type { AnswerStyle, Citation, Turn } from '@/lib/types';
import type { PendingAnswer } from './useLiveSession';

export function AnswerCard({
  turn,
  pending,
  onRetry,
}: {
  turn?: Turn;
  pending?: PendingAnswer;
  onRetry: (style: AnswerStyle) => void;
}) {
  const [openCit, setOpenCit] = useState(false);
  const [tick, setTick] = useState(0);
  const data = turn ?? pending;
  const streamingEmpty = !turn && Boolean(pending) && !pending?.text;

  useEffect(() => {
    if (!streamingEmpty) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [streamingEmpty]);

  if (!data) return null;

  const text = ('answerMd' in data ? data.answerMd : data.text) ?? '';
  const citations: Citation[] = data.citations ?? [];
  const cardCount = citations.filter((c) => c.type === 'card').length;
  const chunkCount = citations.filter((c) => c.type === 'chunk').length;
  const degraded = 'degraded' in data ? data.degraded : false;
  const demo = 'demo' in data ? data.demo : false;
  const error = 'error' in data ? data.error : undefined;
  const streaming = !turn && !error;
  const elapsed = Math.floor(tick / 2) + 1;
  const qaHit = Boolean(data.qaId);
  const qaVariant = 'qaVariant' in data ? data.qaVariant : undefined;

  const qtype = ('qtype' in data ? data.qtype : undefined) ?? analyzeQuestion(data.question).kind;
  const meta = metaFor(qtype);
  const used = 'used' in data ? data.used : undefined;
  const usedCards = used?.cards ?? cardCount;
  const usedChunks = used?.chunks ?? chunkCount;
  const usedResume = used?.resume ?? false;
  const usedJd = used?.jd ?? false;
  const noMaterial = !usedCards && !usedChunks && !usedResume && !usedJd;

  return (
    <div className="animate-fadeUp overflow-hidden rounded-panel border border-ink-line bg-ink-panel/85">
      <div className="flex items-start gap-2.5 border-b border-ink-line/60 px-3.5 py-2.5">
        <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border border-ink-line2 bg-[#0e131a] font-mono text-[10px] text-txt-mute">
          Q
        </span>
        <div className="min-w-0 flex-1 text-[12.5px] font-medium leading-relaxed text-txt">
          {data.question}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data.source === 'asr' ? (
            <Badge tone="muted">语音</Badge>
          ) : data.source === 'image' ? (
            <Badge tone="violet">截图</Badge>
          ) : (
            <Badge tone="muted">手动</Badge>
          )}
        </div>
      </div>

      <div className="px-3.5 pb-2.5 pt-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">{meta.label}</Badge>
          {qaHit ? <Badge tone="violet">标准问答</Badge> : null}
          {usedCards ? (
            <Badge tone="muted">
              <Layers size={9} />
              技能卡 {usedCards}
            </Badge>
          ) : null}
          {usedResume ? <Badge tone="muted">简历</Badge> : null}
          {usedJd ? <Badge tone="muted">JD</Badge> : null}
          {usedChunks ? <Badge tone="muted">知识库 {usedChunks}</Badge> : null}
          {noMaterial && !qaHit ? <Badge tone="muted">通用知识</Badge> : null}
          {degraded && noMaterial ? <Badge tone="warn">未检索到经历 · 按通用答法</Badge> : null}
          {demo ? <Badge tone="violet">演示合成</Badge> : null}
          {typeof data.latencyMs === 'number' ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-txt-mute">
              <Timer size={9} />
              {qaHit ? '直接命中' : `首字 ${data.latencyMs}ms`}
            </span>
          ) : null}
        </div>

        <div className="mb-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-txt-mute">
          <Lightbulb size={10} className="mt-[2px] shrink-0 text-warn/75" />
          <span>
            {qaHit
              ? `命中标准问答${qaVariant ? `：${qaVariant}` : ''}，原样显示准备好的答案`
              : `考点：${meta.tip}`}
          </span>
        </div>

        {!text && streaming ? (
          <div className="flex items-center gap-2 py-3 text-[12.5px] text-txt-dim">
            <span className="flex gap-1">
              <span className="h-[5px] w-[5px] animate-breathe rounded-full bg-brand" />
              <span className="h-[5px] w-[5px] animate-breathe rounded-full bg-brand [animation-delay:.18s]" />
              <span className="h-[5px] w-[5px] animate-breathe rounded-full bg-brand [animation-delay:.36s]" />
            </span>
            <span>
              已锁定题型 · 正在生成第一句
              {pending?.tip ? <span className="text-txt-mute">（{pending.tip}）</span> : null}
              <span className="ml-1 font-mono text-txt-mute">{elapsed}s</span>
            </span>
          </div>
        ) : (
          <Markdown text={text} />
        )}

        {streaming && text ? (
          <span className="ml-0.5 inline-block h-[13px] w-[3px] animate-breathe bg-brand align-middle" />
        ) : null}

        {error ? (
          <div className="mt-2 flex items-start gap-2 rounded-[7px] border border-danger/30 bg-danger/[.07] px-2.5 py-2">
            <TriangleAlert size={12} className="mt-[3px] shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] leading-relaxed text-[#ff9aa2]">{error}</div>
              <button
                onClick={() => onRetry(turn?.style ?? 'standard')}
                className="mt-1 inline-flex items-center gap-1 rounded-[5px] border border-danger/30 px-1.5 py-[1px] text-[10.5px] text-danger hover:bg-danger/10"
              >
                <RotateCcw size={9} />
                重试
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {citations.length > 0 ? (
        <div className="border-t border-ink-line/50">
          <button
            onClick={() => setOpenCit((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-1.5 text-[10.5px] text-txt-mute transition-colors hover:bg-white/[.025]"
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown size={10} className={cn('transition-transform', openCit && 'rotate-180')} />
              展开引用来源（{citations.length}）
            </span>
            <span className="font-mono">sim snapshot</span>
          </button>
          {openCit ? (
            <div className="space-y-1.5 px-3.5 pb-2.5">
              {citations.map((c, i) => (
                <div
                  key={`${c.id}-${i}`}
                  className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/60 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'shrink-0 rounded-[4px] px-1 py-px text-[9.5px]',
                          c.type === 'card' ? 'bg-brand/15 text-[#9cc0ff]' : 'bg-white/[.06] text-txt-mute'
                        )}
                      >
                        {c.type === 'card' ? '技能卡' : '知识库'}
                      </span>
                      <span className="truncate text-[11px] text-txt-dim">{c.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[9.5px] text-txt-mute">
                      {c.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-relaxed text-txt-mute">{c.text}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-ink-line/60 px-2.5 py-1.5">
        <div className="flex items-center gap-0.5">
          <ActionBtn
            icon={<Copy size={10} />}
            label="复制"
            onClick={() => {
              void copyText(readableText(text)).then((ok) => ok && toast('已复制答稿', 'ok'));
            }}
            disabled={!text}
          />
          <ActionBtn
            icon={<RotateCcw size={10} />}
            label="重答"
            onClick={() => onRetry(turn?.style ?? 'standard')}
            disabled={streaming}
          />
          <ActionBtn
            icon={<Wand2 size={10} />}
            label="更简"
            onClick={() => onRetry('concise')}
            disabled={streaming}
          />
          <ActionBtn icon={<Sparkles size={10} />} label="更具体" onClick={() => onRetry('detailed')} disabled={streaming} />
        </div>
        <span className="pr-1 text-[9.5px] text-txt-mute/70">
          {'style' in data ? (data.style === 'concise' ? '简洁' : data.style === 'detailed' ? '详细' : '标准') : ''}
        </span>
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-[3px] text-[10.5px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim disabled:opacity-35"
    >
      {icon}
      {label}
    </button>
  );
}
