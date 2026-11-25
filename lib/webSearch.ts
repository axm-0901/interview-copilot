/**
 * 轻量公开网页检索（服务端专用）。
 *
 * 目标是给「公司 / 岗位调研」提供真实可引用的公开结果，而不是自己编公司背景。
 * 360 的桌面搜索页对无 Cookie 的请求经常返回「访问异常页面」，所以默认走
 * m.so.com 移动结果页；失败时再尝试桌面 360 和 Bing。只读取搜索结果的标题、
 * 摘要和原文链接，不抓登录页、不绕验证码。
 */

export interface SearchHit {
  title: string;
  url: string;
  site: string;
  snippet: string;
  query: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function decodeEntities(s: string) {
  return (s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

function stripTags(s: string) {
  return decodeEntities(
    (s ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function dedupeHits(hits: SearchHit[]) {
  const byUrl = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = hit.url.replace(/#.*$/, '');
    const old = byUrl.get(key);
    if (!old || hit.snippet.length > old.snippet.length) byUrl.set(key, hit);
  }
  return [...byUrl.values()];
}

/** 解析 360 移动结果页（m.so.com）的 g-card/res-list 卡片。 */
function parseSoMobile(html: string, query: string): SearchHit[] {
  const parts = html.split(/<div[^>]*class="[^"]*g-card[^"]*res-list[^"]*"[^>]*>/i);
  const out: SearchHit[] = [];
  for (const block of parts.slice(1)) {
    const title = stripTags(
      /<h3[^>]*class="[^"]*res-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i.exec(block)?.[1] ?? ''
    );
    if (!title) continue;

    const hrefRaw =
      /<a[^>]+href="([^"]+)"/i.exec(block)?.[1] ??
      /<a[^>]+href='([^']+)'/i.exec(block)?.[1] ??
      '';
    let url = decodeEntities(hrefRaw).replace(/^\/\//, 'https://');
    // m.so.com/jump?u=<encoded-url>&m=...
    const jump = /[?&]u=([^&"']+)/i.exec(url)?.[1];
    if (jump) {
      try {
        url = decodeURIComponent(jump);
      } catch {
        /* 保留 jump 地址 */
      }
    }
    // 有些卡片把真实地址放在 data-pcurl 上，优先使用。
    const pcurl = /data-pcurl="([^"]+)"/i.exec(block)?.[1];
    if (pcurl && /^https?:\/\//i.test(pcurl)) url = decodeEntities(pcurl);
    if (!/^https?:\/\//i.test(url)) continue;
    if (/^https?:\/\/(?:www\.)?(?:m\.)?so\.com\/jump/i.test(url)) continue;

    const host = hostOf(url);
    if (!host || /(^|\.)so\.com$/i.test(host) || /(^|\.)360kan\.com$/i.test(host) || /(^|\.)360tres\.com$/i.test(host)) {
      continue;
    }

    const snippet = stripTags(
      /<div[^>]*class="[^"]*summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1] ??
        /<div[^>]*class="[^"]*res-con[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)?.[1] ??
        ''
    )
      .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*[-–—]\s*/, '')
      .trim();
    const site =
      stripTags(/<span[^>]*class=['"]res-site-url['"][^>]*>([\s\S]*?)<\/span>/i.exec(block)?.[1] ?? '') ||
      stripTags(/<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(block)?.[1] ?? '') ||
      host;

    out.push({ title, url, site, snippet, query });
  }
  return out;
}

/** 360 桌面结果页（保留作回退）。 */
function parseSo(html: string, query: string): SearchHit[] {
  const blocks = html.match(/<li[^>]*class="[^"]*res-list[^"]*"[\s\S]*?<\/li>/gi) ?? [];
  const out: SearchHit[] = [];
  for (const block of blocks) {
    if (/data-result-type="(?:ad|advert)"/i.test(block)) continue;
    const urlRaw =
      /data-mdurl="([^"]+)"/i.exec(block)?.[1] ??
      /<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i.exec(block)?.[1] ??
      '';
    const url = decodeEntities(urlRaw).replace(/^\/\//, 'https://');
    if (!/^https?:\/\//i.test(url)) continue;
    if (/^https?:\/\/(?:www\.)?so\.com\/link/i.test(url)) continue;
    const host = hostOf(url);
    if (!host || /(^|\.)so\.com$/i.test(host) || /(^|\.)360kan\.com$/i.test(host) || /(^|\.)360tres\.com$/i.test(host)) {
      continue;
    }
    const title = stripTags(/<h3[^>]*>([\s\S]*?)<\/h3>/i.exec(block)?.[1] ?? '');
    if (!title) continue;
    const snippet = stripTags(
      /<p[^>]*class="[^"]*res-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? ''
    )
      .replace(/^\d{4}年\d{1,2}月\d{1,2}日\s*[-–—]\s*/, '')
      .trim();
    const site =
      stripTags(/<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(block)?.[1] ?? '') || host;
    out.push({ title, url, site, snippet, query });
  }
  return out;
}

/** Bing HTML 回退；中文结果不一定好，但比整体失败强。 */
function parseBing(html: string, query: string): SearchHit[] {
  const blocks = html.match(/<li[^>]*class="[^"]*b_algo[^"]*"[\s\S]*?<\/li>/gi) ?? [];
  const out: SearchHit[] = [];
  for (const block of blocks) {
    const title = stripTags(
      /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(block)?.[1] ?? ''
    );
    if (!title) continue;
    const href =
      /<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i.exec(block)?.[1] ??
      /<h2[^>]*>[\s\S]*?<a[^>]+href='([^']+)'/i.exec(block)?.[1] ??
      '';
    const url = decodeEntities(href).replace(/^\/\//, 'https://');
    if (!/^https?:\/\//i.test(url)) continue;
    const host = hostOf(url);
    if (!host) continue;
    const snippet = stripTags(/<p[^>]*>([\s\S]*?)<\/p>/i.exec(block)?.[1] ?? '');
    const site =
      stripTags(/<cite[^>]*>([\s\S]*?)<\/cite>/i.exec(block)?.[1] ?? '') || host;
    out.push({ title, url, site, snippet, query });
  }
  return out;
}

async function fetchHtml(url: string, ua: string, timeoutMs: number, referer?: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': ua,
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
        ...(referer ? { Referer: referer } : {}),
      },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSoMobile(query: string, timeoutMs = 9000): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://m.so.com/s?q=${encodeURIComponent(query)}`,
    MOBILE_UA,
    timeoutMs,
    'https://m.so.com/'
  );
  return html ? parseSoMobile(html, query) : [];
}

async function fetchSoDesktop(query: string, timeoutMs = 9000): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://www.so.com/s?q=${encodeURIComponent(query)}`,
    UA,
    timeoutMs,
    'https://www.so.com/'
  );
  return html ? parseSo(html, query) : [];
}

async function fetchBing(query: string, timeoutMs = 9000): Promise<SearchHit[]> {
  const html = await fetchHtml(
    `https://cn.bing.com/search?q=${encodeURIComponent(query)}&mkt=zh-CN&setlang=zh-Hans`,
    UA,
    timeoutMs
  );
  return html ? parseBing(html, query) : [];
}

/** 单次检索：移动 360 → 桌面 360 → Bing，全部失败返回空数组。 */
export async function searchWeb(query: string, timeoutMs = 9000): Promise<SearchHit[]> {
  const mobile = await fetchSoMobile(query, timeoutMs);
  if (mobile.length) return mobile;
  const desktop = await fetchSoDesktop(query, timeoutMs);
  if (desktop.length) return desktop;
  return fetchBing(query, timeoutMs);
}

/** 并行检索多个 query；限制并发，避免把搜索站打挂。 */
export async function searchMany(
  queries: string[],
  opts: { perQuery?: number; concurrency?: number } = {}
): Promise<SearchHit[]> {
  const perQuery = opts.perQuery ?? 8;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 2, 4));
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 8);
  const out: SearchHit[] = [];
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= uniqueQueries.length) return;
      const hits = await searchWeb(uniqueQueries[i]);
      out.push(...hits.slice(0, perQuery));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, uniqueQueries.length) }, worker));
  return dedupeHits(out);
}

function compactCompany(company: string) {
  return company
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/(股份有限公司|有限责任公司|有限公司|集团公司|集团|公司)$/g, '')
    .trim();
}

function companyParts(company: string) {
  const full = company.trim();
  const core = compactCompany(full);
  const brandMatch = /^(中国移动|中国联通|中国电信|中国铁塔|中国广电|华为|腾讯|阿里巴巴|阿里|字节跳动|百度|京东|美团|小米|比亚迪|国家电网|南方电网)/.exec(core);
  const brand = brandMatch?.[1] ?? '';
  const region = brand
    ? core.slice(brand.length).replace(/^(通信集团|通信|集团|省|市|自治区)/, '').trim()
    : '';
  return {
    full,
    core: core || full,
    brand: brand || core || full,
    region,
  };
}

function roleCore(role: string) {
  const parts = role
    .split(/[\s/、,，·\-—_]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !/^(一面|二面|三面|终面|笔试|面试)$/.test(x));
  return parts[0] ?? role.trim();
}

function jdHints(jd: string) {
  const matches =
    jd.match(
      /(Java|Python|Go|C\+\+|Linux|Kubernetes|Docker|MySQL|Redis|SQL|网络运维|网络优化|核心网|无线|传输|5G|云计算|大数据|数据库|信息安全|自动化|监控|AIOps|人工智能|机器学习|算法)/gi
    ) ?? [];
  return [...new Set(matches.map((x) => x.trim()))].slice(0, 3);
}

/** 针对「公司 + 岗位 + JD」生成检索词。优先面经/面试题，其次公司背景。 */
export function buildResearchQueries(company: string, role: string, jd = ''): string[] {
  const { full, core, brand, region } = companyParts(company);
  const r = roleCore(role);
  const hints = jdHints(jd);
  const short = [brand, region].filter(Boolean).join(' ');
  const queries = [
    `${full} ${r} 面试 面经`,
    `${brand} ${r} 面试题 高频 ${hints.join(' ')}`,
    `${core} 校招 面试 流程 几轮`,
    `${short || core} 面试 经验 小红书`,
    `${short || core} 面试 抖音 面经`,
    `${brand} ${r} 岗位职责 要求`,
    `${brand} 公司 业务 介绍 文化`,
    `${brand} 面试 反问 问题`,
  ];
  return [...new Set(queries.map((q) => q.replace(/\s+/g, ' ').trim()))]
    .filter((q) => q.replace(/\s+/g, '').length >= 4)
    .slice(0, 8);
}

/** 来源站点优先级：面经社区 > 社交平台 > 公司/招聘官网 > 其他。 */
export function sourcePriority(siteOrUrl: string) {
  const s = siteOrUrl.toLowerCase();
  if (/nowcoder|牛客/.test(s)) return 5;
  if (/xiaohongshu|xhslink|小红书/.test(s)) return 4;
  if (/douyin|抖音|zhihu|知乎/.test(s)) return 3;
  if (/boss|zhipin|lagou|liepin|51job|智联|猎聘|zhaopin/.test(s)) return 3;
  if (/10086|chinaunicom|telecom|company|about|招聘|job/.test(s)) return 2;
  return 1;
}

/** 把搜索结果压成适合塞进模型上下文的文本。 */
export function hitsToText(hits: SearchHit[], maxChars = 7000) {
  const sorted = [...hits].sort(
    (a, b) => sourcePriority(b.site || b.url) - sourcePriority(a.site || a.url)
  );
  const lines: string[] = [];
  let used = 0;
  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i];
    const line = `[${i + 1}] ${h.title}\n站点：${h.site || hostOf(h.url)}\n摘要：${
      h.snippet || '（无摘要）'
    }\n链接：${h.url}\n检索词：${h.query}`;
    if (used + line.length > maxChars) break;
    used += line.length;
    lines.push(line);
  }
  return lines.join('\n---\n');
}
