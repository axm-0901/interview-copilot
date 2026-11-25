import type { AppSettings, ChatMsg } from './types';

export const isDemoMode = (s: AppSettings) => !s.apiKey.trim();

export class LLMError extends Error {
  partial: string;
  constructor(message: string, partial = '') {
    super(message);
    this.name = 'LLMError';
    this.partial = partial;
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true }
    );
  });

/** SSE 读流空闲超时：上游只发 finish_reason、不发 [DONE] 时，不能无限等 */
const READ_IDLE_TIMEOUT_MS = 12000;

function readWithTimeout<T>(
  reader: ReadableStreamDefaultReader<T>,
  ms = READ_IDLE_TIMEOUT_MS
): Promise<ReadableStreamReadResult<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LLMError(`上游 ${Math.round(ms / 1000)} 秒没有返回数据，已中止`));
    }, ms);
    reader.read().then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/** 兼容 string / 多模态数组 / {text} 三种 content 形态 */
function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === 'string') return part;
        const p = part as any;
        if (typeof p?.text === 'string') return p.text;
        if (typeof p?.content === 'string') return p.content;
        return '';
      })
      .join('');
  }
  const v = value as any;
  if (v && typeof v.text === 'string') return v.text;
  return '';
}

/** 从 OpenAI 兼容的错误体里取一句可读信息 */
function errorText(j: any): string {
  const e = j?.error;
  if (!e) return '';
  if (typeof e === 'string') return e;
  if (typeof e?.message === 'string') return e.message;
  try {
    return JSON.stringify(e).slice(0, 300);
  } catch {
    return String(e);
  }
}

export interface StreamOptions {
  messages: ChatMsg[];
  settings: AppSettings;
  /** 覆盖 settings.model，用于「极速兜底」等场景 */
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  /** 未配置 Key 时的本地合成内容 */
  demo?: () => string;
  maxTokens?: number;
  /** 对 DeepSeek 等推理模型关闭思考链，首字可从 3~10s 降到 1s 左右 */
  noThink?: boolean;
}

/**
 * 未手填低延迟模型时，按 Base 自动挑一个「非推理、首字快」的模型。
 * 这些名字都来自对应服务商的公开模型列表；挑错只会退回主模型，不会静默失败。
 */
export function defaultFastModel(apiBase: string): string {
  const b = (apiBase || '').toLowerCase();
  if (/(127\.0\.0\.1|localhost):8760/.test(b)) return 'cn:glm-5.3-flash';
  // 本机 wb2api / router 常见入口：deepseek-v4.1-flash 关掉推理链后首字约 1.2s
  if (/(127\.0\.0\.1|localhost):7863/.test(b)) return 'deepseek-v4.1-flash';
  if (b.includes('dashscope.aliyuncs.com')) return 'qwen-flash';
  if (b.includes('open.bigmodel.cn')) return 'glm-4-flash';
  if (b.includes('api.deepseek.com')) return 'deepseek-chat';
  if (b.includes('api.openai.com')) return 'gpt-4o-mini';
  if (b.includes('siliconflow.cn')) return 'Qwen/Qwen2.5-7B-Instruct';
  return '';
}

/** 粗判一个模型是不是「先思考再出字」的推理模型，仅用于界面提示 */
export function isSlowModel(model: string): boolean {
  return /(deepseek-(v4\.1|r1)|reasoner|thinking|o1|o3)/i.test(model || '');
}

/**
 * 统一的模型出口。
 * - 有 Key：POST /api/chat，服务端透传 OpenAI 兼容 SSE
 * - 无 Key：走 demo()，逐字吐出本地合成内容，界面上必须标注「演示模式」
 */
export async function* chatStream(opts: StreamOptions): AsyncGenerator<string> {
  const { messages, settings, signal } = opts;
  const temp = opts.temperature ?? settings.temperature ?? 0.4;

  if (isDemoMode(settings)) {
    const text = opts.demo?.();
    if (!text) {
      throw new LLMError('演示模式下没有可用内容，请先在设置里填写 API Key');
    }
    await sleep(360, signal);
    for (let i = 0; i < text.length; i += 3) {
      yield text.slice(i, i + 3);
      await sleep(12, signal);
    }
    return;
  }

  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiBase: settings.apiBase,
        apiKey: settings.apiKey,
        model: opts.model || settings.model,
        temperature: temp,
        maxTokens: opts.maxTokens,
        noThink: Boolean(opts.noThink ?? settings.noThink),
        messages,
      }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new LLMError('网络请求失败，检查代理地址或本地网络后重试');
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let detail = raw;
    try {
      const j = JSON.parse(raw);
      detail = errorText(j) || raw || JSON.stringify(j);
    } catch {
      /* 不是 JSON，原文就是最可诊断的细节 */
    }
    throw new LLMError(`模型调用失败（${res.status}）：${detail.slice(0, 300)}`);
  }
  if (!res.body) throw new LLMError('上游没有返回数据流');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  /** 收到 [DONE] */
  let sawDone = false;
  /** 收到 finish_reason（有些网关不发 [DONE]） */
  let sawFinish = false;
  /** 当前 SSE 事件累积的 data 行 */
  let dataLines: string[] = [];

  const consume = (payloadRaw: string): string => {
    const payload = payloadRaw.trim();
    if (!payload) return '';
    if (payload === '[DONE]') {
      sawDone = true;
      return '';
    }
    let j: any;
    try {
      j = JSON.parse(payload);
    } catch {
      // 完整事件解析失败就是上游格式错误，不能静默当成半截
      throw new LLMError(
        `上游事件流格式错误（已保留已生成的内容）：${payload.slice(0, 120)}`,
        full
      );
    }
    const err = errorText(j);
    if (err) throw new LLMError(`上游返回错误：${err}`, full);

    const choice = j?.choices?.[0];
    if (choice?.finish_reason) sawFinish = true;
    return (
      contentText(choice?.delta?.content) ||
      contentText(choice?.message?.content) ||
      contentText(choice?.text) ||
      contentText(j?.delta?.content) ||
      ''
    );
  };

  try {
    read: while (!sawDone) {
      const { done, value } = await readWithTimeout(reader);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const out: string[] = [];
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);

        if (line === '') {
          // 空行 = 一个事件结束；注释/心跳事件没有 data，直接跳过
          if (dataLines.length) {
            const delta = consume(dataLines.join('\n'));
            dataLines = [];
            if (delta) out.push(delta);
            if (sawDone) break;
          }
          continue;
        }
        if (line.startsWith(':')) continue;

        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value2 = colon === -1 ? '' : line.slice(colon + 1);
        if (value2.startsWith(' ')) value2 = value2.slice(1);
        if (field === 'data') dataLines.push(value2);
      }

      for (const d of out) {
        full += d;
        yield d;
      }
      // 有的网关只发 finish_reason、不发 [DONE]，且连接不断开；收到 finish 就收尾
      if (sawDone || sawFinish) break read;
    }

    // decoder 收尾：最后一块可能是半截 UTF-8，也可能是没有换行结尾的事件
    buffer += decoder.decode();
    if (buffer.length) {
      let line = buffer;
      buffer = '';
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line && !line.startsWith(':')) {
        const colon = line.indexOf(':');
        const field = colon === -1 ? line : line.slice(0, colon);
        let value2 = colon === -1 ? '' : line.slice(colon + 1);
        if (value2.startsWith(' ')) value2 = value2.slice(1);
        if (field === 'data') dataLines.push(value2);
      }
    }
    if (!sawDone && dataLines.length) {
      const delta = consume(dataLines.join('\n'));
      dataLines = [];
      if (delta) {
        full += delta;
        yield delta;
      }
    }

    // 没有 [DONE]、也没有 finish_reason：上游提前断开，不能当成成功
    if (!sawDone && !sawFinish) {
      throw new LLMError(
        full ? '上游数据流提前结束（没有收到结束标记），已保留已生成的内容' : '上游没有返回任何内容',
        full
      );
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    if (e instanceof LLMError) throw e;
    throw new LLMError('数据流中断，已保留已生成的内容', full);
  } finally {
    // 提前退出（[DONE] / 消费者 break）时要主动取消，别让上游连接挂着
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

export async function collect(gen: AsyncGenerator<string>) {
  let s = '';
  for await (const d of gen) s += d;
  return s;
}

export function stripFence(s: string) {
  return s
    .replace(/^\s*```(?:json|markdown|md)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function extractJson<T = any>(raw: string): T | null {
  const text = stripFence(raw);
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = tryParse(text.slice(start, end + 1));
    if (sliced) return sliced;
  }
  return null;
}

/** 模型有时直接返回 JSON 数组（例如高频问题列表），单独解析。 */
export function extractJsonArray<T = any[]>(raw: string): T | null {
  const text = stripFence(raw);
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text);
  if (direct) return direct;

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start >= 0 && end > start) {
    const sliced = tryParse(text.slice(start, end + 1));
    if (sliced) return sliced;
  }
  return null;
}
