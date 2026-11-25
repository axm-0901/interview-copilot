'use client';

import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-txt">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
      return (
        <code
          key={`${keyBase}-c${i}`}
          className="rounded-[5px] border border-ink-line bg-[#0d1219] px-1.5 py-px font-mono text-[12px] text-[#a9c4ff]"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>;
  });
}

export function Markdown({
  text,
  className,
  dense,
}: {
  text: string;
  className?: string;
  dense?: boolean;
}) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const listGap = dense ? 'my-1 space-y-[3px]' : 'my-1.5 space-y-[5px]';

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      i++;
      continue;
    }

    // code fence
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().replace(/^```/, '');
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`k${key++}`}
          className="scroll-thin my-2 overflow-x-auto rounded-card border border-ink-line bg-[#0a0e14] p-3 text-[12px] leading-[1.7]"
        >
          <code className="font-mono text-[#c9d6ea]">{buf.join('\n')}</code>
          {lang ? <span className="sr-only">{lang}</span> : null}
        </pre>
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      blocks.push(
        <div
          key={`k${key++}`}
          className={cn(
            'mb-1 mt-3 text-[12.5px] font-semibold tracking-wide text-[#9fb0c9] first:mt-0',
            h[1].length === 2 && 'text-[13px]'
          )}
        >
          {inline(h[2], `h${key}`)}
        </div>
      );
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<div key={`k${key++}`} className="hairline my-3" />);
      i++;
      continue;
    }

    // 旧版答稿里的元信息，不再展示，也不该被念出来
    if (/^[（(]未使用你的个人材料/.test(line.trim())) {
      i++;
      continue;
    }

    // 旧版答稿的陷阱提示：降级成小字注记，不再是红色警报
    if (line.trim().startsWith('⚠️')) {
      blocks.push(
        <div
          key={`k${key++}`}
          className="mt-1 rounded-[6px] border border-warn/15 bg-warn/[.04] px-2 py-1 text-[10.5px] leading-relaxed text-warn/75"
        >
          {inline(line.trim(), `w${key}`)}
        </div>
      );
      i++;
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`k${key++}`} className={cn('pl-[2px]', listGap)}>
          {items.map((it, n) => (
            <li key={n} className="flex gap-2 text-[13.5px] leading-[1.75] text-txt/92">
              <span className="mt-[9px] h-[4px] w-[4px] shrink-0 rounded-full bg-brand/70" />
              <span className="min-w-0 flex-1">{inline(it, `li${key}-${n}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 有序列表
    if (/^\s*\d+[.、)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.、)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.、)]\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`k${key++}`} className={cn('pl-1', listGap)}>
          {items.map((it, n) => (
            <li key={n} className="flex gap-2 text-[13.5px] leading-[1.75] text-txt/92">
              <span className="mt-[2px] w-[15px] shrink-0 text-right text-[11.5px] font-medium text-brand/90">
                {n + 1}
              </span>
              <span className="min-w-0 flex-1">{inline(it, `ol${key}-${n}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 普通段落
    blocks.push(
      <p key={`k${key++}`} className="my-[3px] text-[13.5px] leading-[1.8] text-txt/92">
        {inline(line, `p${key}`)}
      </p>
    );
    i++;
  }

  return <div className={cn('break-words', className)}>{blocks}</div>;
}
