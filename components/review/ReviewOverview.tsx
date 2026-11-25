'use client';

import Link from 'next/link';
import { ArrowRight, Layers, Plus, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { fmtDate, fmtDuration, scoreBg } from '@/lib/utils';
import type { Session } from '@/lib/types';
import type { DemoReviewPayload } from '@/lib/demo';

export interface ReviewComputed {
  avg: number;
  strongest: string;
  weakest: string;
  ranked: { k: string; avg: number }[];
}

export function ReviewOverview({
  session,
  turnCount,
  reviewCount,
  summary,
  computed,
}: {
  session: Session | null;
  turnCount: number;
  reviewCount: number;
  summary: DemoReviewPayload['summary'] | null;
  computed: ReviewComputed | null;
}) {
  return (
    <div className="space-y-3">
      <Panel className="p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-txt-mute">
          场次总览
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[12px] border font-mono text-[22px] font-semibold ${
              computed ? scoreBg(computed.avg) : 'border-ink-line text-txt-mute'
            }`}
          >
            {computed ? computed.avg.toFixed(1) : '—'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-txt">{session?.title}</div>
            <div className="mt-0.5 text-[10.5px] text-txt-mute">
              {session ? fmtDate(session.startedAt) : ''}
              {session ? ` · ${fmtDuration(session.startedAt, session.endedAt)}` : ''}
            </div>
            <div className="mt-0.5 text-[10.5px] text-txt-mute">
              {turnCount} 条问答 · {reviewCount} 条点评
            </div>
          </div>
        </div>

        {computed ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[7px] border border-ok/20 bg-ok/[.05] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[9.5px] text-ok/80">
                <TrendingUp size={9} />
                最强
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-txt">{computed.strongest}</div>
            </div>
            <div className="rounded-[7px] border border-danger/20 bg-danger/[.05] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[9.5px] text-danger/80">
                <TrendingDown size={9} />
                最弱
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-txt">{computed.weakest}</div>
            </div>
          </div>
        ) : null}

        {computed?.ranked?.length ? (
          <div className="mt-3 space-y-1.5">
            {computed.ranked.map((r) => (
              <div key={r.k} className="flex items-center gap-2">
                <span className="w-[58px] shrink-0 truncate text-[10.5px] text-txt-dim">{r.k}</span>
                <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[.05]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#4d8dff,#7b5cff)]"
                    style={{ width: `${(r.avg / 5) * 100}%` }}
                  />
                </div>
                <span className="w-[22px] shrink-0 text-right font-mono text-[10px] text-txt-mute">
                  {r.avg.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      {summary?.top3?.length ? (
        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
            <Target size={11} className="text-warn" />
            下一场必须改掉
          </div>
          <div className="space-y-1.5">
            {summary.top3.map((x, i) => (
              <div key={i} className="flex gap-2 text-[11px] leading-relaxed text-txt-dim">
                <span className="font-mono text-[10px] text-warn/80">0{i + 1}</span>
                <span>{x}</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {summary?.facts?.length ? (
        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
            <Sparkles size={11} className="text-brand-violet" />
            建议补进技能卡
          </div>
          <div className="space-y-1.5">
            {summary.facts.map((x, i) => (
              <div key={i} className="flex gap-2 text-[11px] leading-relaxed text-txt-dim">
                <Plus size={9} className="mt-[4px] shrink-0 text-brand-violet/80" />
                <span>{x}</span>
              </div>
            ))}
          </div>
          <Link
            href="/skills"
            className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] text-[#9cc0ff] hover:underline"
          >
            去技能卡补充
            <ArrowRight size={10} />
          </Link>
        </Panel>
      ) : null}

      <Panel className="p-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
          <Layers size={11} className="text-txt-mute" />
          快照
        </div>
        <div className="text-[10.5px] leading-relaxed text-txt-mute">{session?.snapshotLabel}</div>
        <div className="mt-1 text-[10px] text-txt-mute/70">
          这场回答里的个人事实来自这份快照，所以前后不会打架。
        </div>
      </Panel>
    </div>
  );
}
