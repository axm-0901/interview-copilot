import { fetchUpstream, resolveUpstream, UpstreamError } from '@/lib/upstreamUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** 一段音频最多 30 秒（16k/16bit 单声道约 1MB），20MB 足够且能挡住异常大包 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** 整次转写（上传 + 等结果）的总超时 */
const TRANSCRIBE_TIMEOUT_MS = 30_000;

/** 把音频片段转成文本。Key 只在这里出现一次，不落盘、不记录。 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: '请求体不是 multipart' }, 400);
  }

  const file = form.get('file');
  const apiBase = String(form.get('apiBase') ?? '');
  const apiKey = String(form.get('apiKey') ?? '').trim();
  const model = String(form.get('model') ?? 'whisper-1');
  const lang = String(form.get('lang') ?? 'zh');
  const local = String(form.get('local') ?? '') === '1';
  const beamSize = String(form.get('beamSize') ?? '');
  const vadFilter = String(form.get('vadFilter') ?? '');

  if (!(file instanceof Blob) || file.size < 2000) {
    return json({ error: '音频片段太短，没有发送' }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return json({ error: '音频片段过大，已拒绝' }, 413);
  }

  const check = resolveUpstream(apiBase, '/audio/transcriptions');
  if (!check.ok) return json({ error: check.error }, check.status);
  // 本地 8765 / 8760 通常不校验 Key；公网转写服务仍然必须带 Key
  if (!apiKey && !check.loopback) {
    return json({ error: '未配置语音识别 Key' }, 400);
  }

  const out = new FormData();
  // 保留原始文件名/扩展名：手机端录的是 m4a，本地 faster-whisper 靠 ffmpeg 也能识别
  const filename = (file as File).name || 'chunk.wav';
  out.append('file', file, filename);
  out.append('model', model);
  if (lang) out.append('language', lang);
  out.append('response_format', 'json');
  // 只有本地 faster-whisper 认这两个参数；云端 OpenAI 兼容接口可能因为未知字段 400
  if (local) {
    if (beamSize) out.append('beam_size', beamSize);
    if (vadFilter) out.append('vad_filter', vadFilter);
  }

  try {
    const res = await fetchUpstream(
      check.url,
      {
        method: 'POST',
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: out,
        cache: 'no-store',
      },
      { timeoutMs: TRANSCRIBE_TIMEOUT_MS, signal: req.signal }
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const hint =
        res.status === 404
          ? '：这个地址上没有转写接口。Base URL 一般填到 /v1 为止，且服务商必须支持 /audio/transcriptions'
          : res.status === 401 || res.status === 403
          ? '：Key 无效或没有该模型的权限'
          : res.status === 400
          ? '：参数不对，多半是模型名填错了'
          : '';
      return json(
        {
          error: `转写服务返回 ${res.status}${hint}｜${detail.slice(0, 160)}`,
          url: check.url,
        },
        res.status === 401 || res.status === 403 ? res.status : 502
      );
    }

    const data = (await res.json().catch(() => null)) as { text?: string } | null;
    return json({ text: (data?.text ?? '').trim() });
  } catch (e: any) {
    // 客户端取消（用户停止 / 新一轮开始）时悄悄结束，别当成故障
    if (e?.name === 'AbortError') {
      return req.signal.aborted
        ? json({ error: '请求已取消' }, 499)
        : json({ error: `转写服务超时（${TRANSCRIBE_TIMEOUT_MS / 1000} 秒）`, url: check.url }, 504);
    }
    if (e instanceof UpstreamError) return json({ error: e.message, url: check.url }, e.status);
    return json({ error: `连接转写服务失败：${e?.message ?? '未知错误'}` }, 502);
  }
}
