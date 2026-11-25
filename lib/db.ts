import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type {
  Chunk,
  Doc,
  Profile,
  QAEntry,
  Review,
  Session,
  SkillCard,
  Snapshot,
  Turn,
} from './types';

export const uid = (p = 'id') =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

interface BenchDB extends DBSchema {
  profile: { key: string; value: Profile; indexes: { createdAt: number } };
  doc: { key: string; value: Doc; indexes: { profileId: string } };
  chunk: { key: string; value: Chunk; indexes: { docId: string; profileId: string } };
  card: { key: string; value: SkillCard; indexes: { profileId: string } };
  qa: { key: string; value: QAEntry; indexes: { profileId: string } };
  snapshot: { key: string; value: Snapshot; indexes: { profileId: string } };
  session: { key: string; value: Session; indexes: { profileId: string; startedAt: number } };
  turn: { key: string; value: Turn; indexes: { sessionId: string } };
  review: { key: string; value: Review; indexes: { sessionId: string; turnId: string } };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<BenchDB>> | null = null;

function getDB() {
  if (typeof window === 'undefined') throw new Error('IndexedDB 仅在浏览器可用');
  if (!dbp) {
    dbp = openDB<BenchDB>('interview-copilot', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const p = db.createObjectStore('profile', { keyPath: 'id' });
          p.createIndex('createdAt', 'createdAt');

          const d = db.createObjectStore('doc', { keyPath: 'id' });
          d.createIndex('profileId', 'profileId');

          const c = db.createObjectStore('chunk', { keyPath: 'id' });
          c.createIndex('docId', 'docId');
          c.createIndex('profileId', 'profileId');

          const k = db.createObjectStore('card', { keyPath: 'id' });
          k.createIndex('profileId', 'profileId');

          const s = db.createObjectStore('snapshot', { keyPath: 'id' });
          s.createIndex('profileId', 'profileId');

          const se = db.createObjectStore('session', { keyPath: 'id' });
          se.createIndex('profileId', 'profileId');
          se.createIndex('startedAt', 'startedAt');

          const t = db.createObjectStore('turn', { keyPath: 'id' });
          t.createIndex('sessionId', 'sessionId');

          const r = db.createObjectStore('review', { keyPath: 'id' });
          r.createIndex('sessionId', 'sessionId');
          r.createIndex('turnId', 'turnId');

          db.createObjectStore('kv');
        }

        // v2：标准问答
        if (!db.objectStoreNames.contains('qa')) {
          const q = db.createObjectStore('qa', { keyPath: 'id' });
          q.createIndex('profileId', 'profileId');
        }
      },
    });
  }
  return dbp;
}

/* ---------------- profiles ---------------- */
export async function listProfiles(): Promise<Profile[]> {
  const db = await getDB();
  const all = await db.getAll('profile');
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putProfile(p: Profile) {
  const db = await getDB();
  await db.put('profile', p);
}

export async function deleteProfileCascade(profileId: string) {
  const db = await getDB();
  const tx = db.transaction(
    ['profile', 'doc', 'chunk', 'card', 'qa', 'snapshot', 'session', 'turn', 'review', 'kv'],
    'readwrite'
  );
  await tx.objectStore('profile').delete(profileId);
  const docs = await tx.objectStore('doc').index('profileId').getAll(profileId);
  for (const d of docs) {
    const chunks = await tx.objectStore('chunk').index('docId').getAll(d.id);
    for (const c of chunks) await tx.objectStore('chunk').delete(c.id);
    await tx.objectStore('doc').delete(d.id);
  }
  const cards = await tx.objectStore('card').index('profileId').getAll(profileId);
  for (const c of cards) await tx.objectStore('card').delete(c.id);
  const qas = await tx.objectStore('qa').index('profileId').getAll(profileId);
  for (const q of qas) await tx.objectStore('qa').delete(q.id);
  const snaps = await tx.objectStore('snapshot').index('profileId').getAll(profileId);
  for (const s of snaps) await tx.objectStore('snapshot').delete(s.id);
  const sessions = await tx.objectStore('session').index('profileId').getAll(profileId);
  for (const s of sessions) {
    const turns = await tx.objectStore('turn').index('sessionId').getAll(s.id);
    const reviews = await tx.objectStore('review').index('sessionId').getAll(s.id);
    for (const r of reviews) await tx.objectStore('review').delete(r.id);
    for (const t of turns) await tx.objectStore('turn').delete(t.id);
    await tx.objectStore('kv').delete(`reviewSummary:${s.id}`);
    await tx.objectStore('session').delete(s.id);
  }
  await tx.objectStore('kv').delete(`insight:${profileId}`);
  await tx.objectStore('kv').delete(`research:${profileId}`);
  await tx.done;
}

/* ---------------- docs & chunks ---------------- */
export async function listDocs(profileId: string): Promise<Doc[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('doc', 'profileId', profileId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putDoc(d: Doc) {
  const db = await getDB();
  await db.put('doc', d);
}

export async function putChunks(chunks: Chunk[]) {
  const db = await getDB();
  const tx = db.transaction('chunk', 'readwrite');
  await Promise.all(chunks.map((c) => tx.store.put(c)));
  await tx.done;
}

/** 文档与其索引片段在同一个事务里落库：要么都成功，要么都不写。 */
export async function putDocWithChunks(doc: Doc, chunks: Chunk[]) {
  const db = await getDB();
  const tx = db.transaction(['doc', 'chunk'], 'readwrite');
  await tx.objectStore('doc').put(doc);
  for (const c of chunks) await tx.objectStore('chunk').put(c);
  await tx.done;
}

/**
 * 原子替换某份文档的全部片段：事务失败时回滚，旧索引保持不变。
 */
export async function replaceChunksOfDoc(docId: string, chunks: Chunk[]) {
  const db = await getDB();
  const tx = db.transaction('chunk', 'readwrite');
  const store = tx.objectStore('chunk');
  const old = await store.index('docId').getAll(docId);
  for (const c of old) await store.delete(c.id);
  for (const c of chunks) await store.put(c);
  await tx.done;
}

export async function chunksOfDoc(docId: string): Promise<Chunk[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('chunk', 'docId', docId);
  return all.sort((a, b) => a.idx - b.idx);
}

export async function listChunks(profileId: string): Promise<Chunk[]> {
  const db = await getDB();
  return db.getAllFromIndex('chunk', 'profileId', profileId);
}

export async function deleteDocCascade(docId: string) {  const db = await getDB();
  const tx = db.transaction(['doc', 'chunk'], 'readwrite');
  const chunks = await tx.objectStore('chunk').index('docId').getAll(docId);
  for (const c of chunks) await tx.objectStore('chunk').delete(c.id);
  await tx.objectStore('doc').delete(docId);
  await tx.done;
}

export async function deleteChunksOfDoc(docId: string) {
  const db = await getDB();
  const tx = db.transaction('chunk', 'readwrite');
  const chunks = await tx.store.index('docId').getAll(docId);
  for (const c of chunks) await tx.store.delete(c.id);
  await tx.done;
}

/* ---------------- cards ---------------- */
export async function listCards(profileId: string): Promise<SkillCard[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('card', 'profileId', profileId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putCard(c: SkillCard) {
  const db = await getDB();
  await db.put('card', c);
}

export async function deleteCard(id: string) {
  const db = await getDB();
  await db.delete('card', id);
}

export async function getCardsByIds(ids: string[]): Promise<SkillCard[]> {
  const db = await getDB();
  const out: SkillCard[] = [];
  for (const id of ids) {
    const c = await db.get('card', id);
    if (c) out.push(c);
  }
  return out;
}

/* ---------------- 标准问答 ---------------- */
export async function listQAs(profileId: string): Promise<QAEntry[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('qa', 'profileId', profileId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putQA(qa: QAEntry) {
  const db = await getDB();
  await db.put('qa', qa);
}

export async function deleteQA(id: string) {
  const db = await getDB();
  await db.delete('qa', id);
}

export async function putQAs(qas: QAEntry[]) {
  if (!qas.length) return;
  const db = await getDB();
  const tx = db.transaction('qa', 'readwrite');
  await Promise.all(qas.map((q) => tx.store.put(q)));
  await tx.done;
}

export async function deleteQAsOfProfile(profileId: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex('qa', 'profileId', profileId);
  if (!all.length) return;
  const tx = db.transaction('qa', 'readwrite');
  await Promise.all(all.map((q) => tx.store.delete(q.id)));
  await tx.done;
}

export async function getQAsByIds(ids: string[]): Promise<QAEntry[]> {
  const db = await getDB();
  const out: QAEntry[] = [];
  for (const id of ids) {
    const q = await db.get('qa', id);
    if (q) out.push(q);
  }
  return out;
}

/* ---------------- snapshots ---------------- */
export async function putSnapshot(s: Snapshot) {
  const db = await getDB();
  await db.put('snapshot', s);
}

export async function getSnapshot(id: string) {
  const db = await getDB();
  return db.get('snapshot', id);
}

export async function listSnapshots(profileId: string): Promise<Snapshot[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('snapshot', 'profileId', profileId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/* ---------------- sessions / turns / reviews ---------------- */
export async function listSessions(profileId?: string): Promise<Session[]> {
  const db = await getDB();
  const all = profileId
    ? await db.getAllFromIndex('session', 'profileId', profileId)
    : await db.getAll('session');
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

export async function putSession(s: Session) {
  const db = await getDB();
  await db.put('session', s);
}

export async function deleteSessionCascade(sessionId: string) {
  const db = await getDB();
  const tx = db.transaction(['session', 'turn', 'review'], 'readwrite');
  const turns = await tx.objectStore('turn').index('sessionId').getAll(sessionId);
  for (const t of turns) await tx.objectStore('turn').delete(t.id);
  const rs = await tx.objectStore('review').index('sessionId').getAll(sessionId);
  for (const r of rs) await tx.objectStore('review').delete(r.id);
  await tx.objectStore('session').delete(sessionId);
  await tx.done;
}

export async function listTurns(sessionId: string): Promise<Turn[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('turn', 'sessionId', sessionId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putTurn(t: Turn) {
  const db = await getDB();
  await db.put('turn', t);
}

export async function listReviews(sessionId: string): Promise<Review[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('review', 'sessionId', sessionId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putReviews(rs: Review[]) {
  const db = await getDB();
  const tx = db.transaction('review', 'readwrite');
  await Promise.all(rs.map((r) => tx.store.put(r)));
  await tx.done;
}

/* ---------------- kv ---------------- */
export async function kvSet(key: string, value: unknown) {
  const db = await getDB();
  await db.put('kv', value, key);
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('kv', key)) as T | undefined;
}

export async function exportAll() {
  const db = await getDB();
  const tx = db.transaction(
    ['profile', 'doc', 'chunk', 'card', 'qa', 'snapshot', 'session', 'turn', 'review', 'kv'],
    'readonly'
  );
  const [profile, doc, chunk, card, qa, snapshot, session, turn, review, kvKeys, kvValues] =
    await Promise.all([
      tx.objectStore('profile').getAll(),
      tx.objectStore('doc').getAll(),
      tx.objectStore('chunk').getAll(),
      tx.objectStore('card').getAll(),
      tx.objectStore('qa').getAll(),
      tx.objectStore('snapshot').getAll(),
      tx.objectStore('session').getAll(),
      tx.objectStore('turn').getAll(),
      tx.objectStore('review').getAll(),
      tx.objectStore('kv').getAllKeys(),
      tx.objectStore('kv').getAll(),
    ]);
  await tx.done;
  const kv = kvKeys.map((key, i) => ({ key, value: kvValues[i] }));
  return {
    profile,
    doc,
    chunk,
    card,
    qa,
    snapshot,
    session,
    turn,
    review,
    kv,
    exportedAt: Date.now(),
  };
}
