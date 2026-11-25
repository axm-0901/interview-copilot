import type { QAEntry } from './types';

/**
 * 标准问答匹配（v2）
 *
 * 目标不是「越像越好」，而是「只命中同一道题」。
 * v1 用内容词 F1，遇到「工作岗位调剂 / 工作地点调剂」这种只差一个
 * 限定词的题，会因为共享「工作 / 调剂」而互相串答案。
 *
 * v2 的做法：
 * 1. 先做同义词归一（工资→薪资、优势→优点、工作地点→地点），让换说法能对上；
 * 2. 中文同时看「单字 + 二元词」，字级覆盖负责召回，二元词负责区分语序；
 * 3. 用整个题库的动态 IDF 给词加权：在两道题里都出现的「工作 / 调剂」权重低，
 *    只在一道题里出现的「岗位 / 地点」权重高；
 * 4. 以「问法被覆盖了多少」为主、以「问题里有多少废话」为辅打分；
 * 5. 最高分和第二名（不同题）太接近时直接放弃，宁可让模型现场答，也不贴错答案。
 */

/* ------------------------------------------------------------------ */
/* 归一化                                                              */
/* ------------------------------------------------------------------ */

/** 归一化前先做的同义替换。只替换真正等价的词，不做模糊联想。 */
const SYNONYMS: [string, string][] = [
  ['为什么想加入', '为什么选择'],
  ['为什么想来', '为什么选择'],
  ['为什么想进', '为什么选择'],
  ['为什么考虑', '为什么选择'],
  ['为啥想', '为什么选择'],
  ['为什么来', '为什么选择'],
  ['为什么投递', '为什么选择'],
  ['为什么投', '为什么选择'],
  ['为啥', '为什么'],
  ['最有成就感', '最大的成就'],
  ['最自豪', '最大的成就'],
  ['最满意', '最大的成就'],
  ['成就感', '成就'],
  ['工资', '薪资'],
  ['薪酬', '薪资'],
  ['待遇', '薪资'],
  ['优势', '优点'],
  ['长处', '优点'],
  ['强项', '优点'],
  ['不足', '缺点'],
  ['劣势', '缺点'],
  ['短板', '缺点'],
  ['待改进', '缺点'],
  ['企业', '公司'],
  ['单位', '公司'],
  ['我们公司', '公司'],
  ['贵公司', '公司'],
  ['你们公司', '公司'],
  ['工作地点', '地点'],
  ['工作岗位', '岗位'],
  ['离开上一家', '离职'],
  ['辞职', '离职'],
  ['工作地', '地点'],
  ['城市', '地点'],
  ['base地', '地点'],
];

/** 问句框架 / 口播 filler：这些词出现不代表题目内容，先整段删掉。 */
const STOP_PHRASES = [
  '面试官问',
  '面试官',
  '我想问一下',
  '我想问',
  '想问一下',
  '想问下',
  '请问一下',
  '请问',
  '可不可以',
  '能不能',
  '是否可以',
  '能否',
  '是否',
  '可以',
  '方便',
  '简单',
  '大概',
  '一下',
  '的话',
  '这边',
  '那个',
  '这个',
  '一个',
  '就是说',
  '就是',
  '然后',
  '其实',
  '咱们',
  '咱',
  '老师',
  '同学',
  '身上',
  '嗯',
  '呃',
  '额',
  '喂',
  '好的',
  '对对对',
  '请',
  '吗',
  '呢',
  '吧',
  '啊',
  '呀',
].sort((a, b) => b.length - a.length);

/**
 * 单字停用表：只放真正的功能词。
 * 不要把「解 / 事 / 问 / 做 / 为 / 知 / 道」这类实词放进来，
 * 否则「了解公司」会被删成「公司」，「自我介绍」会被删成「自介绍」。
 */
const STOP_CHARS = new Set(
  [
    '的', '了', '是', '吗', '呢', '吧', '啊', '呀', '你', '您', '我', '他', '她', '它',
    '们', '在', '和', '跟', '与', '或', '也', '都', '就', '还', '很', '更', '最', '能',
    '会', '要', '应', '该', '如', '果', '怎', '么', '样', '何', '什', '哪', '个', '些',
    '这', '那', '下', '时', '候',
  ].map((c) => `c:${c}`)
);

function normalize(s: string) {
  return (s ?? '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 去掉问句框架 + 同义替换后的「题目骨架」 */
function clean(s: string) {
  let t = normalize(s);
  for (const [a, b] of SYNONYMS) t = t.split(a).join(b);
  for (const p of STOP_PHRASES) t = t.split(p).join('');
  return t;
}

function hasNegation(s: string) {
  return /[不没别]/.test(s);
}

/* ------------------------------------------------------------------ */
/* 分词：单字 + 二元词                                                  */
/* ------------------------------------------------------------------ */

interface Tokens {
  chars: Set<string>;
  grams: Set<string>;
}

function tokensOf(text: string): Tokens {
  const t = clean(text);
  const chars = new Set<string>();
  const grams = new Set<string>();

  // 英文/数字整词保留
  for (const w of t.match(/[a-z][a-z0-9+#._-]+/g) ?? []) {
    chars.add(`w:${w}`);
    grams.add(`w:${w}`);
  }

  for (const seg of t.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (const ch of seg) {
      const key = `c:${ch}`;
      if (!STOP_CHARS.has(key)) chars.add(key);
    }
    for (let i = 0; i < seg.length - 1; i++) {
      const bg = seg.slice(i, i + 2);
      // 含停用字的二元词没有区分度，直接丢弃
      if ([...bg].some((ch) => STOP_CHARS.has(`c:${ch}`))) continue;
      grams.add(`g:${bg}`);
    }
  }

  return { chars, grams };
}

function weight(set: Set<string>, idf: Map<string, number>) {
  let sum = 0;
  for (const t of set) sum += idf.get(t) ?? 1;
  return sum;
}

function sharedWeight(a: Set<string>, b: Set<string>, idf: Map<string, number>) {
  let sum = 0;
  for (const t of a) if (b.has(t)) sum += idf.get(t) ?? 1;
  return sum;
}

/* ------------------------------------------------------------------ */
/* 题库统计                                                            */
/* ------------------------------------------------------------------ */

interface Doc {
  entry: QAEntry;
  variant: string;
  normalized: string;
  tokens: Tokens;
}

interface Stats {
  docs: Doc[];
  idfChars: Map<string, number>;
  idfGrams: Map<string, number>;
}

function idfValue(df: number, n: number) {
  return Math.log((n + 1) / (df + 0.5)) + 1;
}

function buildStats(entries: QAEntry[]): Stats {
  const docs: Doc[] = [];
  for (const entry of entries) {
    const variants = [entry.question, ...(entry.aliases ?? [])].filter((v) => v && v.trim());
    for (const variant of variants) {
      const normalized = clean(variant);
      if (!normalized) continue;
      docs.push({ entry, variant, normalized, tokens: tokensOf(variant) });
    }
  }

  // IDF 按「题」统计，不按「问法」统计：
  // 一道题写 10 条同义问法，不应该把「岗位」的权重稀释掉。
  const perEntry = new Map<string, { chars: Set<string>; grams: Set<string> }>();
  for (const d of docs) {
    let bag = perEntry.get(d.entry.id);
    if (!bag) {
      bag = { chars: new Set(), grams: new Set() };
      perEntry.set(d.entry.id, bag);
    }
    for (const t of d.tokens.chars) bag.chars.add(t);
    for (const t of d.tokens.grams) bag.grams.add(t);
  }
  const dfChars = new Map<string, number>();
  const dfGrams = new Map<string, number>();
  for (const bag of perEntry.values()) {
    for (const t of bag.chars) dfChars.set(t, (dfChars.get(t) ?? 0) + 1);
    for (const t of bag.grams) dfGrams.set(t, (dfGrams.get(t) ?? 0) + 1);
  }

  const n = Math.max(1, perEntry.size);
  const idfChars = new Map<string, number>();
  const idfGrams = new Map<string, number>();
  for (const [t, df] of dfChars) idfChars.set(t, idfValue(df, n));
  for (const [t, df] of dfGrams) idfGrams.set(t, idfValue(df, n));
  return { docs, idfChars, idfGrams };
}

/** 实时链路每题都会匹配；题库数组不变时没必要反复建 IDF。 */
const statsCache = new WeakMap<QAEntry[], Stats>();
function buildStatsCached(entries: QAEntry[]) {
  const hit = statsCache.get(entries);
  if (hit) return hit;
  const stats = buildStats(entries);
  statsCache.set(entries, stats);
  return stats;
}

/* ------------------------------------------------------------------ */
/* 打分                                                                */
/* ------------------------------------------------------------------ */

export interface QACandidate {
  entry: QAEntry;
  /** 命中的那条问法（原题或某条同义问法） */
  variant: string;
  /** 综合分 0~1，越高越像同一道题 */
  score: number;
  /** 问法被问题覆盖的比例（主要指标） */
  coverage: number;
  /** 问题里有多少内容落在该问法上（辅助指标） */
  precision: number;
  /** 二元词 Dice：看语序和搭配是否真的接近，防止只共享一两个高频词 */
  gramDice: number;
}

const W_CHAR = 0.62;
const W_GRAM = 0.38;

function dice(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return (2 * shared) / (a.size + b.size);
}

function scoreOne(q: Tokens, qNorm: string, doc: Doc, stats: Stats) {
  const vNorm = doc.normalized;
  if (!vNorm) return null;
  if (hasNegation(qNorm) !== hasNegation(vNorm)) return null;

  if (qNorm === vNorm) {
    return { score: 1, coverage: 1, precision: 1, gramDice: 1 };
  }

  const qCharW = weight(q.chars, stats.idfChars);
  const qGramW = weight(q.grams, stats.idfGrams);
  const vCharW = weight(doc.tokens.chars, stats.idfChars);
  const vGramW = weight(doc.tokens.grams, stats.idfGrams);

  const charCov = vCharW ? sharedWeight(q.chars, doc.tokens.chars, stats.idfChars) / vCharW : 0;
  const gramCov = vGramW ? sharedWeight(q.grams, doc.tokens.grams, stats.idfGrams) / vGramW : 0;
  const charPre = qCharW ? sharedWeight(q.chars, doc.tokens.chars, stats.idfChars) / qCharW : 0;
  const gramPre = qGramW ? sharedWeight(q.grams, doc.tokens.grams, stats.idfGrams) / qGramW : 0;

  const coverage = W_CHAR * charCov + W_GRAM * gramCov;
  const precision = W_CHAR * charPre + W_GRAM * gramPre;
  let score = 0.8 * coverage + 0.2 * precision;
  const gramDice = dice(q.grams, doc.tokens.grams);

  // 整句包含：ASR 多识别了「面试官问」「我想问一下」这类前缀时仍能命中。
  // 只允许短句被长句包含，且长度比例不能太悬殊，避免「工作」命中一整道题。
  if (vNorm.length >= 6 && qNorm.includes(vNorm) && vNorm.length / qNorm.length >= 0.5) {
    score = Math.max(score, 0.96);
  } else if (qNorm.length >= 6 && vNorm.includes(qNorm) && qNorm.length / vNorm.length >= 0.7) {
    score = Math.max(score, 0.9);
  } else if (
    qNorm.length >= 3 &&
    vNorm.includes(qNorm) &&
    qNorm.length / vNorm.length >= 0.45
  ) {
    // 「自我介绍」被「请先做一个自我介绍」包含：短问句本身已经是完整题意。
    score = Math.max(score, 0.94);
  }

  return { score, coverage, precision, gramDice };
}

/**
 * 返回最可能的若干条问法（不截断），供题库页的「命中测试」使用。
 * 实时链路只调用 matchQA。
 */
export function rankQA(question: string, entries: QAEntry[], limit = 5): QACandidate[] {
  if (!entries.length) return [];
  const qNorm = clean(question);
  const q = tokensOf(question);
  // 不按 clean 后的字符数卡死：「自我介绍」是 4 个字，但「我」是停用字，
  // 用内容 token 数判断更稳；至少要有 1 个实字 + 1 个二元词（或两个实字）。
  if (q.chars.size + q.grams.size < 2) return [];
  const stats = buildStatsCached(entries);
  const out: QACandidate[] = [];

  for (const doc of stats.docs) {
    const s = scoreOne(q, qNorm, doc, stats);
    if (!s || s.score <= 0) continue;
    out.push({
      entry: doc.entry,
      variant: doc.variant,
      score: Math.round(s.score * 1000) / 1000,
      coverage: Math.round(s.coverage * 1000) / 1000,
      precision: Math.round(s.precision * 1000) / 1000,
      gramDice: Math.round(s.gramDice * 1000) / 1000,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** 跟 rankQA 保持一致的门槛，题库页用它显示「会不会命中」 */
export function qaThreshold(question: string) {
  return clean(question).length <= 10 ? 0.82 : 0.78;
}

/* ------------------------------------------------------------------ */
/* 意图 / 对象冲突：光看词面重合不够，问的是不是同一件事更重要          */
/* ------------------------------------------------------------------ */

const INTENT_RULES: { id: string; re: RegExp }[] = [
  { id: 'intro', re: /自我介绍|介绍(?:一下)?自己|自我评价/ },
  {
    id: 'why_company',
    re: /为什么.*(?:选择|加入|来|投递|考虑).*(?:公司|我们)|为什么选择我们|为什么想加入/,
  },
  {
    id: 'company_understanding',
    re: /(?:了解|认识|看法|评价|理解).*(?:公司|我们)|(?:公司|我们).*(?:了解|认识|看法|评价)/,
  },
  {
    id: 'role_understanding',
    re: /(?:理解|认识|看法|评价).*(?:岗位|职位|工作)|(?:岗位|职位).*(?:理解|认识|看法)/,
  },
  { id: 'why_role', re: /为什么.*(?:这个|该|这份)?(?:岗位|职位|工作)|为什么做.*(?:岗位|工作)/ },
  { id: 'strength', re: /优点|优势|长处|强项/ },
  { id: 'weakness', re: /缺点|不足|短板|劣势|弱项/ },
  {
    id: 'salary_expect',
    re: /(?:期望|要求|希望|目标).*(?:薪资|工资|待遇)|薪资.*(?:期望|要求)/,
  },
  {
    id: 'salary_current',
    re: /(?:当前|目前|现在|上一份|上一家|原来|之前).*(?:薪资|工资|待遇)/,
  },
  { id: 'location', re: /工作地点|地点|城市|地区|base地|工作地/ },
  { id: 'relocation', re: /调剂|调配|服从安排|外派/ },
  { id: 'overtime', re: /加班|996|大小周/ },
  { id: 'business_trip', re: /出差/ },
  { id: 'career_plan', re: /职业规划|未来.*规划|五年.*规划|三年.*规划|发展规划/ },
  { id: 'resign', re: /离职|辞职|为什么离开|离开.*公司/ },
  { id: 'question_to_us', re: /有什么.*(?:问题|想问)|反问|问我们|提问/ },
  { id: 'project', re: /项目|经历|做过|案例/ },
  { id: 'teamwork', re: /团队|协作|配合/ },
  { id: 'conflict', re: /冲突|分歧|意见不合|矛盾/ },
  { id: 'failure', re: /失败|挫折|错误|失误/ },
  { id: 'success', re: /成功|成就|亮点|最满意|最自豪/ },
  { id: 'hobby', re: /爱好|兴趣|业余/ },
  { id: 'school', re: /学校|学历|专业|成绩|gpa|毕业/ },
  { id: 'availability', re: /到岗|入职时间|什么时候.*(?:来|到岗)|多久.*入职/ },
  { id: 'family', re: /结婚|生育|孩子|家庭|男朋友|女朋友/ },
  { id: 'pressure', re: /压力|抗压|deadline|紧急/ },
];

/** 这些意图很具体，双方都有且不相交时，基本可以判定不是同一道题。 */
const STRONG_INTENTS = new Set([
  'intro',
  'why_company',
  'company_understanding',
  'role_understanding',
  'why_role',
  'strength',
  'weakness',
  'salary_expect',
  'salary_current',
  'location',
  'relocation',
  'overtime',
  'business_trip',
  'career_plan',
  'resign',
  'question_to_us',
  'success',
  'failure',
  'hobby',
  'family',
  'availability',
]);

function intentsOf(text: string) {
  const out = new Set<string>();
  for (const r of INTENT_RULES) if (r.re.test(text)) out.add(r.id);
  return out;
}

function intentConflict(question: string, variant: string) {
  const a = intentsOf(question);
  const b = intentsOf(variant);
  const strongA = [...a].filter((x) => STRONG_INTENTS.has(x));
  const strongB = [...b].filter((x) => STRONG_INTENTS.has(x));
  if (!strongA.length || !strongB.length) return false;
  // 问题里的每一个强意图都必须被这条问法覆盖。
  // 只要求「有交集」会放过「你了解我们公司吗，为什么选择我们公司」这种多意图题。
  return !strongA.every((x) => b.has(x));
}

/**
 * 对象冲突：问的是「岗位」还是「地点」、是「优点」还是「缺点」、
 * 是「当前薪资」还是「期望薪资」——这些只差一个限定词，但答案完全不同。
 */
const OBJECT_PAIRS: [string, string][] = [
  ['岗位', '地点'],
  ['优点', '缺点'],
  ['当前', '期望'],
  ['目前', '期望'],
  ['现在', '期望'],
  ['成功', '失败'],
  ['加班', '出差'],
  ['离职', '入职'],
  ['技术', '管理'],
];

function objectConflict(question: string, variant: string) {
  for (const [a, b] of OBJECT_PAIRS) {
    const qa = question.includes(a);
    const qb = question.includes(b);
    const va = variant.includes(a);
    const vb = variant.includes(b);
    // 问题同时问了槽的两边（岗位和地点、优点和缺点），而问法只覆盖一边：
    // 这是两个问题，不能拿半道题的标准答案糊弄。
    if (qa && qb && (!va || !vb)) return true;
    // 问题只问一边，问法答的是另一边。
    if ((qa && vb && !qb && !va) || (qb && va && !qa && !vb)) return true;
  }
  return false;
}

export interface QAMatch extends QACandidate {}

/**
 * 实时链路入口：有把握才返回；没把握 / 两道题打架就返回 null，
 * 交给模型结合简历、JD 和答题指令现场生成。
 *
 * 这里刻意偏向「宁可漏答，也不贴错答案」：
 * - 双向覆盖都要够（问法被问题覆盖 + 问题也被问法覆盖）；
 * - 二元词 Dice 要够（防止只共享「公司 / 工作」这类高频词）；
 * - 意图和限定对象不能冲突（优点≠缺点、岗位≠地点、当前≠期望）；
 * - 第一名和第二名必须拉开足够差距。
 */
export function matchQA(question: string, entries: QAEntry[]): QAMatch | null {
  const qNorm = clean(question);
  const qTokens = tokensOf(question);
  if (qTokens.chars.size + qTokens.grams.size < 2) return null;

  // 先按「题」聚合，避免一道题写了 10 条 alias 就把 top-24 占满，
  // 真正的竞争题被挤到后面，margin 形同虚设。
  const all = rankQA(question, entries, 100000);
  const bestByEntry = new Map<string, QACandidate>();
  for (const c of all) if (!bestByEntry.has(c.entry.id)) bestByEntry.set(c.entry.id, c);
  const ranked = [...bestByEntry.values()].sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top) return null;

  const vNorm = clean(top.variant);
  const containedShort =
    qNorm.length >= 3 && vNorm.includes(qNorm) && qNorm.length / vNorm.length >= 0.45;

  const threshold = qaThreshold(question);
  if (top.score < threshold) return null;
  // 双向覆盖：只覆盖了问法的一部分，说明问题里还有别的限定词没被解释。
  // 「自我介绍」这种被长问法包含的短问句例外：它本身就是完整题意。
  if (!containedShort && (top.coverage < 0.78 || top.precision < 0.58)) return null;
  // 短问题必须更精确，避免「公司」「岗位」这种词带出整道题。
  if (!containedShort && qNorm.length <= 10 && top.precision < 0.66) return null;
  // 词面覆盖率很高但二元词搭配对不上，通常是把同领域另一道题拉过来了。
  if (!containedShort && top.gramDice < 0.46 && top.score < 0.94) return null;

  // 用 entry 的原题做意图/对象校验，避免一条写坏的 alias 绕过检查。
  if (intentConflict(question, top.entry.question)) return null;
  if (objectConflict(qNorm, clean(top.entry.question))) return null;
  // 命中的那条 alias 也要过一遍，防止 alias 本身跨题。
  if (intentConflict(question, top.variant)) return null;
  if (objectConflict(qNorm, vNorm)) return null;

  // 两道不同题的分差太小：说明问题本身就分不清，宁可不出标准答案。
  const runnerUp = ranked[1];
  if (runnerUp && top.score - runnerUp.score < 0.08) return null;

  return top;
}
