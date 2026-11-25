import { chatStream, collect, extractJson } from './llm';
import { buildExtractMessages } from './prompts';
import type { AppSettings, SkillCard } from './types';

const clamp = (s: string, n: number) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim().replace(/^[，,。.、]/, '');
  return t.length <= n ? t : t.slice(0, n - 1) + '…';
};

const sentences = (text: string) =>
  text
    .replace(/[#*`>]/g, ' ')
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((s) => s.replace(/^[-·\s]+/, '').trim())
    .filter((s) => s.length > 6);

export interface Extracted {
  actions: string[];
  decisions: string[];
  results: string[];
  followups: { q: string; a: string }[];
}

/** 本地启发式抽取：没有 Key 时的降级路径，只做归类，不改写 */
export function heuristicExtract(
  card: Partial<SkillCard>,
  history: { role: 'user' | 'assistant'; content: string }[]
): Extracted {
  const answers = history.filter((h) => h.role === 'user').map((h) => h.content);
  const all = answers.join('\n');
  const sents = sentences(all);

  const decisions: string[] = [];
  const results: string[] = [];
  const actions: string[] = [];

  for (const s of sents) {
    if (/因为|取舍|权衡|放弃|最终选|没选|妥协|牺牲/.test(s)) decisions.push(clamp(s, 50));
    else if (/\d+\s*(%|倍|ms|s|万|条|笔|个|天|小时|QPS|TPS)/i.test(s) || /提升|降到|缩短|下降|增长/.test(s))
      results.push(clamp(s, 40));
    else actions.push(clamp(s, 45));
  }

  // 追问对：把每个 assistant 问题与它后面那条用户回答配对
  const followups: { q: string; a: string }[] = [];
  for (let i = 0; i < history.length; i++) {
    if (history[i].role !== 'assistant') continue;
    const ans = history.slice(i + 1).find((h) => h.role === 'user');
    const q = history[i].content.replace(/^问[:：]\s*/, '').split('\n')[0].trim();
    if (!q) continue;
    followups.push({ q: clamp(q, 40), a: clamp(ans?.content ?? '', 40) });
    if (followups.length >= 3) break;
  }

  const dedupe = (arr: string[], n: number) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of arr) {
      const k = x.slice(0, 10);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };

  return {
    actions: dedupe(actions, 3),
    decisions: dedupe(decisions, 2),
    results: dedupe(results, 2),
    followups: followups.filter((f) => f.q),
  };
}

export async function extractFields(
  card: Partial<SkillCard>,
  history: { role: 'user' | 'assistant'; content: string }[],
  settings: AppSettings
): Promise<{ data: Extracted; local: boolean }> {
  const fallback = heuristicExtract(card, history);
  if (!settings.apiKey.trim()) return { data: fallback, local: true };

  try {
    const raw = await collect(
      chatStream({
        settings,
        temperature: 0.2,
        messages: buildExtractMessages(card, history),
      })
    );
    const parsed = extractJson<Extracted>(raw);
    if (!parsed) return { data: fallback, local: true };
    return {
      data: {
        actions: (parsed.actions ?? []).filter(Boolean).slice(0, 4),
        decisions: (parsed.decisions ?? []).filter(Boolean).slice(0, 3),
        results: (parsed.results ?? []).filter(Boolean).slice(0, 3),
        followups: (parsed.followups ?? []).filter((f) => f?.q).slice(0, 3),
      },
      local: false,
    };
  } catch {
    return { data: fallback, local: true };
  }
}
