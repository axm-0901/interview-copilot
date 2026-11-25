'use client';

import Link from 'next/link';
import { Activity, MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pipeline, type Step } from './Pipeline';
import type { Profile } from '@/lib/types';

export function DashboardHero({
  profile,
  greeting,
  cardCount,
  chunkCount,
  sessionCount,
  steps,
}: {
  profile?: Profile;
  greeting: string;
  cardCount: number;
  chunkCount: number;
  sessionCount: number;
  steps: Step[];
}) {
  return (
    <section className="relative overflow-hidden rounded-panel border border-ink-line bg-ink-panel/85 px-5 py-4">
      <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-brand/14 blur-[70px]" />
      <div className="pointer-events-none absolute -right-10 -top-20 h-52 w-52 rounded-full bg-brand-violet/12 blur-[70px]" />
      <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-txt-mute">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-txt-mute/50" />
            <span className="text-[11px] text-txt-mute">{greeting}</span>
          </div>
          <h2 className="mt-1 text-[21px] font-semibold leading-tight tracking-tight text-txt">
            {profile?.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-txt-dim">
            <span className="text-txt">{profile?.company || '目标公司待定'}</span>
            <span className="text-txt-mute">·</span>
            <span>{profile?.targetRole || '目标岗位待定'}</span>
            <span className="text-txt-mute">·</span>
            <span>{profile?.round}</span>
            <span className="text-txt-mute">·</span>
            <span>{profile?.lang}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/live">
              <Button variant="primary" size="md">
                <Activity size={14} />
                开始本轮实战
              </Button>
            </Link>
            <Link href="/qa">
              <Button variant="outline" size="md">
                <MessageSquareText size={14} />
                写标准问答
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="md">
                完善档案
              </Button>
            </Link>
          </div>
        </div>

        <div className="w-full shrink-0 rounded-card border border-ink-line/80 bg-[#0e131a]/70 px-3.5 py-3 lg:w-[268px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-txt-mute">本轮上下文</span>
            <Badge tone="violet">{cardCount} 题</Badge>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-txt-dim">标准问答</span>
              <span className="font-mono text-txt">{cardCount}</span>
            </div>
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-txt-dim">知识库片段</span>
              <span className="font-mono text-txt">{chunkCount}</span>
            </div>
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-txt-dim">历史场次</span>
              <span className="font-mono text-txt">{sessionCount}</span>
            </div>
          </div>
          <div className="mt-2 border-t border-ink-line/70 pt-2 text-[10.5px] leading-relaxed text-txt-mute">
            标准问答命中直接原样出答案；没命中再由模型结合简历、JD 现场生成。
          </div>
        </div>
      </div>

      <div className="hairline my-3.5" />
      <Pipeline steps={steps} />
    </section>
  );
}
