'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { chatStream } from '@/lib/llm';
import { PREP_SYSTEM, prepUserPrompt } from '@/lib/prompts';
import { demoPrep } from '@/lib/demo';
import { buildIndex, search } from '@/lib/retrieval';
import { extractFields } from '@/lib/extract';
import { normalizeCard, cardCompleteness } from '@/lib/cards';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { toast } from '@/lib/toast';
import type { SkillCard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PrepMessageList, type PrepMsg } from './PrepMessageList';

type Msg = PrepMsg;

const cache = new Map<string, Msg[]>();

export function PrepDialog({
  open,
  card,
  onClose,
  onSaved,
  onOpenEditor,
}: {
  open: boolean;
  card: SkillCard | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onOpenEditor: () => void;
}) {
  const settings = useApp((s) => s.settings);
  const chunks = useApp((s) => s.chunks);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const askedRef = useRef(false);

  const material = useMemo(() => {
    if (!card || !chunks.length) return '';
    const idx = buildIndex(chunks);
    const hits = search(`${card.project} ${card.background} ${card.actions.join(' ')}`, chunks, idx, 2);
    return hits.map((h) => h.chunk.text).join('\n---\n').slice(0, 1400);
  }, [chunks, card]);

  useEffect(() => {
    if (!open || !card) return;
    const saved = cache.get(card.id);
    setMessages(saved ?? []);
    setInput('');
    askedRef.current = Boolean(saved?.length);
  }, [open, card]);

  useEffect(() => {
    if (!open || !card || askedRef.current) return;
    askedRef.current = true;
    void ask([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function ask(history: Msg[]) {
    if (!card) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);

    const base = [...history, { role: 'assistant' as const, content: '' }];
    setMessages(base);

    try {
      let acc = '';
      const userTurns = history.filter((h) => h.role === 'user').length;
      for await (const d of chatStream({
        settings,
        temperature: 0.6,
        signal: ctrl.signal,
        messages: [
          { role: 'system', content: PREP_SYSTEM },
          { role: 'user', content: prepUserPrompt(card, history, material) },
        ],
        demo: () => demoPrep(card, userTurns).q,
      })) {
        acc += d;
        setMessages([...history, { role: 'assistant', content: acc }]);
      }
      const final = [...history, { role: 'assistant' as const, content: acc }];
      setMessages(final);
      cache.set(card.id, final);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setMessages([
          ...history,
          {
            role: 'assistant',
            content: `问：刚才连接模型失败了（${String(e?.message ?? e).slice(0, 60)}）。\n旁注：可以先手动补充这一段的细节，或者检查设置里的 Key。`,
          },
        ]);
      }
    } finally {
      setStreaming(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !card) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    cache.set(card.id, next);
    await ask(next);
  }

  async function finish() {
    if (!card) return;
    const answers = messages.filter((m) => m.role === 'user');
    if (!answers.length) {
      toast('还没聊出内容', 'warn', '至少回答一个问题，才能写入卡片');
      return;
    }
    setFinishing(true);
    try {
      const { data, local } = await extractFields(
        card,
        messages.map((m) => ({ role: m.role, content: m.content })),
        settings
      );

      const merge = (oldV: string[], add: string[], cap = 5) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const x of [...oldV.filter(Boolean), ...add]) {
          const k = x.slice(0, 8);
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(x);
        }
        return out.slice(0, cap);
      };

      const merged = normalizeCard({
        ...card,
        actions: merge(card.actions, data.actions),
        decisions: merge(card.decisions, data.decisions),
        results: merge(card.results, data.results),
        followups: (() => {
          const old = card.followups.filter((f) => f.q);
          const add = data.followups.filter((f) => f.q);
          const seen = new Set(old.map((f) => f.q.slice(0, 8)));
          return [...old, ...add.filter((f) => !seen.has(f.q.slice(0, 8)))].slice(0, 5);
        })(),
      });

      await db.putCard(merged);
      await onSaved();
      cache.delete(card.id);
      toast(
        local ? '已用本地规则写入卡片' : '已写入卡片',
        'ok',
        `${data.actions.length} 条动作 · ${data.decisions.length} 条取舍 · ${data.results.length} 条结果`
      );
      onOpenEditor();
    } catch (e: any) {
      toast('写入失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setFinishing(false);
    }
  }

  if (!card) return null;
  const { pct } = cardCompleteness(card);
  const answers = messages.filter((m) => m.role === 'user').length;

  return (
    <Dialog
      open={open}
      onClose={() => {
        abortRef.current?.abort();
        onClose();
      }}
      title={
        <span className="flex items-center gap-2">
          准备对话
          <Badge tone="violet">{card.project || '未命名项目'}</Badge>
        </span>
      }
      desc="AI 会像真人面试官一样追问。挖到「有数字、有取舍、有你的决策」就收手。"
      width="lg"
      footer={
        <>
          <span className="mr-auto text-[11px] text-txt-mute">
            已答 {answers} 轮 · 关闭后对话会保留在本次会话内
          </span>
          <Button variant="ghost" onClick={onClose}>
            稍后再来
          </Button>
          <Button variant="primary" onClick={() => void finish()} loading={finishing}>
            <Wand2 size={12} />
            结束并写入卡片
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-center gap-3 rounded-[8px] border border-ink-line/70 bg-[#0e131a]/50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] text-txt-dim">
            {card.role || '角色待填'} · {card.period || '时间待填'}
          </div>
          <div className="mt-0.5 truncate text-[10.5px] text-txt-mute">
            {card.background || '背景还没写，追问会先从「为什么做这件事」开始'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[13px] font-semibold text-txt">{pct}%</div>
          <div className="text-[9.5px] text-txt-mute">完整度</div>
        </div>
      </div>

      <div
        ref={scroller}
        className="scroll-thin h-[352px] space-y-3 overflow-y-auto rounded-card border border-ink-line/70 bg-[#0a0e14]/60 p-3"
      >
        <PrepMessageList messages={messages} streaming={streaming} />
      </div>

      <div className="mt-2.5 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="像跟人聊天一样回答。说清「我做了什么、为什么这么定、结果多少」。"
          className="field min-h-[54px] flex-1 text-[12.5px] leading-relaxed"
          disabled={streaming}
        />
        <IconButton
          onClick={() => void send()}
          disabled={streaming || !input.trim()}
          className={cn(
            'mb-[3px] h-9 w-9 rounded-btn border',
            input.trim() && !streaming
              ? 'border-white/10 bg-[linear-gradient(97deg,#4d8dff,#7b5cff)] text-white'
              : 'border-ink-line bg-ink-sub text-txt-mute'
          )}
        >
          {streaming ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={15} />}
        </IconButton>
      </div>
      <div className="mt-1 text-[10px] text-txt-mute">
        Enter 发送 · Shift + Enter 换行 · 追问最多连续两轮同一个点，挖到就换下一个
      </div>
    </Dialog>
  );
}
