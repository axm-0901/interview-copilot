/** 字符二元组，用来判断一段识别结果是不是在念已有的答稿 */
function bigrams(s: string): Set<string> {
  const t = (s ?? '').replace(/[\s\p{P}\p{S}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/**
 * 判定阈值。
 * 实测：朗读整段答稿 ≈ 1.00，面试官复述一整句 + 追问 ≈ 0.59，
 * 正常提问 ≈ 0.00~0.05。取 0.68 既能抓念稿，又不会把复述式追问误杀。
 */
export const ECHO_THRESHOLD = 0.68;

/**
 * 返回 0~1：识别结果有多少比例落在给定文本里。
 * 高于阈值基本可以判定「用户在朗读答稿」，此时不应该再触发答题。
 */
export function selfEchoRatio(spoken: string, reference: string): number {
  const ref = bigrams(reference);
  if (ref.size < 8) return 0;
  const said = bigrams(spoken);
  if (said.size < 8) return 0;
  let hit = 0;
  for (const g of said) if (ref.has(g)) hit += 1;
  return hit / said.size;
}
