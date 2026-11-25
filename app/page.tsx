'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpenCheck,
  Database,
  MessageSquareText,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { seedSample } from '@/lib/sample';
import { toast } from '@/lib/toast';
import { Panel } from '@/components/ui/Panel';
import { StatCard } from '@/components/dashboard/StatCard';
import { NextAction, type Step } from '@/components/dashboard/Pipeline';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { RecentSessions, WeaknessPanel } from '@/components/dashboard/RecentSessions';
import { EmptyLanding } from '@/components/dashboard/EmptyLanding';
import { fmtDate, scoreBg } from '@/lib/utils';
import type { Review } from '@/lib/types';

export default function DashboardPage() {
  const { activeId, profiles, docs, chunks, qas, sessions } = useApp();
  const active = profiles.find((p) => p.id === activeId);
  const [latestReviews, setLatestReviews] = useState<Review[]>([]);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const s = sessions[0];
    if (!s) {
      setLatestReviews([]);
      return;
    }
    void db.listReviews(s.id).then(setLatestReviews);
  }, [sessions]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '还没睡';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 19) return '下午好';
    return '晚上好';
  }, []);

  const scored = sessions.filter((s) => typeof s.avgScore === 'number' && s.avgScore > 0);
  const avg = scored.length
    ? Math.round((scored.reduce((n, s) => n + (s.avgScore ?? 0), 0) / scored.length) * 10) / 10
    : 0;

  const steps: Step[] = [
    {
      label: '面试档案',
      metric: docs.length ? `${docs.length} 份材料` : '还没上传',
      state: docs.length ? 'done' : 'current',
      href: '/profile',
    },
    {
      label: '标准问答',
      metric: qas.length ? `${qas.length} 题` : '还没写',
      state: qas.length ? 'done' : docs.length ? 'current' : 'todo',
      href: '/qa',
    },
    {
      label: '实战',
      metric: sessions.length ? `${sessions.length} 场` : '还没开始',
      state: sessions.length ? 'done' : qas.length ? 'current' : 'todo',
      href: '/live',
    },
    {
      label: '复盘',
      metric: latestReviews.length ? `最近 ${latestReviews.length} 条点评` : '待生成',
      state: latestReviews.length ? 'done' : sessions.length ? 'current' : 'todo',
      href: '/review',
    },
  ];

  const weak = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of latestReviews) {
      const cur = m.get(r.type) ?? { sum: 0, n: 0 };
      cur.sum += r.score;
      cur.n += 1;
      m.set(r.type, cur);
    }
    return [...m.entries()]
      .map(([type, v]) => ({ type, avg: Math.round((v.sum / v.n) * 10) / 10, n: v.n }))
      .sort((a, b) => a.avg - b.avg);
  }, [latestReviews]);

  const next = (() => {
    if (!activeId)
      return { title: '', desc: '', href: '/profile', cta: '' };
    if (!docs.length)
      return {
        title: '档案还是空的',
        desc: '至少上传一份简历 + 粘贴一段 JD，后面的检索和洞察都依赖它。',
        href: '/profile',
        cta: '上传材料',
      };
    if (!qas.length)
      return {
        title: '还没有标准问答',
        desc: '把面试官常问的题、同义问法和完整答案提前写进去。命中后直接显示，不走模型，也没有思考延迟。',
        href: '/qa',
        cta: '去写标准问答',
      };
    if (!sessions.length)
      return {
        title: '可以开始第一轮实战了',
        desc: `本轮会冻结 ${qas.length} 道标准问答作为快照，命中就直接出答案。`,
        href: '/live',
        cta: '进入实战辅助',
      };
    if (!latestReviews.length)
      return {
        title: '上一场还没复盘',
        desc: '逐条点评会指出哪句话让面试官起了疑心，并给出 30 秒改写示范。',
        href: '/review',
        cta: '生成复盘',
      };
    return {
      title: `补一下「${weak[0]?.type ?? '项目深挖'}」这类问题`,
      desc: '这是最近一场里最弱的一类。回到标准问答，把这类题的标准答案补完整。',
      href: '/qa',
      cta: '去补标准问答',
    };
  })();

  if (!activeId) {
    return (
      <EmptyLanding
        seeding={seeding}
        onSeed={async () => {
          setSeeding(true);
          try {
            const p = await seedSample();
            await useApp.getState().refreshProfiles();
            await useApp.getState().setActive(p.id);
            toast('示例档案已载入', 'ok', '含 5 份材料、6 道标准问答、1 场复盘记录');
          } finally {
            setSeeding(false);
          }
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-5 py-5">
      <DashboardHero
        profile={active}
        greeting={greeting}
        cardCount={qas.length}
        chunkCount={chunks.length}
        sessionCount={sessions.length}
        steps={steps}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<MessageSquareText size={12} />}
          label="标准问答"
          value={qas.length}
          unit="题"
          sub={qas.length ? '命中即答，不走模型' : '先把高频题写进去'}
        />
        <StatCard
          icon={<Database size={12} />}
          label="知识库片段"
          value={chunks.length}
          unit="段"
          sub={`来自 ${docs.length} 份材料`}
          tone="violet"
        />
        <StatCard
          icon={<Activity size={12} />}
          label="累计场次"
          value={sessions.length}
          unit="场"
          sub={sessions[0] ? `最近 ${fmtDate(sessions[0].startedAt)}` : '还没有记录'}
          tone="ok"
        />
        <StatCard
          icon={<Target size={12} />}
          label="平均分"
          value={avg || '—'}
          unit={avg ? '/ 5' : ''}
          sub={scored.length ? `${scored.length} 场已点评` : '等待第一场复盘'}
          tone={avg >= 4 ? 'ok' : avg >= 3 ? 'warn' : 'brand'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <RecentSessions sessions={sessions} />
          <WeaknessPanel weak={weak} basedOn={sessions[0] ? fmtDate(sessions[0].startedAt) : undefined} />
        </div>

        <div className="space-y-4">
          <NextAction title={next.title} desc={next.desc} href={next.href} cta={next.cta} />

          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-txt">
              <BookOpenCheck size={13} className="text-brand-violet" />
              标准问答库
            </div>
            {qas.length === 0 ? (
              <div className="text-[11.5px] leading-relaxed text-txt-mute">
                还没有标准问答。实战命中不了，就只能现场调用模型生成。
              </div>
            ) : (
              <div className="space-y-1.5">
                {qas.slice(0, 4).map((q) => (
                  <Link
                    key={q.id}
                    href="/qa"
                    className="flex items-center gap-2 rounded-[7px] border border-ink-line/60 bg-[#0e131a]/60 px-2 py-1.5 transition-colors hover:border-ink-line2"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-txt-dim">{q.question}</span>
                    <span className="shrink-0 text-[10px] text-txt-mute">{q.aliases.length} 种问法</span>
                  </Link>
                ))}
                {qas.length > 4 ? (
                  <div className="pt-1 text-[10.5px] text-txt-mute">还有 {qas.length - 4} 题…</div>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-txt">
              <TriangleAlert size={13} className="text-txt-mute" />
              使用边界
            </div>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-txt-mute">
              <li>· 纯 Web 只能听麦克风，听不到会议里对方的声音</li>
              <li>· 识别质量取决于浏览器，专业术语容易错</li>
              <li>· 数字与事实由你负责，模型只做组织与表达</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
