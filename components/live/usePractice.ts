'use client';

import { useCallback, useState } from 'react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { chatStream } from '@/lib/llm';
import { PREP_SYSTEM, prepUserPrompt } from '@/lib/prompts';
import { demoPrep } from '@/lib/demo';
import { evaluateOne } from '@/lib/review';
import { normalizeCard } from '@/lib/cards';
import { toast } from '@/lib/toast';
import type { AppSettings, Review, Session, SkillCard, Turn } from '@/lib/types';

export interface PracticeItem {
  turn: Turn;
  review: Review;
}

export function usePractice(session: Session | null, settings: AppSettings) {
  const [question, setQuestion] = useState('');
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(
    async (cards: SkillCard[]) => {
      const card = cards[0];
      if (!card) {
        toast('还没有已确认的技能卡', 'warn', '练习模式需要有卡才能出题');
        return;
      }
      setGenerating(true);
      try {
        let acc = '';
        for await (const d of chatStream({
          settings,
          temperature: 0.8,
          messages: [
            { role: 'system', content: PREP_SYSTEM },
            { role: 'user', content: prepUserPrompt(card, [], '') },
          ],
          demo: () => demoPrep(card, items.length).q,
        })) {
          acc += d;
        }
        const q =
          acc
            .replace(/旁注[:：][\s\S]*$/, '')
            .replace(/^问[:：]\s*/, '')
            .replace(/```/g, '')
            .trim() || '挑你最有把握的一个项目，讲讲你个人负责的那部分。';
        setQuestion(q);
      } catch (e: any) {
        toast('出题失败', 'err', String(e?.message ?? e).slice(0, 120));
      } finally {
        setGenerating(false);
      }
    },
    [settings, items.length]
  );

  const submit = useCallback(
    async (answer: string, source: Turn['source'] = 'manual') => {
      if (!session) return;
      if (!question) {
        toast('先让面试官出一题', 'warn');
        return;
      }
      const q = question;
      const r = await evaluateOne(q, answer, settings);
      const turn: Turn = {
        id: db.uid('t'),
        sessionId: session.id,
        question: q,
        source,
        answerMd: answer,
        citations: [],
        latencyMs: 0,
        createdAt: Date.now(),
        style: 'standard',
        degraded: false,
        demo: !settings.apiKey.trim(),
      };
      const review: Review = {
        id: db.uid('rv'),
        turnId: turn.id,
        sessionId: session.id,
        type: r.type,
        score: r.score,
        fatal: r.fatal,
        rewrite: r.rewrite,
        reminder: r.reminder,
        createdAt: Date.now(),
      };
      await db.putTurn(turn);
      await db.putReviews([review]);
      setItems((list) => [{ turn, review }, ...list]);
      setQuestion('');
    },
    [session, question, settings]
  );

  const addToCard = useCallback(async (review: Review, turn: Turn) => {
    const { cards, refreshActive } = useApp.getState();
    const card = cards[0];
    if (!card) {
      toast('先去技能卡建一张卡', 'warn');
      return;
    }
    const q = review.reminder ? `${turn.question}（${review.reminder}）` : turn.question;
    const next = normalizeCard({
      ...card,
      followups: [
        ...card.followups.filter((f) => f.q),
        { q, a: review.rewrite.replace(/\*\*/g, '').slice(0, 60) },
      ].slice(0, 6),
    });
    await db.putCard(next);
    await refreshActive();
    toast('已作为追问沉淀到技能卡', 'ok', card.project);
  }, []);

  return { question, setQuestion, items, setItems, generating, generate, submit, addToCard };
}
