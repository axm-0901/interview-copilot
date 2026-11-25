'use client';

import { Loader2, Sparkles } from 'lucide-react';

export interface PrepMsg {
  role: 'assistant' | 'user';
  content: string;
}

export function parseAsk(text: string) {
  const note = text.match(/旁注[:：]\s*([\s\S]*)$/)?.[1]?.trim() ?? '';
  let q = text.replace(/旁注[:：][\s\S]*$/, '').replace(/^问[:：]\s*/, '').trim();
  q = q.replace(/^```[\s\S]*?```$/g, '').trim();
  return { q: q || text.trim(), note };
}

export function PrepMessageList({
  messages,
  streaming,
}: {
  messages: PrepMsg[];
  streaming: boolean;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Loader2 size={16} className="animate-spin text-brand" />
        <div className="text-[11.5px] text-txt-mute">面试官正在读你的项目材料…</div>
      </div>
    );
  }

  return (
    <>
      {messages.map((m, i) => {
        if (m.role === 'assistant') {
          const { q, note } = parseAsk(m.content);
          return (
            <div key={i} className="flex gap-2.5">
              <div className="mt-[2px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border border-brand/30 bg-[linear-gradient(135deg,rgba(77,141,255,.22),rgba(123,92,255,.16))]">
                <Sparkles size={11} className="text-[#9cc0ff]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="rounded-[9px] rounded-tl-[3px] border border-ink-line bg-ink-sub px-3 py-2">
                  <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-txt">
                    {q}
                    {m.content === '' && streaming ? (
                      <span className="ml-1 inline-block h-[13px] w-[3px] animate-breathe bg-brand align-middle" />
                    ) : null}
                  </div>
                  {note ? (
                    <div className="mt-1.5 border-t border-ink-line/60 pt-1.5 text-[10.5px] leading-relaxed text-txt-mute">
                      为什么问这个：{note}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="flex justify-end gap-2.5">
            <div className="max-w-[86%] rounded-[9px] rounded-tr-[3px] border border-brand/25 bg-brand/[.09] px-3 py-2">
              <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-txt/95">
                {m.content}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
