/* 客户端文件解析：PDF / DOCX / TXT / MD
   重量级解析器放 public/vendor，运行时按需加载，避免拖慢首屏。 */

declare global {
  interface Window {
    __pdfjsLib?: any;
    mammoth?: any;
  }
}

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string, type?: 'module'): Promise<void> {
  const hit = loaded.get(src);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    if (type) el.type = type;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`加载解析器失败：${src}`));
    document.head.appendChild(el);
  });
  loaded.set(src, p);
  return p;
}

async function pdfjs() {
  if (!window.__pdfjsLib) await loadScript('/vendor/pdf-loader.mjs', 'module');
  if (!window.__pdfjsLib) throw new Error('PDF 解析器未就绪');
  return window.__pdfjsLib;
}

async function mammothLib() {
  if (!window.mammoth) await loadScript('/vendor/mammoth.browser.min.js');
  if (!window.mammoth) throw new Error('DOCX 解析器未就绪');
  return window.mammoth;
}

export interface ParseOutcome {
  text: string;
  note?: string;
}

async function parsePdf(file: File): Promise<ParseOutcome> {
  const lib = await pdfjs();
  const buf = await file.arrayBuffer();
  const doc = await lib.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items as any[]) {
      const str = item.str ?? '';
      line += str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = '';
      }
    }
    if (line.trim()) lines.push(line.trim());
    out.push(lines.join('\n'));
  }
  await doc.destroy();

  const text = out.join('\n\n').trim();
  return {
    text,
    note: text.length < 80 ? '这份 PDF 可能是扫描件，未能提取到足够文字，建议粘贴文本或换一份可复制的 PDF。' : undefined,
  };
}

async function parseDocx(file: File): Promise<ParseOutcome> {
  const mammoth = await mammothLib();
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: String(res.value ?? '').trim() };
}

export async function parseFile(file: File): Promise<ParseOutcome> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return parsePdf(file);
  if (name.endsWith('.docx')) return parseDocx(file);
  if (name.endsWith('.doc')) {
    throw new Error('旧版 .doc 无法在浏览器解析，请另存为 .docx 或直接粘贴文本');
  }
  if (/\.(txt|md|markdown|csv|json)$/.test(name)) {
    const text = await file.text();
    return { text: text.trim() };
  }
  // 兜底：按纯文本读
  const text = await file.text();
  if (/[\u0000-\u0008]/.test(text.slice(0, 2000))) {
    throw new Error('不支持的文件类型，请上传 PDF / DOCX / TXT / MD');
  }
  return { text: text.trim() };
}

export function guessDocType(name: string): 'resume' | 'jd' | 'project' {
  const n = name.toLowerCase();
  if (/jd|job|岗位|职位|招聘|requirement/.test(n)) return 'jd';
  if (/简历|resume|cv|profile/.test(n)) return 'resume';
  return 'project';
}
