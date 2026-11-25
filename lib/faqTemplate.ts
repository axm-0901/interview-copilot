/**
 * 标准问答批量导入：解析 Markdown 模板。
 *
 * 兼容两种写法：
 * 1) FuOffer 模板：用 `---` 分隔，每题写 `问：` / `同义：` / `答：`
 * 2) GPT 常见输出：`### 1. 题目` + `同义：` + `答：`（或题目后直接跟答案）
 *
 * 代码块（```）里的内容会忽略，避免把模板示例当成题目导入。
 */

export interface ParsedQA {
  question: string;
  aliases: string[];
  answer: string;
}

export interface ParseResult {
  entries: ParsedQA[];
  errors: string[];
}

const Q_RE = /^\s*\*{0,2}(?:问|问题|题目|Q)\*{0,2}\s*[:：]\s*(.*)$/i;
const A_RE = /^\s*\*{0,2}(?:答|答案|A)\*{0,2}\s*[:：]\s*(.*)$/i;
const ALIAS_RE = /^\s*\*{0,2}(?:同义|同义问法|别名|相似问法)\*{0,2}\s*[:：]\s*(.*)$/i;
const H_RE = /^\s*#{1,6}\s+(.+?)\s*$/;

function cleanLabel(s: string) {
  return s.replace(/^\s*\*+|\*+\s*$/g, '').trim();
}

function splitAliases(raw: string) {
  return raw
    .split(/[;；]/)
    .map((x) => cleanLabel(x))
    .filter(Boolean);
}

export function parseFaqMarkdown(text: string): ParseResult {
  const errors: string[] = [];
  const entries: ParsedQA[] = [];
  if (!text || !text.trim()) return { entries, errors };

  const body = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    // 去掉围栏代码块（模板里的示例）
    .replace(/```[\s\S]*?```/g, '');

  // 按单独一行的 --- 切分
  const chunks = body.split(/^\s*---\s*$/m);

  chunks.forEach((chunk, idx) => {
    const lines = chunk.split('\n');
    let question = '';
    let answerStart = -1;
    let hasAnswerLabel = false;
    let hasAliasLabel = false;
    const aliases: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qm = line.match(Q_RE);
      if (qm && !question) {
        question = cleanLabel(qm[1] || '');
        continue;
      }
      const am = line.match(A_RE);
      if (am && answerStart < 0) {
        answerStart = i;
        hasAnswerLabel = true;
        // 答：后面的同一行文字也算答案
        const inline = cleanLabel(am[1] || '');
        if (inline) lines[i] = inline;
        else lines[i] = '';
        continue;
      }
      const al = line.match(ALIAS_RE);
      if (al) {
        hasAliasLabel = true;
        aliases.push(...splitAliases(al[1] || ''));
      }
    }

    // 没有「问：」时，兼容 ### 标题 + 答案。
    // 只认最后一个标题，避免把文档大标题「# 面试题」当成第一题。
    if (!question) {
      if (!hasAnswerLabel && !hasAliasLabel) return; // 模板头部 / 说明文字
      const limit = answerStart >= 0 ? answerStart : lines.length;
      let hi = -1;
      for (let i = 0; i < limit; i++) if (H_RE.test(lines[i])) hi = i;
      if (hi >= 0) {
        question = cleanLabel(lines[hi].match(H_RE)?.[1] || '');
        if (answerStart < 0) answerStart = hi + 1;
      }
    }

    if (!question) return; // 模板头部、空白段，直接跳过
    question = question.replace(/^\d+\s*[.、)）]\s*/, '').trim();

    let answer = '';
    if (answerStart >= 0) {
      answer = lines
        .slice(answerStart)
        .filter((l) => !ALIAS_RE.test(l) && !Q_RE.test(l))
        .join('\n')
        .trim();
    } else {
      // 没写「答：」：取标题/题目之后、非同义行作为答案
      const start = lines.findIndex((l) => Q_RE.test(l) || H_RE.test(l));
      answer = lines
        .slice(start + 1)
        .filter((l) => !ALIAS_RE.test(l))
        .join('\n')
        .trim();
    }

    answer = answer.replace(/\n{3,}/g, '\n\n').trim();
    if (!answer) {
      errors.push(`第 ${idx + 1} 段「${question.slice(0, 24)}」缺少答案，已跳过`);
      return;
    }

    const uniq = [...new Set(aliases)].filter((a) => a !== question);
    entries.push({ question, aliases: uniq, answer });
  });

  // 同一文件里重复题目：合并同义问法，保留最后一份答案
  const merged = new Map<string, ParsedQA>();
  for (const e of entries) {
    const key = normalizeKey(e.question);
    const prev = merged.get(key);
    if (prev) {
      prev.aliases = [...new Set([...prev.aliases, ...e.aliases])];
      prev.answer = e.answer;
    } else {
      merged.set(key, { ...e });
    }
  }

  return { entries: [...merged.values()], errors };
}

export function normalizeKey(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}
