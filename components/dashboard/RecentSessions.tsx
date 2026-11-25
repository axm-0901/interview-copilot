'use client';

import Link from 'next/link';
import { Activity, ArrowRight, TriangleAlert } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { MiniBar } from './StatCard';
import { fmtDate, fmtDuration, scoreBg } from '@/lib/utils';
import type { Session } from '@/lib/types';

export function RecentSessions({ sessions }: { sessions: Session[] }) {
  return (
    <Panel>
      <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-txt">
          <Activity size={13} className="text-brand" />
          最近场次
        </div>
        <Link
          href="/review"
          className="flex items-center gap-1 text-[11.5px] text-txt-mute transition-colors hover:text-txt"
        >
          全部复盘
          <ArrowRight size={11} />
        </Link>
      </div>
      {sessions.length === 0 ? (
        <div className="px-4 pb-4">
          <EmptyState
            compact
            icon={<Activity size={16} />}
            title="还没有实战记录"
            desc="开始一轮后，每一条问答都会落库，随时可以回来看。"
            action={
              <Link href="/live">
                <Button variant="primary" size="sm">
                  开始第一轮
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="px-2 pb-2">
          {sessions.slice(0, 5).map((s) => (
            <Link
              key={s.id}
              href={`/review?session=${s.id}`}
              className="flex items-center gap-3 rounded-[8px] px-2.5 py-2 transition-colors hover:bg-white/[.035]"
            >
              <div className="flex w-[52px] shrink-0 flex-col items-center">
                <span
                  className={`rounded-[6px] border px-1.5 py-px font-mono text-[12px] font-semibold ${scoreBg(
                    s.avgScore ?? 0
                  )}`}
                >
                  {s.avgScore ? s.avgScore.toFixed(1) : '—'}
                </span>
                <span className="mt-0.5 text-[9.5px] text-txt-mute">/ 5</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-txt">{s.title}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-txt-mute">
                  <span>{fmtDate(s.startedAt)}</span>
                  <span className="h-[2px] w-[2px] rounded-full bg-txt-mute/60" />
                  <span>{fmtDuration(s.startedAt, s.endedAt)}</span>
                  <span className="h-[2px] w-[2px] rounded-full bg-txt-mute/60" />
                  <span>{s.mode === 'practice' ? '练习模式' : '辅助模式'}</span>
                </div>
              </div>
              <ArrowRight size={12} className="shrink-0 text-txt-mute/60" />
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function WeaknessPanel({
  weak,
  basedOn,
}: {
  weak: { type: string; avg: number; n: number }[];
  basedOn?: string;
}) {
  return (
    <Panel>
      <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-txt">
          <TriangleAlert size={13} className="text-warn" />
          短板追踪
        </div>
        <span className="text-[10.5px] text-txt-mute">{basedOn ? `基于 ${basedOn} 那场` : '暂无数据'}</span>
      </div>
      {weak.length === 0 ? (
        <div className="px-4 pb-4 text-[11.5px] leading-relaxed text-txt-mute">
          生成一场复盘后，这里会按问题类型列出你的得分分布。
        </div>
      ) : (
        <div className="space-y-2 px-4 pb-4">
          {weak.map((w) => (
            <MiniBar
              key={w.type}
              label={w.type}
              value={Math.round(w.avg * 10) / 10}
              max={5}
              tone={w.avg < 3 ? 'danger' : w.avg < 3.7 ? 'warn' : 'brand'}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
