import { chatStream, collect, extractJson } from './llm';
import { buildReviewMessages } from './prompts';
import { demoReview, type DemoReviewPayload, type DemoReviewTurn } from './demo';
import * as db from './db';
import type { AppSettings, QuestionType, Review, Session, Turn } from './types';

const TYPES: QuestionType[] = ['八股', '项目深挖', '行为', '场景设计', '压力测试'];

function normalizeType(t: unknown): QuestionType {
  return TYPES.includes(t as QuestionType) ? (t as QuestionType) : '项目深挖';
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asList(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const list = v.map((x) => asText(x)).filter(Boolean).slice(0, 3);
  return list.length ? list : fallback;
}

/** 把模型返回的一条点评转成内部结构；缺 fatal / rewrite 的条目视为无效。 */
function normalizeTurn(raw: any): Omit<DemoReviewTurn, 'i'> | null {
  const fatal = String(raw?.fatal ?? '').trim();
  const rewrite = String(raw?.rewrite ?? '').trim();
  if (!fatal || !rewrite) return null;
  return {
    type: normalizeType(raw?.type),
    score: Math.max(1, Math.min(5, Math.round(Number(raw?.score) || 3))),
    fatal,
    rewrite,
    reminder: String(raw?.reminder ?? '').trim().slice(0, 24),
  };
}

export interface ReviewResult {
  reviews: Review[];
  summary: DemoReviewPayload['summary'];
  local: boolean;
}

export async function generateReviews(session: Session, settings: AppSettings): Promise<ReviewResult> {
  const turns = await db.listTurns(session.id);
  if (!turns.length) throw new Error('本场还没有问答记录，先答一道题再复盘');

  const pairs = turns.map((t, i) => ({ i, q: t.question, a: t.answerMd }));
  const fallback = demoReview(pairs);
  let payload: DemoReviewPayload = fallback;
  let local = true;

  if (settings.apiKey.trim()) {
    try {
      const raw = await collect(
        chatStream({
          settings,
          temperature: 0.3,
          messages: buildReviewMessages(pairs),
        })
      );
      const parsed = extractJson<any>(raw);
      const rawTurns: any[] = Array.isArray(parsed?.turns) ? parsed.turns : [];
      if (rawTurns.length) {
        const picked = new Map<number, DemoReviewTurn>();
        const pending: { idx: number; turn: Omit<DemoReviewTurn, 'i'> }[] = [];

        // 第一轮只接受合法且未占用的 i；重复 / 越界 / 非数字的留到第二轮按位置回填。
        rawTurns.forEach((rawTurn: any, idx: number) => {
          const turn = normalizeTurn(rawTurn);
          if (!turn) return;
          const explicit = Number(rawTurn?.i);
          if (
            Number.isInteger(explicit) &&
            explicit >= 0 &&
            explicit < turns.length &&
            !picked.has(explicit)
          ) {
            picked.set(explicit, { ...turn, i: explicit });
          } else {
            pending.push({ idx, turn });
          }
        });

        // 第二轮：模型漏了 i 时按数组位置补；位置已占用就交给本地规则，不覆盖正常结果。
        for (const { idx, turn } of pending) {
          if (idx >= 0 && idx < turns.length && !picked.has(idx)) {
            picked.set(idx, { ...turn, i: idx });
          }
        }

        if (picked.size) {
          // 每个 turn 必须恰好一条点评：模型缺的用本地规则补齐，保证索引完整。
          const merged: DemoReviewTurn[] = turns.map((_, i) => picked.get(i) ?? fallback.turns[i]);
          const summary = parsed?.summary ?? {};
          const avg =
            Math.round((merged.reduce((n, t) => n + t.score, 0) / merged.length) * 10) / 10;
          local = false;
          payload = {
            turns: merged,
            summary: {
              avg,
              strongest: asText(summary.strongest) || fallback.summary.strongest,
              weakest: asText(summary.weakest) || fallback.summary.weakest,
              top3: asList(summary.top3, fallback.summary.top3),
              facts: asList(summary.facts, fallback.summary.facts),
            },
          };
        }
      }
    } catch {
      // 网络或解析失败，退回本地规则，不阻塞复盘
    }
  }

  const reviews: Review[] = payload.turns.map((r, idx) => {
    const turn = turns[r.i] ?? turns[idx];
    return {
      id: db.uid('rv'),
      turnId: turn?.id ?? turns[idx].id,
      sessionId: session.id,
      type: r.type,
      score: r.score,
      fatal: r.fatal,
      rewrite: r.rewrite,
      reminder: r.reminder,
      createdAt: Date.now() + idx,
    };
  });

  await db.putReviews(reviews);

  const avg =
    Math.round((reviews.reduce((n, r) => n + r.score, 0) / Math.max(1, reviews.length)) * 10) / 10;
  await db.putSession({
    ...session,
    endedAt: session.endedAt ?? Date.now(),
    avgScore: avg,
  });

  const summary = { ...payload.summary, avg };
  await db.kvSet(`reviewSummary:${session.id}`, { summary, local, at: Date.now() });

  return { reviews, summary, local };
}

/** 练习模式：单条即时点评 */
export async function evaluateOne(question: string, answer: string, settings: AppSettings) {
  const fb = demoReview([{ i: 0, q: question, a: answer }]).turns[0];
  const base: DemoReviewTurn & { local: boolean } = { ...fb, local: true };
  if (!settings.apiKey.trim()) return base;

  try {
    const raw = await collect(
      chatStream({
        settings,
        temperature: 0.3,
        messages: buildReviewMessages([{ i: 0, q: question, a: answer }]),
      })
    );
    const parsed = extractJson<any>(raw);
    const t = parsed?.turns?.[0];
    if (!t?.fatal || !t?.rewrite) return base;
    return {
      i: 0,
      type: normalizeType(t.type),
      score: Math.max(1, Math.min(5, Math.round(Number(t.score) || 3))),
      fatal: String(t.fatal).trim(),
      rewrite: String(t.rewrite).trim(),
      reminder: String(t.reminder ?? fb.reminder).trim().slice(0, 24),
      local: false,
    };
  } catch {
    return base;
  }
}
