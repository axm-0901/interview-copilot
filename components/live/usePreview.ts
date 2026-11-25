'use client';

import { useMemo } from 'react';
import { buildIndex, scoreCards, search, snippet } from '@/lib/retrieval';
import { matchQA } from '@/lib/qaMatch';
import { analyzeQuestion } from '@/lib/playbook';
import type { PreviewHit } from './ContextRail';
import type { Chunk, QAEntry, SkillCard } from '@/lib/types';

/** 右栏「检索预览」：先看有没有标准问答命中，再算 BM25，让用户看到会被引用什么 */
export function usePreview(
  query: string,
  cards: SkillCard[],
  chunks: Chunk[],
  qas: QAEntry[],
  enabled: boolean
): PreviewHit[] {
  const index = useMemo(() => buildIndex(chunks), [chunks]);

  return useMemo(() => {
    const q = query.trim();
    if (!q || !enabled) return [];

    // 标准问答一旦命中，本轮会直接显示准备好的答案，不再走模型
    const qaHit = matchQA(q, qas);
    if (qaHit) {
      return [
        {
          type: 'qa' as const,
          label: `命中标准问答：${qaHit.entry.question}`,
          text: qaHit.entry.answer,
          score: qaHit.score,
        },
      ];
    }

    const a = analyzeQuestion(q);
    // 知识题、公司题、场景题不靠卡片作答，预览里也不要制造「会引用卡片」的错觉
    const wantCards = !['knowledge', 'scenario', 'company', 'reverse'].includes(a.kind);
    const hitCards = wantCards
      ? scoreCards(q, cards, a.kind === 'intro' ? 3 : 2).map((x) => ({
          type: 'card' as const,
          label: x.card.project,
          text: [x.card.background, x.card.actions[0]].filter(Boolean).join(' · '),
          score: Math.min(1, x.score / 3),
        }))
      : [];
    const hitChunks = search(q, chunks, index, a.kind === 'project' ? 4 : 3)
      .filter((x) => x.score > 0.8)
      .map((x) => ({
        type: 'chunk' as const,
        label: '知识库片段',
        text: snippet(x.chunk.text, x.terms, 90),
        score: Math.min(1, x.score / 6),
      }));
    return [...hitCards, ...hitChunks];
  }, [query, cards, chunks, qas, index, enabled]);
}
