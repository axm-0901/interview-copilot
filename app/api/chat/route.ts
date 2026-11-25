import { fetchUpstream, resolveUpstream, UpstreamError } from '@/lib/upstreamUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** 对 DeepSeek 等推理模型传 reasoning_effort=none，避免先想 3~10 秒 */
  noThink?: boolean;
  messages?: { role: string; content: unknown }[];
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** 只限制到收到响应头；SSE 正文可能很长，不能整体超时 */
const HEADER_TIMEOUT_MS = 45_000;

/** 读上游错误正文时也加个上限，避免对方一直不结束导致请求挂死 */
async function readText(res: Response, ms = 8000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      res.text(),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error('read timeout')), ms);
      }),
    ]);
  } catch {
    return '';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const { messages } = body;
  const apiKey = (body.apiKey ?? '').trim();
  if (!Array.isArray(messages) || !messages.length) return json({ error: '缺少消息' }, 400);

  const check = resolveUpstream(body.apiBase ?? '', '/chat/completions');
  if (!check.ok) return json({ error: check.error }, check.status);
  // 本机 Ollama / 本机转发通常不校验 Key，允许空 Key；公网地址仍必须带 Key
  if (!apiKey && !check.loopback) return json({ error: '缺少 API Key' }, 400);

  const started = Date.now();
  const model = body.model || 'gpt-4o-mini';
  // 只对明确会「先思考」的模型加这个参数；OpenAI 普通模型不认它。
  const wantNoThink =
    body.noThink !== false && /(deepseek-(v4\.1|r1)|reasoner|thinking)/i.test(model);

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
    ...(body.maxTokens ? { max_tokens: body.maxTokens } : {}),
    stream: true,
    ...(wantNoThink ? { reasoning_effort: 'none' } : {}),
  };

  const call = () =>
    fetchUpstream(
      check.url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
      { timeoutMs: HEADER_TIMEOUT_MS, signal: req.signal, headersOnly: true }
    );

  try {
    let upstream = await call();

    // 有些 OpenAI 兼容网关不认 reasoning_effort，去掉后重试一次，别让整题失败。
    if (!upstream.ok && wantNoThink) {
      const detail = await readText(upstream);
      if (/reasoning_effort|unknown|unrecognized|invalid.*(param|argument)/i.test(detail)) {
        delete payload.reasoning_effort;
        upstream = await call();
      } else {
        return json(
          {
            error: `上游返回 ${upstream.status}：${detail.slice(0, 400) || upstream.statusText}`,
          },
          upstream.status === 401 || upstream.status === 403 ? upstream.status : 502
        );
      }
    }

    if (!upstream.ok) {
      const text = await readText(upstream);
      return json(
        {
          error: `上游返回 ${upstream.status}：${text.slice(0, 400) || upstream.statusText}`,
        },
        upstream.status === 401 || upstream.status === 403 ? upstream.status : 502
      );
    }

    // 200 但返回 JSON 说明网关直接给了错误体，当成 SSE 转出去只会得到空答案
    const ctype = upstream.headers.get('content-type') ?? '';
    if (ctype.includes('application/json')) {
      const text = await readText(upstream);
      return json(
        { error: `上游返回了 JSON 而不是事件流：${text.slice(0, 400) || '（空）'}` },
        502
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Proxy-Started': String(started),
      },
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') return json({ error: '请求已取消' }, 499);
    if (e instanceof UpstreamError) return json({ error: e.message }, e.status);
    return json({ error: `连接模型服务失败：${e?.message ?? '未知错误'}` }, 502);
  }
}
