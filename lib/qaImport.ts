/**
 * 标准问答批量导入的纯规划 + 删除辅助。
 *
 * 规划阶段先算出「要写什么、写完删什么、哪些问法会串题」，
 * 页面负责按「先写入、成功后再删除旧题」的顺序落库。
 * 这里不改 lib/db.ts，避免和数据库层并行改动冲突。
 */
import { openDB, type DBSchema } from 'idb';
import type { QAEntry } from './types';
import { normalizeKey, type ParsedQA } from './faqTemplate';

export interface QAImportConflict {
  key: string;
  /** 同一问法出现在哪几道题上 */
  owners: { question: string; variant: string }[];
}

export interface PlannedQA {
  /** 命中已有题目时复用它的 id，避免替换导入留下一段空窗 */
  existingId?: string;
  question: string;
  aliases: string[];
  answer: string;
  tags: string[];
  createdAt?: number;
}

export interface QAImportPlan {
  items: PlannedQA[];
  /** 只统计「本次导入造成」的重复问法；历史遗留的重复不阻塞导入 */
  conflicts: QAImportConflict[];
  created: number;
  updated: number;
  /** 替换模式下，写入成功后需要删除的旧题 id */
  removeIds: string[];
}

function variantKeys(question: string, aliases: string[]) {
  const seen = new Set<string>();
  const out: { variant: string; key: string }[] = [];
  for (const raw of [question, ...aliases]) {
    const variant = (raw ?? '').trim();
    const key = normalizeKey(variant);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ variant, key });
  }
  return out;
}

function addAlias(item: PlannedQA, raw: string) {
  const variant = (raw ?? '').trim();
  const key = normalizeKey(variant);
  if (!key) return;
  if (variant === item.question || key === normalizeKey(item.question)) return;
  if (item.aliases.some((a) => normalizeKey(a) === key)) return;
  item.aliases.push(variant);
}

export function planQAImport({
  profileId,
  parsed,
  existing,
  replace,
}: {
  profileId: string;
  parsed: ParsedQA[];
  existing: QAEntry[];
  replace: boolean;
}): QAImportPlan {
  const scoped = existing.filter((q) => q.profileId === profileId);
  const existingByQuestion = new Map<string, QAEntry>();
  for (const q of scoped) {
    const key = normalizeKey(q.question);
    if (key && !existingByQuestion.has(key)) existingByQuestion.set(key, q);
  }

  const items: PlannedQA[] = [];
  const itemByKey = new Map<string, PlannedQA>();
  const matchedIds = new Set<string>();

  for (const e of parsed) {
    const qKey = normalizeKey(e.question);
    if (!qKey) continue;
    const target = existingByQuestion.get(qKey);
    let item = itemByKey.get(qKey);

    if (!item) {
      if (target && !replace) {
        // 合并模式：沿用已有题目的 id / 同义问法 / 标签，只更新答案
        item = {
          existingId: target.id,
          question: target.question,
          aliases: [...target.aliases],
          answer: target.answer,
          tags: [...target.tags],
          createdAt: target.createdAt,
        };
        matchedIds.add(target.id);
      } else if (target) {
        // 替换模式：内容以本次导入为准，只复用 id 和创建时间
        item = {
          existingId: target.id,
          question: e.question,
          aliases: [],
          answer: e.answer,
          tags: [],
          createdAt: target.createdAt,
        };
        matchedIds.add(target.id);
      } else {
        item = { question: e.question, aliases: [], answer: e.answer, tags: [] };
      }
      items.push(item);
      itemByKey.set(qKey, item);
    }

    item.answer = e.answer;
    for (const alias of e.aliases) addAlias(item, alias);
  }

  // 问法 -> 归属题目。只有「本次导入参与」的冲突才阻止导入，
  // 否则旧题库里已有的重复问法会让任何一次导入都失败。
  const entityIndex = new Map<string, number>();
  const indexOf = (id: string) => {
    const hit = entityIndex.get(id);
    if (hit !== undefined) return hit;
    const next = entityIndex.size;
    entityIndex.set(id, next);
    return next;
  };
  const byKey = new Map<
    string,
    { idx: number; question: string; variant: string; imported: boolean }[]
  >();
  const addEntity = (id: string, question: string, aliases: string[], imported: boolean) => {
    const idx = indexOf(id);
    for (const v of variantKeys(question, aliases)) {
      const list = byKey.get(v.key) ?? [];
      if (list.some((x) => x.idx === idx)) continue;
      list.push({ idx, question, variant: v.variant, imported });
      byKey.set(v.key, list);
    }
  };

  for (const item of items) {
    addEntity(item.existingId ?? `new:${normalizeKey(item.question)}`, item.question, item.aliases, true);
  }
  if (!replace) {
    for (const q of scoped) {
      if (matchedIds.has(q.id)) continue;
      addEntity(q.id, q.question, q.aliases, false);
    }
  }

  const conflicts: QAImportConflict[] = [];
  for (const [key, list] of byKey) {
    if (!list.some((x) => x.imported)) continue;
    if (new Set(list.map((x) => x.idx)).size < 2) continue;
    conflicts.push({
      key,
      owners: list.map((x) => ({ question: x.question, variant: x.variant })),
    });
  }

  const removeIds = replace ? scoped.filter((q) => !matchedIds.has(q.id)).map((q) => q.id) : [];

  return {
    items,
    conflicts,
    created: items.filter((i) => !i.existingId).length,
    updated: items.filter((i) => !!i.existingId).length,
    removeIds,
  };
}

interface QaOnlyDB extends DBSchema {
  qa: { key: string; value: QAEntry };
}

/** 单事务删除多道题；失败时整批回滚，不会删一半。 */
export async function deleteQAsByIds(ids: string[]) {
  if (!ids.length) return;
  const db = await openDB<QaOnlyDB>('interview-copilot');
  const tx = db.transaction('qa', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
}
