/**
 * 服务端出站地址校验 + 上游请求封装。
 *
 * 这个文件是纯工具（只用 WHATWG URL 和 fetch），浏览器端也可以 import。
 *
 * 规则：
 * - 只允许 http / https，不允许 URL 里带用户名密码
 * - 拒绝 link-local（169.254.0.0/16、fe80::/10）和云厂商元数据地址
 * - 本机（127.0.0.0/8、::1、localhost）只放行约定的端口：
 *   7863（本机 wb2api / 模型网关）、8760（本机 Ollama / router 转发）、
 *   8765（本地 ASR）、11434（Ollama 默认）
 * - 只允许局域网私有地址（10/8、172.16/12、192.168/16）继续可用，
 *   方便把 Ollama 放在同网段的另一台机器上
 * - 禁止跟随重定向：上游返回 3xx 一律视为失败，避免用 302 绕过校验
 */

/** 本机地址允许的端口，和 README / 设置页里推荐的本地服务一致 */
export const LOOPBACK_PORTS = [7863, 8760, 8765, 11434] as const;

export interface UrlCheckOk {
  ok: true;
  /** 规范化后的完整 URL（已拼好接口后缀） */
  url: string;
  /** 小写、去掉 IPv6 方括号和末尾点的主机名 */
  hostname: string;
  /** 是否为本机地址（本机地址允许不带 Key，走本地服务） */
  loopback: boolean;
}

export interface UrlCheckFail {
  ok: false;
  /** 建议返回给客户端的 HTTP 状态码 */
  status: number;
  error: string;
}

export type UrlCheck = UrlCheckOk | UrlCheckFail;

const fail = (error: string, status = 400): UrlCheckFail => ({ ok: false, status, error });

function normalizeHost(hostname: string) {
  let h = hostname.trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h.endsWith('.')) h = h.slice(0, -1);
  return h;
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    nums.push(n);
  }
  return nums;
}

function expandIpv6(host: string): number[] | null {
  if (!host.includes(':')) return null;
  let h = host;
  const zone = h.indexOf('%');
  if (zone >= 0) h = h.slice(0, zone);

  const halves = h.split('::');
  if (halves.length > 2) return null;
  const parse = (s: string) =>
    s
      ? s.split(':').map((x) => (/^[0-9a-f]{1,4}$/.test(x) ? parseInt(x, 16) : NaN))
      : [];
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...tail].some((n) => Number.isNaN(n))) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...new Array<number>(fill).fill(0), ...tail];
}

/** ::ffff:169.254.169.254 这类 IPv4-mapped / IPv4-compatible 地址还原成 IPv4 */
function ipv4FromIpv6(hextets: number[]): number[] | null {
  if (hextets.length !== 8) return null;
  const prefixZero = hextets.slice(0, 5).every((n) => n === 0);
  if (!prefixZero || (hextets[5] !== 0xffff && hextets[5] !== 0)) return null;
  return [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff];
}

function isBlockedIpv4(ip: number[]): boolean {
  const [a, b, c, d] = ip;
  if (a === 0) return true; // 0.0.0.0/8，包含 0.0.0.0
  if (a === 169 && b === 254) return true; // link-local，含 169.254.169.254 元数据
  if (a === 100 && b === 100 && c === 100) return true; // 阿里云元数据 100.100.100.200
  if (a === 168 && b === 63 && c === 129 && d === 16) return true; // Azure 平台虚拟 IP
  if (a >= 224) return true; // 组播 / 保留 / 广播
  return false;
}

function isBlockedIpv6(hextets: number[]): boolean {
  const [h0, h1] = hextets;
  if (h0 === 0 && hextets.every((n) => n === 0)) return true; // ::
  if (h0 === 0xfe80 || (h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (h0 === 0xfd00 && h1 === 0x0ec2) return true; // AWS IPv6 元数据 fd00:ec2::254
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8 组播
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'metadata',
  'instance-data',
  'metadata.google.internal',
  'metadata.goog',
]);

/** 只判断主机名本身是否危险；本机地址返回 false，由端口白名单另判 */
export function isBlockedHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;

  const v4 = parseIpv4(host);
  if (v4) return isBlockedIpv4(v4);

  const v6 = expandIpv6(host);
  if (v6) {
    const mapped = ipv4FromIpv6(v6);
    if (mapped) return isBlockedIpv4(mapped);
    return isBlockedIpv6(v6);
  }
  return false;
}

export function isLoopbackHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const v4 = parseIpv4(host);
  if (v4) return v4[0] === 127;
  const v6 = expandIpv6(host);
  if (!v6) return false;
  const mapped = ipv4FromIpv6(v6);
  if (mapped) return mapped[0] === 127;
  return v6.slice(0, 7).every((n) => n === 0) && v6[7] === 1; // ::1
}

function withSuffix(url: URL, suffix: string) {
  if (!suffix) return;
  const eat = url.pathname.replace(/\/+$/, '');
  if (eat.endsWith(suffix)) {
    url.pathname = eat || '/';
    return;
  }
  url.pathname = `${eat}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
}

/**
 * 校验用户填的 Base URL 并拼出真实接口地址。
 * 返回 ok=false 时调用方直接把 status / error 回给客户端即可。
 */
export function resolveUpstream(rawBase: string, suffix = ''): UrlCheck {
  let raw = (rawBase ?? '').trim();
  if (!raw) return fail('缺少 Base URL');

  // 允许用户只填 127.0.0.1:8760/v1，自动补 http://
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = `http://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail('Base URL 不是合法地址');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('只允许 http/https 地址');
  }
  if (url.username || url.password) {
    return fail('地址里不要带用户名或密码，请把凭据填在 Key 里');
  }
  if (url.hash) return fail('Base URL 不能带 # 片段');
  if (!url.hostname) return fail('Base URL 缺少主机名');

  const hostname = normalizeHost(url.hostname);
  if (isBlockedHost(hostname)) {
    return fail('这个地址指向链路本地/云元数据网段，已拒绝');
  }

  const loopback = isLoopbackHost(hostname);
  if (loopback) {
    const port = url.port
      ? Number(url.port)
      : url.protocol === 'https:'
      ? 443
      : 80;
    if (!(LOOPBACK_PORTS as readonly number[]).includes(port)) {
      return fail(
        `本机地址只允许 ${LOOPBACK_PORTS.join(' / ')} 端口（本机 Ollama、本地语音识别），` +
          `拒绝 127.0.0.1:${port}`
      );
    }
  }

  withSuffix(url, suffix);
  return { ok: true, url: url.toString(), hostname, loopback };
}

/** 给客户端做「本机地址可以不带 Key」这类判断用；非法地址返回 false */
export function isLoopbackUpstream(rawBase: string): boolean {
  const check = resolveUpstream(rawBase);
  return check.ok && check.loopback;
}

export class UpstreamError extends Error {
  kind: 'timeout' | 'redirect' | 'network';
  /** 建议回给客户端的状态码 */
  status: number;
  constructor(kind: UpstreamError['kind'], message: string, status = 502) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
    this.status = status;
  }
}

export interface FetchUpstreamOptions {
  /** 毫秒。headersOnly=true 时只限制到收到响应头，不限制流式正文 */
  timeoutMs: number;
  /** 客户端请求的 signal，用于透传取消 */
  signal?: AbortSignal | null;
  /** 流式响应只限制建连/首包，正文由客户端消费时自然结束 */
  headersOnly?: boolean;
}

/**
 * 带超时、透传客户端 abort、且禁止跟随重定向的 fetch。
 * 客户端主动取消时抛出 name === 'AbortError' 的 DOMException。
 */
export async function fetchUpstream(
  url: string,
  init: RequestInit,
  opts: FetchUpstreamOptions
): Promise<Response> {
  const ctrl = new AbortController();
  const client = opts.signal ?? null;
  let timedOut = false;

  const onClientAbort = () => ctrl.abort();
  if (client) {
    if (client.aborted) ctrl.abort();
    else client.addEventListener('abort', onClientAbort, { once: true });
  }

  const timer = setTimeout(
    () => {
      timedOut = true;
      ctrl.abort();
    },
    Math.max(1000, opts.timeoutMs)
  );

  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, redirect: 'manual' });

    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      throw new UpstreamError('redirect', '上游返回了重定向，已按安全策略拒绝跟随');
    }

    if (opts.headersOnly) clearTimeout(timer);
    return res;
  } catch (e: any) {
    clearTimeout(timer);
    if (timedOut) {
      throw new UpstreamError(
        'timeout',
        `上游在 ${Math.round(Math.max(1000, opts.timeoutMs) / 1000)} 秒内没有响应`,
        504
      );
    }
    if (client?.aborted) throw new DOMException('aborted', 'AbortError');
    if (e instanceof UpstreamError) throw e;
    if (e?.name === 'AbortError') throw e;
    throw new UpstreamError('network', `连接上游失败：${e?.message ?? '未知错误'}`);
  }
  // 注意：不在这里移除 client 的 abort 监听。
  // headersOnly 时 fetch 已经 resolve，但正文还在流式传输，
  // 客户端断开必须继续能中断上游；{ once: true } 会在 abort 后自动解绑。
}
