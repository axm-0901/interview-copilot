import { scoreCards, search, type BM25Index } from './retrieval';
import type { AnswerBasis, AnswerMode, Chunk, Doc, SkillCard } from './types';
import type { QuestionAnalysis } from './playbook';

export interface MaterialHit {
  id: string;
  docId: string;
  label: string;
  text: string;
  score: number;
}

export interface AnswerPlan {
  cards: SkillCard[];
  hits: MaterialHit[];
  resumeBrief: string;
  jdBrief: string;
  basis: AnswerBasis;
  /** 题目需要个人材料，但一条都没找到 */
  degraded: boolean;
}

interface PlanArgs {
  question: string;
  analysis: QuestionAnalysis;
  mode: AnswerMode;
  /** 实时极速模式：少塞材料、少塞长文，首字更快 */
  fast?: boolean;
  cards: SkillCard[];
  chunks: Chunk[];
  index: BM25Index;
  docs: Doc[];
  docName: (docId: string) => string;
}

const CARD_LIMIT: Partial<Record<QuestionAnalysis['kind'], number>> = {
  intro: 4,
  project: 3,
  match: 3,
  behavior: 2,
  pressure: 2,
  motivation: 2,
  role: 1,
};

const HIT_LIMIT: Partial<Record<QuestionAnalysis['kind'], number>> = {
  intro: 0,
  project: 4,
  match: 3,
  role: 3,
  company: 3,
  behavior: 2,
  pressure: 2,
  motivation: 2,
  knowledge: 2,
  scenario: 2,
  reverse: 2,
  general: 1,
};

const RESUME_LEN: Partial<Record<QuestionAnalysis['kind'], number>> = {
  intro: 1000,
  project: 900,
  match: 800,
  behavior: 700,
  pressure: 500,
  motivation: 600,
  role: 500,
  reverse: 300,
  general: 300,
};

const JD_LEN: Partial<Record<QuestionAnalysis['kind'], number>> = {
  match: 600,
  role: 800,
  company: 700,
  motivation: 500,
  salary: 600,
  scenario: 500,
  reverse: 500,
  general: 300,
};

function docBrief(docs: Doc[], chunks: Chunk[], type: Doc['type'], max: number) {
  if (max <= 0) return '';
  const d = docs.find((x) => x.type === type);
  if (!d) return '';
  const raw = (d.raw ?? '').replace(/[ \t]+/g, ' ').trim();
  if (raw) return raw.slice(0, max).trim();
  return chunks
    .filter((c) => c.docId === d.id)
    .map((c) => c.text)
    .join('\n')
    .slice(0, max)
    .trim();
}

function pickFrom<T>(list: T[], limit: number, key: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of list) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 按题型选材。
 *
 * 核心变化：不再「有卡就塞卡」。
 * - 公司/知识/场景题不塞技能卡，让模型用自己的判断回答
 * - 自我介绍一定带简历和全部卡片，否则会退化成空话
 * - 项目/行为/匹配题才用卡片做事实锚点
 */
export function planAnswer(a: PlanArgs): AnswerPlan {
  const { analysis, mode } = a;
  const generalMode = mode === 'general';
  const materialMode = mode === 'material';

  const fast = Boolean(a.fast);
  let cardLimit = generalMode
    ? 0
    : Math.max(
        materialMode ? 3 : 0,
        CARD_LIMIT[analysis.kind] ?? (materialMode ? 3 : 0)
      );
  if (fast) cardLimit = Math.min(cardLimit, 2);

  let cards: SkillCard[] = [];
  if (cardLimit > 0) {
    const ranked = scoreCards(a.question, a.cards, cardLimit).map((x) => x.card);
    cards = pickFrom([...ranked, ...a.cards], cardLimit, (c) => c.id);
  }

  let hitLimit = generalMode
    ? 0
    : materialMode
    ? 4
    : analysis.kind === 'knowledge'
    ? analysis.needsMaterial
      ? 1
      : 0
    : HIT_LIMIT[analysis.kind] ?? 0;
  if (fast) hitLimit = Math.min(hitLimit, 2);

  // 不同题型只允许特定来源的片段，避免知识题/公司题被简历段落带偏
  const docType = new Map(a.docs.map((d) => [d.id, d.type]));
  const personalKind = ['intro', 'project', 'match', 'behavior', 'pressure', 'motivation'].includes(
    analysis.kind
  );
  const allowHit = (docId: string) => {
    const t = docType.get(docId);
    if (!t) return false;
    if (analysis.kind === 'knowledge') return analysis.needsMaterial && t === 'resume';
    if (analysis.kind === 'general') return t === 'note';
    if (!personalKind) return t === 'jd' || t === 'note';
    return true;
  };

  const hits =
    hitLimit > 0
      ? pickFrom(
          search(a.question, a.chunks, a.index, hitLimit * 3)
            .filter((h) => h.score > 0.8 && allowHit(h.chunk.docId))
            .map((h) => ({
              id: h.chunk.id,
              docId: h.chunk.docId,
              label: a.docName(h.chunk.docId),
              text: h.chunk.text,
              score: Math.round(h.score * 100) / 100,
            })),
          hitLimit,
          (h) => h.id
        )
      : [];

  const resumeLen = fast
    ? Math.min(RESUME_LEN[analysis.kind] ?? (analysis.needsMaterial ? 400 : 0), 520)
    : RESUME_LEN[analysis.kind] ?? (analysis.needsMaterial ? 400 : 0);
  const resumeBrief = generalMode
    ? ''
    : docBrief(a.docs, a.chunks, 'resume', resumeLen);
  const jdBrief = generalMode
    ? ''
    : docBrief(a.docs, a.chunks, 'jd', fast ? Math.min(JD_LEN[analysis.kind] ?? 0, 420) : JD_LEN[analysis.kind] ?? 0);

  const hasPersonal = cards.length > 0 || resumeBrief.length > 0;
  const basis: AnswerBasis = hasPersonal
    ? analysis.needsCompany ||
      analysis.kind === 'company' ||
      analysis.kind === 'knowledge' ||
      analysis.kind === 'scenario' ||
      analysis.kind === 'general'
      ? 'mixed'
      : 'personal'
    : 'general';

  return {
    cards,
    hits,
    resumeBrief,
    jdBrief,
    basis,
    degraded:
      analysis.needsMaterial &&
      !generalMode &&
      cards.length === 0 &&
      resumeBrief.length === 0 &&
      hits.length === 0,
  };
}

/**
 * 兜底清洗：旧提示词会往答案里塞「⚠️ 这题在测…」「（未使用你的个人材料…）」。
 * 新提示词已经禁止，但历史数据和模型偶发输出都要在落库/朗读前清掉。
 */
export function spokenText(md: string) {
  return (md ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith('⚠️')) return false;
      if (/^[（(]未使用你的个人材料/.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 复制 / 朗读用：去掉 Markdown 记号，避免把「星号」念出来 */
export function readableText(md: string) {
  return spokenText(md)
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,4}\s+/gm, '')
    .trim();
}
