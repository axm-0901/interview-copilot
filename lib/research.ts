'use client';

import * as db from './db';
import { chatStream, collect, extractJson, extractJsonArray, isDemoMode } from './llm';
import { buildQuestionMessages, buildResearchMessages } from './prompts';
import type {
  AppSettings,
  CompanyResearch,
  ResearchCompetency,
  ResearchQuestion,
  ResearchSource,
} from './types';

export const researchKey = (profileId: string) => `research:${profileId}`;

export async function loadResearch(profileId: string) {
  return db.kvGet<CompanyResearch>(researchKey(profileId));
}

export async function saveResearch(r: CompanyResearch) {
  await db.kvSet(researchKey(r.profileId), r);
}

export async function deleteResearch(profileId: string) {
  await db.kvSet(researchKey(profileId), null);
}

function str(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter(Boolean);
  const s = str(v);
  return s ? [s] : [];
}

function fallbackSummary(company: string, role: string, sources: ResearchSource[]) {
  const questionLines = sources
    .flatMap((s) => [s.title, ...s.snippet.split(/[。；;!?！？]/)])
    .map((x) => x.trim())
    .filter((x) => x.length >= 6 && /[?？]|怎么|为什么|如何|什么|介绍|说说/.test(x))
    .slice(0, 8);

  return {
    positioning: `${company || '目标公司'}${role ? ` · ${role}` : ''}：已抓取 ${
      sources.length
    } 条公开搜索结果。当前未配置模型 Key，只展示原始面经线索，不做结构化归纳。`,
    business: [],
    culture: [],
    recent: [],
    interviewProcess: [],
    interviewStyle: [],
    questions: questionLines.map<ResearchQuestion>((q) => ({
      question: q.slice(0, 80),
      type: '面经',
      why: '来自公开搜索结果摘要',
      angles: ['先给结论', '结合简历里最接近的一段经历', '落到目标岗位的要求'],
    })),
    competencies: [] as ResearchCompetency[],
    risks: ['未配置模型 Key，调研未做归纳；配置后重新调研可获得公司背景、流程和回答方向。'],
    askBack: [],
    salary: '资料不足',
  };
}

function firstString(...values: unknown[]) {
  for (const v of values) {
    const s = str(v);
    if (s) return s;
  }
  return '';
}

/** 把模型可能返回的嵌套对象/数组压平成可展示的句子。 */
function flattenStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') {
    if (v.trim()) out.push(v.trim());
    return out;
  }
  if (Array.isArray(v)) {
    for (const x of v) flattenStrings(x, out);
    return out;
  }
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) out.push(`${k}：${val.trim()}`);
      else flattenStrings(val, out);
    }
  }
  return out;
}

function findValues(v: unknown, re: RegExp, out: unknown[] = [], depth = 0): unknown[] {
  if (!v || typeof v !== 'object' || depth > 5) return out;
  if (Array.isArray(v)) {
    for (const x of v) findValues(x, re, out, depth + 1);
    return out;
  }
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (re.test(k)) out.push(val);
    else findValues(val, re, out, depth + 1);
  }
  return out;
}

function collectStrings(v: unknown, res: RegExp[]): string[] {
  const raw = res.flatMap((re) => findValues(v, re));
  const out = flattenStrings(raw)
    .map((s) => s.replace(/^[^：:]{1,16}[：:]\s*/, '').trim())
    .filter((s) => s.length >= 3 && !/^https?:\/\//i.test(s) && !/^(无|暂无|资料不足)$/.test(s));
  return [...new Set(out)].slice(0, 14);
}

function questionsFromPoints(points: string[]): ResearchQuestion[] {
  return [...new Set(points)]
    .map((p) => p.replace(/^(推断|面试流程|考察点)[:：]\s*/, '').trim())
    .filter((p) => p.length >= 3)
    .slice(0, 14)
    .map((p) => {
      const type = /算法|代码|数据结构|手撕|编程/.test(p)
        ? '技术'
        : /项目|经历|案例/.test(p)
        ? '项目'
        : /HR|薪资|离职|职业规划|反问/.test(p)
        ? 'HR'
        : '技术';
      const question = /[?？]|^(为什么|怎么|如何|什么|请|说说|介绍)/.test(p)
        ? p.slice(0, 80)
        : `请讲讲「${p.slice(0, 60)}」`;
      return {
        question,
        type,
        why: '公开面经 / 岗位要求中的高频考察点（推断）',
        angles: ['先给结论', '结合简历里最接近的一段经历', '说明取舍、边界和结果'],
      };
    });
}

function normalizeSummary(raw: any, company: string, role: string) {
  const questionsRaw = Array.isArray(raw?.['高频问题'])
    ? raw['高频问题']
    : Array.isArray(raw?.questions)
    ? raw.questions
    : [];
  const competenciesRaw = Array.isArray(raw?.['岗位能力'])
    ? raw['岗位能力']
    : Array.isArray(raw?.competencies)
    ? raw.competencies
    : [];

  let questions = questionsRaw
    .map((x: any) => ({
      question: str(x?.['问题'] ?? x?.question),
      type: str(x?.['类型'] ?? x?.type) || '综合',
      why: str(x?.['为什么问'] ?? x?.why),
      angles: arr(x?.['回答方向'] ?? x?.angles),
    }))
    .filter((x: ResearchQuestion) => x.question);

  if (!questions.length) {
    const points = collectStrings(raw, [
      /高频问题|常见问题|questions|likely_interview|interview_topics|考察点|focus|topics/i,
      /岗位职责|responsibilities/i,
    ]);
    questions = questionsFromPoints(points);
  }

  let competencies = competenciesRaw
    .map((x: any) => {
      const w = str(x?.['权重'] ?? x?.weight);
      return {
        name: str(x?.['能力'] ?? x?.name),
        weight: (w === '高' || w === '低' ? w : '中') as ResearchCompetency['weight'],
        evidence: str(x?.['依据'] ?? x?.evidence),
      };
    })
    .filter((x: ResearchCompetency) => x.name);

  if (!competencies.length) {
    const requirements = collectStrings(raw, [
      /岗位能力|任职要求|requirements|key_requirements|core_skills|skills|job_analysis/i,
    ]);
    competencies = requirements.slice(0, 8).map((x) => ({
      name: x.replace(/[:：].*$/, '').slice(0, 30),
      weight: '中' as const,
      evidence: x.slice(0, 100),
    }));
  }

  const background = firstString(
    raw?.['公司背景'],
    raw?.['背景'],
    raw?.background,
    raw?.company?.background,
    raw?.company?.notes
  );
  const companyBits = [
    str(raw?.company?.name),
    str(raw?.company?.industry),
    str(raw?.company?.size),
  ].filter(Boolean);

  const positioning =
    firstString(
      raw?.['定位'],
      raw?.positioning,
      raw?.['公司简介'],
      raw?.['岗位调研']?.['定位'],
      background,
      collectStrings(raw, [/background|背景|简介|介绍|定位|summary|overview|notes/i])[0]
    ) ||
    (companyBits.length ? companyBits.join(' · ') : '') ||
    `${company}${role ? ` · ${role}` : ''}：公开资料有限，以下为面经线索与 JD 推断。`;

  const business = collectStrings(raw, [/业务|business|industry|行业|主营/i]);
  if (!business.length && background) {
    const sentences = background.split(/[。；;]/).map((x) => x.trim()).filter((x) => x.length >= 8);
    if (sentences.length > 1) business.push(...sentences.slice(1, 3));
  }

function genericAskBack(company: string, role: string) {
  const c = company || '公司';
  const r = role || '这个岗位';
  return [
    `${r}入职后前三个月最核心的考核指标是什么？`,
    `团队目前最希望新同事先解决的一个问题是什么？`,
    `这个岗位和${c}其他技术/运维团队的协作边界是怎样的？`,
    `如果方便，想了解这个岗位的成长路径和值班安排。`,
  ];
}

  const risks = collectStrings(raw, [/风险|risk|data_gaps|备注|source_quality_note/i]);
  const askBack = collectStrings(raw, [/反问|ask/i]);

  return {
    positioning,
    business,
    culture: collectStrings(raw, [/文化|culture|价值观|values/i]),
    recent: collectStrings(raw, [/近期|动态|news|recent/i]),
    interviewProcess: collectStrings(raw, [/面试流程|interview_process|process|rounds|轮次/i]),
    interviewStyle: collectStrings(raw, [/面试风格|interview_style|style/i]),
    questions: questions.slice(0, 16),
    competencies: competencies.slice(0, 8),
    risks: risks.length ? risks : ['公开资料不足，建议结合现场判断'],
    askBack: askBack.length ? askBack : genericAskBack(company, role),
    salary: collectStrings(raw, [/薪资|salary/i])[0] || '资料不足',
  };
}

export interface GenerateResearchInput {
  profileId: string;
  company: string;
  role: string;
  jd: string;
  settings: AppSettings;
}

export interface ResearchProgress {
  stage: 'searching' | 'analyzing';
  detail: string;
}

/**
 * 先抓公开搜索结果，再让模型归纳成结构化情报。
 * 搜索和归纳分开：搜索失败/模型失败时都能给出可解释的降级结果。
 */
export async function generateResearch(
  input: GenerateResearchInput,
  onProgress?: (p: ResearchProgress) => void
): Promise<CompanyResearch> {
  const company = input.company.trim();
  const role = input.role.trim();
  const jd = input.jd.trim();
  if (!company) throw new Error('先填写目标公司');

  onProgress?.({ stage: 'searching', detail: '正在检索公司背景、牛客/小红书/抖音面经…' });
  const res = await fetch('/api/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company, role, jd }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(String(data?.error ?? `搜索失败（${res.status}）`));

  const sources: ResearchSource[] = (Array.isArray(data?.sources) ? data.sources : []).map(
    (s: any, i: number) => ({
      id: str(s.id) || `src_${i + 1}`,
      title: str(s.title) || '未命名来源',
      url: str(s.url),
      site: str(s.site),
      snippet: str(s.snippet),
      query: str(s.query),
    })
  );

  let summary = null as ReturnType<typeof normalizeSummary> | null;
  let extraQuestions: ResearchQuestion[] = [];
  if (!isDemoMode(input.settings) && sources.length) {
    onProgress?.({
      stage: 'analyzing',
      detail: `已抓取 ${sources.length} 条线索，正在归纳公司背景和高频问题…`,
    });
    const [summaryCall, questionCall] = await Promise.allSettled([
      collect(
        chatStream({
          settings: input.settings,
          model: input.settings.model,
          temperature: 0.2,
          maxTokens: 2400,
          noThink: true,
          messages: buildResearchMessages({ company, role, jd, sources }),
        })
      ),
      collect(
        chatStream({
          settings: input.settings,
          model: input.settings.model,
          temperature: 0.1,
          maxTokens: 1800,
          noThink: true,
          messages: buildQuestionMessages({ company, role, jd, sources }),
        })
      ),
    ]);

    if (summaryCall.status === 'fulfilled') {
      const parsed = extractJson<any>(summaryCall.value);
      if (parsed) summary = normalizeSummary(parsed, company, role);
    }
    if (questionCall.status === 'fulfilled') {
      const parsed = extractJsonArray<any[]>(questionCall.value);
      if (Array.isArray(parsed)) {
        extraQuestions = parsed
          .map((x: any) => ({
            question: str(x?.['问题'] ?? x?.question),
            type: str(x?.['类型'] ?? x?.type) || '综合',
            why: str(x?.['为什么问'] ?? x?.why),
            angles: arr(x?.['回答方向'] ?? x?.angles),
          }))
          .filter((x: ResearchQuestion) => x.question)
          .slice(0, 16);
      }
    }
  }

  const usedFallback = !summary;
  if (!summary) summary = fallbackSummary(company, role, sources);
  if (extraQuestions.length >= 5) summary.questions = extraQuestions;

  const now = Date.now();
  const research: CompanyResearch = {
    id: db.uid('rs'),
    profileId: input.profileId,
    company,
    role,
    createdAt: now,
    updatedAt: now,
    sources,
    summary,
    model: input.settings.model,
    demo: usedFallback,
  };
  await saveResearch(research);
  return research;
}
