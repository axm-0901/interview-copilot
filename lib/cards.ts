import type { SkillCard } from './types';
import { uid } from './db';

export function cardFingerprint(c: Omit<SkillCard, 'fingerprint'> | SkillCard): string {
  const payload = [
    c.project,
    c.period,
    c.role,
    c.background,
    ...(c.actions ?? []),
    ...(c.decisions ?? []),
    ...(c.results ?? []),
    ...(c.followups ?? []).map((f) => `${f.q}|${f.a}`),
    c.status,
  ].join('§');
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function emptyCard(profileId: string, project = ''): SkillCard {
  const base: SkillCard = {
    id: uid('card'),
    profileId,
    project,
    period: '',
    role: '',
    background: '',
    actions: [''],
    decisions: [''],
    results: [''],
    followups: [
      { q: '', a: '' },
      { q: '', a: '' },
      { q: '', a: '' },
    ],
    status: 'draft',
    updatedAt: Date.now(),
    fingerprint: '',
  };
  base.fingerprint = cardFingerprint(base);
  return base;
}

export function normalizeCard(c: SkillCard): SkillCard {
  const next: SkillCard = {
    ...c,
    actions: c.actions.filter((a) => a.trim()),
    decisions: c.decisions.filter((a) => a.trim()),
    results: c.results.filter((a) => a.trim()),
    followups: c.followups.filter((f) => f.q.trim() || f.a.trim()),
    updatedAt: Date.now(),
  };
  next.fingerprint = cardFingerprint(next);
  return next;
}

/** 卡片完整度评分，用于引导用户补齐字段 */
export function cardCompleteness(c: SkillCard) {
  const checks = [
    { key: '项目与角色', ok: Boolean(c.project && c.role) },
    { key: '背景一句话', ok: c.background.trim().length > 6 },
    { key: '我的具体动作', ok: c.actions.filter(Boolean).length >= 1 },
    { key: '关键决策与取舍', ok: c.decisions.filter(Boolean).length >= 1 },
    { key: '可量化结果', ok: c.results.filter(Boolean).length >= 1 && /\d/.test(c.results.join('')) },
    { key: '追问准备 ≥ 2 条', ok: c.followups.filter((f) => f.q.trim() && f.a.trim()).length >= 2 },
  ];
  const done = checks.filter((x) => x.ok).length;
  return { checks, pct: Math.round((done / checks.length) * 100) };
}

export function cardToMarkdown(c: SkillCard) {
  return `## ${c.project}${c.period ? `（${c.period}）` : ''}
- 我的角色：${c.role || '—'}
- 状态：${c.status === 'confirmed' ? '已确认' : '草稿'}

**背景**：${c.background || '—'}

**我的具体动作**
${c.actions.filter(Boolean).map((a) => `- ${a}`).join('\n') || '- —'}

**关键决策与取舍**
${c.decisions.filter(Boolean).map((a) => `- ${a}`).join('\n') || '- —'}

**可量化结果**
${c.results.filter(Boolean).map((a) => `- ${a}`).join('\n') || '- —'}

**可能的追问**
${c.followups.filter((f) => f.q || f.a).map((f) => `- ${f.q || '—'}\n  - ${f.a || '—'}`).join('\n') || '- —'}
`;
}
