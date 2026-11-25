import type { Chunk, SkillCard } from './types';

/* ---------- 切分：中文二元 + 英文词 ---------- */
const STOP = new Set([
  '的', '了', '是', '我', '你', '他', '她', '它', '们', '在', '有', '和', '就',
  '不', '也', '都', '这', '那', '个', '上', '下', '中', '为', '以', '与', '及',
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'is', 'are', 'and', 'or', 'for',
]);

export function tokenize(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();

  // 英文/数字词
  for (const w of lower.match(/[a-z][a-z0-9+#._-]{1,}/g) ?? []) {
    if (!STOP.has(w)) out.push(w);
  }
  // 中文二元切分（保留单字，长度 1 的段单独成 token）
  const cjk = lower.match(/[\u4e00-\u9fa5]+/g) ?? [];
  for (const seg of cjk) {
    if (seg.length === 1) {
      if (!STOP.has(seg)) out.push(seg);
      continue;
    }
    for (let i = 0; i < seg.length - 1; i++) {
      const bg = seg.slice(i, i + 2);
      if (!STOP.has(bg)) out.push(bg);
    }
  }
  return out;
}

/* ---------- 文档切块 ---------- */
export function splitIntoChunks(text: string, target = 420, overlap = 60): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];

  const paras = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const blocks: string[] = [];
  let buf = '';

  const push = () => {
    if (buf.trim()) blocks.push(buf.trim());
    buf = '';
  };

  for (const p of paras) {
    if (p.length > target * 1.6) {
      push();
      // 长段落按句号/分号硬切
      const sents = p.split(/(?<=[。！？!?；;\n])/).filter(Boolean);
      let sb = '';
      for (const s of sents) {
        if ((sb + s).length > target) {
          if (sb) blocks.push(sb.trim());
          sb = s;
        } else {
          sb += s;
        }
      }
      if (sb.trim()) blocks.push(sb.trim());
    } else if ((buf + '\n' + p).length > target) {
      push();
      buf = p;
    } else {
      buf = buf ? buf + '\n' + p : p;
    }
  }
  push();

  // 加一点重叠，避免切断上下文
  if (overlap > 0) {
    for (let i = 1; i < blocks.length; i++) {
      const tail = blocks[i - 1].slice(-overlap);
      blocks[i] = tail + ' ' + blocks[i];
    }
  }
  return blocks.filter((b) => b.length > 20);
}

/* ---------- BM25 ---------- */
export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  terms: string[];
}

export interface BM25Index {
  docCount: number;
  avgLen: number;
  df: Map<string, number>;
  lengths: Map<string, number>;
  postings: Map<string, Map<string, number>>; // term -> chunkId -> tf
}

const K1 = 1.3;
const B = 0.75;

export function buildIndex(chunks: Chunk[]): BM25Index {
  const df = new Map<string, number>();
  const lengths = new Map<string, number>();
  const postings = new Map<string, Map<string, number>>();
  let total = 0;

  for (const c of chunks) {
    const toks = c.tokens?.length ? c.tokens : tokenize(c.text);
    lengths.set(c.id, toks.length);
    total += toks.length;
    const seen = new Set<string>();
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let m = postings.get(t);
      if (!m) {
        m = new Map();
        postings.set(t, m);
      }
      m.set(c.id, n);
      if (!seen.has(t)) {
        seen.add(t);
        df.set(t, (df.get(t) ?? 0) + 1);
      }
    }
  }

  return {
    docCount: chunks.length,
    avgLen: chunks.length ? total / chunks.length : 1,
    df,
    lengths,
    postings,
  };
}

export function search(
  query: string,
  chunks: Chunk[],
  index: BM25Index,
  topK = 6
): ScoredChunk[] {
  const qTokens = Array.from(new Set(tokenize(query)));
  if (!qTokens.length || !chunks.length) return [];

  const byId = new Map(chunks.map((c) => [c.id, c]));
  const N = Math.max(index.docCount, 1);
  const scores = new Map<string, number>();
  const matched = new Map<string, Set<string>>();

  for (const t of qTokens) {
    const posting = index.postings.get(t);
    if (!posting) continue;
    const df = index.df.get(t) ?? 0;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    // 二元组权重略高于英文单词，避免英文术语压制中文段落
    const w = /[\u4e00-\u9fa5]/.test(t) ? 1.15 : 1;

    for (const [cid, tf] of posting) {
      const dl = index.lengths.get(cid) ?? 1;
      const denom = tf + K1 * (1 - B + (B * dl) / (index.avgLen || 1));
      const s = idf * ((tf * (K1 + 1)) / (denom || 1)) * w;
      scores.set(cid, (scores.get(cid) ?? 0) + s);
      let ms = matched.get(cid);
      if (!ms) {
        ms = new Set();
        matched.set(cid, ms);
      }
      ms.add(t);
    }
  }

  const ranked = [...scores.entries()]
    .map(([cid, score]) => ({ cid, score }))
    .sort((a, b) => b.score - a.score);

  // 同一文档最多取 2 段
  const perDoc = new Map<string, number>();
  const picked: ScoredChunk[] = [];
  for (const { cid, score } of ranked) {
    const c = byId.get(cid);
    if (!c) continue;
    const n = perDoc.get(c.docId) ?? 0;
    if (n >= 2) continue;
    perDoc.set(c.docId, n + 1);
    picked.push({ chunk: c, score, terms: [...(matched.get(cid) ?? [])] });
    if (picked.length >= topK) break;
  }
  return picked;
}

/* ---------- 技能卡打分（用于选卡） ---------- */
export function scoreCards(question: string, cards: SkillCard[], limit = 3) {
  const q = new Set(tokenize(question));
  if (!q.size) return [];
  const scored = cards.map((card) => {
    const hay = [
      card.project,
      card.role,
      card.background,
      ...card.actions,
      ...card.decisions,
      ...card.results,
      ...card.followups.map((f) => `${f.q} ${f.a}`),
    ].join('\n');
    const toks = tokenize(hay);
    let hit = 0;
    const seen = new Set<string>();
    for (const t of toks) {
      if (q.has(t) && !seen.has(t)) {
        seen.add(t);
        hit += 1;
      }
    }
    const density = hit / Math.max(8, Math.sqrt(toks.length));
    return { card, score: hit + density };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function snippet(text: string, terms: string[], len = 180) {
  if (!terms.length) return text.slice(0, len) + (text.length > len ? '…' : '');
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, len) + (text.length > len ? '…' : '');
  const start = Math.max(0, at - Math.floor(len / 3));
  const out = text.slice(start, start + len);
  return (start > 0 ? '…' : '') + out + (start + len < text.length ? '…' : '');
}
