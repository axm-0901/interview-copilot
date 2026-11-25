'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Download, RefreshCw } from 'lucide-react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { generateReviews } from '@/lib/review';
import { emptyCard } from '@/lib/cards';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewOverview, type ReviewComputed } from '@/components/review/ReviewOverview';
import { downloadText, fmtDate, fmtDuration } from '@/lib/utils';
import type { Review, Turn } from '@/lib/types';
import type { DemoReviewPayload } from '@/lib/demo';

export default function ReviewPage() {
  const { sessions, activeId, settings, refreshSessions, refreshActive } = useApp();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<DemoReviewPayload['summary'] | null>(null);
  const [local, setLocal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('session');
    if (p) setSessionId(p);
  }, []);

  useEffect(() => {
    if (sessionId && sessions.some((s) => s.id === sessionId)) return;
    if (sessions[0]) setSessionId(sessions[0].id);
  }, [sessions, sessionId]);

  const session = sessions.find((s) => s.id === sessionId) ?? null;

  const load = useCallback(async (sid: string) => {
    const [t, r, kv] = await Promise.all([
      db.listTurns(sid),
      db.listReviews(sid),
      db.kvGet<{ summary: DemoReviewPayload['summary']; local: boolean }>(`reviewSummary:${sid}`),
    ]);
    setTurns(t);
    setReviews(r);
    setSummary(kv?.summary ?? null);
    setLocal(Boolean(kv?.local));
  }, []);

  useEffect(() => {
    if (sessionId) void load(sessionId);
    else {
      setTurns([]);
      setReviews([]);
      setSummary(null);
    }
  }, [sessionId, load]);

  const byTurn = useMemo(() => new Map(reviews.map((r) => [r.turnId, r])), [reviews]);

  const computed = useMemo<ReviewComputed | null>(() => {
    if (!reviews.length) return null;
    const avg = Math.round((reviews.reduce((n, r) => n + r.score, 0) / reviews.length) * 10) / 10;
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const c = m.get(r.type) ?? { sum: 0, n: 0 };
      c.sum += r.score;
      c.n += 1;
      m.set(r.type, c);
    }
    const ranked = [...m.entries()]
      .map(([k, v]) => ({ k, avg: v.sum / v.n }))
      .sort((a, b) => b.avg - a.avg);
    return {
      avg,
      strongest: summary?.strongest ?? ranked[0]?.k ?? '—',
      weakest: summary?.weakest ?? ranked[ranked.length - 1]?.k ?? '—',
      ranked,
    };
  }, [reviews, summary]);

  async function gen() {
    if (!session) return;
    setLoading(true);
    try {
      const res = await generateReviews(session, settings);
      await load(session.id);
      await refreshSessions();
      toast(
        `复盘已生成 · 平均分 ${res.summary.avg}`,
        'ok',
        res.local ? '未配置 Key，使用本地规则点评' : '逐条点评已落库'
      );
    } catch (e: any) {
      toast('生成失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setLoading(false);
    }
  }

  async function addToCard(review: Review, turn: Turn) {
    if (!activeId) return;
    const c = emptyCard(activeId, `补充：${turn.question.replace(/[？?。]/g, '').slice(0, 16)}`);
    c.background = review.fatal;
    const first = review.rewrite
      .split('\n')
      .map((s) => s.replace(/^[-*\s]+/, '').replace(/\*\*/g, '').trim())
      .filter((s) => s.length > 8)[0];
    c.actions = first ? [first] : [''];
    await db.putCard(c);
    await refreshActive();
    toast('已沉淀为技能卡草稿', 'ok', '去技能卡里补齐数字和取舍');
  }

  function exportMd() {
    if (!session) return;
    const lines = [
      `# ${session.title}`,
      '',
      `- 时间：${fmtDate(session.startedAt)} · 时长 ${fmtDuration(session.startedAt, session.endedAt)}`,
      `- 快照：${session.snapshotLabel}`,
      `- 平均分：${computed?.avg ?? '—'} / 5`,
      '',
    ];
    for (const r of reviews) {
      const t = turns.find((x) => x.id === r.turnId);
      if (!t) continue;
      lines.push(
        `## ${t.question}`,
        '',
        '**我的回答**',
        '',
        t.answerMd || '（未作答）',
        '',
        `**点评**：${r.type} · ${r.score}/5`,
        '',
        `- 致命伤：${r.fatal}`,
        `- 下次提醒：${r.reminder}`,
        '',
        '**30 秒改写**',
        '',
        r.rewrite,
        ''
      );
    }
    if (summary?.top3?.length) {
      lines.push('## 下一场必须改掉的三个点', '', ...summary.top3.map((x, i) => `${i + 1}. ${x}`), '');
    }
    downloadText(`${session.title.replace(/\s/g, '_')}_复盘.md`, lines.join('\n'));
    toast('已导出 Markdown', 'ok');
  }

  if (!sessions.length) {
    return (
      <div className="mx-auto max-w-[860px] px-5 py-8">
        <Panel className="p-6">
          <EmptyState
            icon={<BookOpenCheck size={18} />}
            title="还没有可以复盘的场次"
            desc="去实战辅助走一轮问答，结束后就能在这里看到逐条点评。"
            action={
              <Link href="/live">
                <Button variant="primary" size="md">
                  去实战
                  <ArrowRight size={13} />
                </Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-5 py-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold tracking-tight text-txt">复盘</h2>
            {reviews.length ? (
              <Badge tone={local ? 'warn' : 'brand'} dot>
                {local ? '本地规则点评' : '模型点评'}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[11.5px] text-txt-mute">
            每条点评都必须指向你说过的某一句话。空泛的「表达还可以」不算点评。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sessionId ?? ''} onChange={(e) => setSessionId(e.target.value)} className="w-[260px]">
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} · {fmtDate(s.startedAt)}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="md" onClick={exportMd} disabled={!reviews.length}>
            <Download size={12} />
            导出
          </Button>
          <Button variant="primary" size="md" onClick={() => void gen()} loading={loading} disabled={!turns.length}>
            <RefreshCw size={12} />
            {reviews.length ? '重新生成' : '生成复盘'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[308px_1fr]">
        <ReviewOverview
          session={session}
          turnCount={turns.length}
          reviewCount={reviews.length}
          summary={summary}
          computed={computed}
        />

        <div className="space-y-3">
          {!turns.length ? (
            <EmptyState
              icon={<BookOpenCheck size={18} />}
              title="这一场没有问答记录"
              desc="可能是刚开始就结束了。去实战里答两题再回来。"
              action={
                <Link href="/live">
                  <Button variant="primary" size="sm">
                    去实战
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-[.14em] text-txt-mute">
                  逐条点评 · {turns.length}
                </span>
                {!reviews.length ? (
                  <span className="text-[10.5px] text-warn">还没有点评，点右上角生成</span>
                ) : null}
              </div>
              <div className="space-y-2.5">
                {turns.map((t, i) => (
                  <ReviewCard
                    key={t.id}
                    turn={t}
                    review={byTurn.get(t.id)}
                    index={i}
                    onAddToCard={(r, tn) => void addToCard(r, tn)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
