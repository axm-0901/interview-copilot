'use client';

import { CheckCircle2, Circle, FileSearch, MessageSquareQuote, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/EmptyState';
import { cardCompleteness } from '@/lib/cards';
import type { SkillCard } from '@/lib/types';
import { cn } from '@/lib/utils';

export function SkillCardItem({
  card,
  onEdit,
  onPrep,
}: {
  card: SkillCard;
  onEdit: () => void;
  onPrep: () => void;
}) {
  const { pct, checks } = cardCompleteness(card);
  const confirmed = card.status === 'confirmed';
  const missing = checks.find((c) => !c.ok);
  const counts = [
    { label: '动作', n: card.actions.filter(Boolean).length },
    { label: '取舍', n: card.decisions.filter(Boolean).length },
    { label: '结果', n: card.results.filter(Boolean).length },
    { label: '追问', n: card.followups.filter((f) => f.q).length },
  ];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-panel border bg-ink-panel/80 transition-all duration-200',
        confirmed
          ? 'border-ink-line hover:border-ok/35'
          : 'border-ink-line/80 hover:border-warn/35'
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-[2px]',
          confirmed
            ? 'bg-[linear-gradient(90deg,#35c58a,rgba(53,197,138,0))]'
            : 'bg-[linear-gradient(90deg,#f5a623,rgba(245,166,35,0))]'
        )}
      />

      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[13.5px] font-semibold text-txt">
                {card.project || '未命名项目'}
              </h3>
              {confirmed ? (
                <Badge tone="ok">
                  <CheckCircle2 size={10} />
                  已确认
                </Badge>
              ) : (
                <Badge tone="warn">草稿</Badge>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-txt-mute">
              <span className="font-mono">{card.period || '时间待填'}</span>
              <span className="h-[2px] w-[2px] rounded-full bg-txt-mute/60" />
              <span className="truncate">{card.role || '角色待填'}</span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10.5px] text-txt-mute/70">
            {card.fingerprint.slice(0, 6)}
          </span>
        </div>

        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-txt-dim">
          {card.background || '还没有背景描述。背景一句话就够：当时是什么问题、为什么要做。'}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {counts.map((c) => (
            <span
              key={c.label}
              className={cn(
                'inline-flex items-center gap-1 rounded-[6px] border px-1.5 py-[1px] text-[10.5px]',
                c.n > 0
                  ? 'border-ink-line bg-[#0e131a]/70 text-txt-dim'
                  : 'border-ink-line/50 bg-transparent text-txt-mute/60'
              )}
            >
              {c.label}
              <span className={cn('font-mono', c.n > 0 ? 'text-txt' : '')}>{c.n}</span>
            </span>
          ))}
        </div>

        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[10px] text-txt-mute">
            <span>
              完整度 <span className={pct >= 80 ? 'text-ok' : pct >= 50 ? 'text-warn' : 'text-danger'}>{pct}%</span>
              {missing ? <span className="ml-1.5">· 缺「{missing.key}」</span> : null}
            </span>
            {confirmed ? <span>已进入快照候选</span> : <span>确认后才进入上下文</span>}
          </div>
          <Progress value={pct} tone={pct >= 80 ? 'ok' : pct >= 50 ? 'warn' : 'brand'} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-ink-line/60 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] text-txt-dim transition-colors hover:bg-white/[.05] hover:text-txt"
          >
            <PencilLine size={11} />
            编辑
          </button>
          <button
            onClick={onPrep}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[11.5px] text-txt-dim transition-colors hover:bg-white/[.05] hover:text-txt"
          >
            <MessageSquareQuote size={11} />
            准备对话
          </button>
        </div>
        <span className="inline-flex items-center gap-1 pr-1 text-[10px] text-txt-mute/70">
          {confirmed ? (
            <>
              <CheckCircle2 size={10} className="text-ok/70" />
              可被答稿引用
            </>
          ) : (
            <>
              <Circle size={10} />
              不进上下文
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function SkillEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-ink-line px-6 py-12 text-center">
      <FileSearch size={20} className="mb-2 text-txt-mute" />
      <div className="text-[13px] text-txt-dim">还没有技能卡</div>
      <div className="mt-1 max-w-[340px] text-[11.5px] leading-relaxed text-txt-mute">
        先上传项目材料，再点「准备对话」。AI 会像面试官一样追你的细节，直到能写出一张有数字、有取舍的卡。
      </div>
    </div>
  );
}
