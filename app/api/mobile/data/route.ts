import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 手机练习端的数据同步点。
 *
 * 桌面端在 /qa 点「同步到手机」→ POST 到这里，落到本机文件；
 * 手机打开 /m → GET 同一份数据。只在本机使用，不经过任何外部服务。
 */
const FILE = path.join(process.cwd(), '.mobile-data.json');
const MAX_BYTES = 4 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET() {
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    return new Response(raw, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return json({ error: '还没有同步数据。先在电脑上打开「标准问答」，点「同步到手机」。' }, 404);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }

  const text = JSON.stringify(body);
  if (text.length > MAX_BYTES) return json({ error: '同步数据太大（上限 4MB）' }, 413);

  const data = body as { qas?: unknown[]; profile?: unknown };
  if (!Array.isArray(data.qas) || data.qas.length === 0) {
    return json({ error: '没有题目可同步' }, 400);
  }

  try {
    await fs.writeFile(FILE, text, 'utf8');
    return json({ ok: true, qas: data.qas.length, bytes: Buffer.byteLength(text) });
  } catch (e: any) {
    return json({ error: `写入同步文件失败：${e?.message ?? e}` }, 500);
  }
}
