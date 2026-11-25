import { buildResearchQueries, searchMany, sourcePriority, type SearchHit } from '@/lib/webSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

interface Body {
  company?: string;
  role?: string;
  jd?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function coreCompany(name: string) {
  return name
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/(股份有限公司|有限责任公司|有限公司|集团公司|分公司|集团|公司)$/g, '')
    .trim();
}

function companyAliases(name: string) {
  const core = coreCompany(name);
  const brand = /^(中国移动|中国联通|中国电信|中国铁塔|中国广电|华为|腾讯|阿里|字节跳动|百度|京东|美团|小米|比亚迪|国家电网|南方电网)/.exec(core)?.[1] ?? '';
  const region = brand ? core.slice(brand.length).replace(/^(通信集团|通信|集团|省|市|自治区)/, '').trim() : '';
  return [...new Set([core, brand, region ? `${brand}${region}` : '', region ? `${brand} ${region}` : ''].filter((x) => x.length >= 2))];
}

function relevant(hit: SearchHit, company: string, role: string) {
  const aliases = companyAliases(company);
  const text = `${hit.title} ${hit.snippet} ${hit.site} ${hit.url}`.toLowerCase();
  const cOk = aliases.some((x) => text.includes(x.toLowerCase()));
  const roleWords = role
    .toLowerCase()
    .split(/[\s/、,，·\-—_]+/)
    .filter((x) => x.length >= 2)
    .slice(0, 5);
  const rOk = roleWords.some((x) => text.includes(x));
  return cOk || rOk;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const company = (body.company ?? '').trim().slice(0, 80);
  const role = (body.role ?? '').trim().slice(0, 120);
  const jd = (body.jd ?? '').trim().slice(0, 12000);
  if (!company) return json({ error: '先填写目标公司' }, 400);

  const queries = buildResearchQueries(company, role, jd);
  const started = Date.now();
  const hits = await searchMany(queries, { perQuery: 9, concurrency: 2 });
  if (!hits.length) {
    return json(
      {
        error:
          '搜索源暂时不可用：360 移动搜索、桌面搜索和 Bing 都没有返回结果。系统已自动换源重试，不需要你提供网址；请稍后再试。',
      },
      502
    );
  }

  const filtered = hits.filter((h) => relevant(h, company, role));
  const picked = (filtered.length >= 8 ? filtered : hits)
    .sort((a, b) => sourcePriority(b.site || b.url) - sourcePriority(a.site || a.url))
    .slice(0, 24)
    .map((h, i) => ({
      id: `src_${i + 1}`,
      title: h.title,
      url: h.url,
      site: h.site,
      snippet: h.snippet,
      query: h.query,
    }));

  return json({
    company,
    role,
    jdChars: jd.length,
    queries,
    sources: picked,
    fetchedAt: Date.now(),
    elapsedMs: Date.now() - started,
  });
}
