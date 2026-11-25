'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  Mic,
  Radio,
  Square,
  Timer,
  X,
} from 'lucide-react';
import { Markdown } from '@/components/ui/Markdown';
import { cn, copyText } from '@/lib/utils';
import type { Turn } from '@/lib/types';
import type { PendingAnswer } from './useLiveSession';

const ANSWER_CLASS =
  'max-w-[1080px] text-[21px] leading-[1.95] [&_p]:my-2.5 [&_p]:text-[21px] [&_p]:leading-[1.95] [&_li]:text-[21px] [&_li]:leading-[1.95] [&_ul]:my-3 [&_ol]:my-3 [&_pre]:text-[15px] [&_pre_code]:text-[15px] [&_code]:text-[15px] [&_strong]:text-txt';

const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

const fmtLatency = (ms?: number) =>
  !ms ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

export interface FocusViewProps {
  sessionLabel: string;
  startedAt: number;
  listening: boolean;
  systemOn: boolean;
  systemBusy?: boolean;
  systemError?: string;
  systemModel?: string;
  systemInterim?: string;
  interim: string;
  transcript: { id: string; text: string; final: boolean }[];
  turns: Turn[];
  pending: PendingAnswer | null;
  autoAnswer: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onToggleAuto: () => void;
  onToggleSystem: () => void;
  onExit: () => void;
  lastLatency?: number;
}

export function FocusView({
  sessionLabel,
  startedAt,
  listening,
  systemOn,
  systemBusy,
  systemError,
  systemModel,
  systemInterim,
  interim,
  transcript,
  turns,
  pending,
  autoAnswer,
  input,
  setInput,
  onSend,
  sending,
  onToggleAuto,
  onToggleSystem,
  onExit,
  lastLatency,
}: FocusViewProps) {
  const answerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const latestTurn = turns[0];
  const latestFinal = [...transcript].reverse().find((line) => line.final && line.text.trim());
  const liveInterim = (systemInterim || interim).trim();
  const question =
    pending?.question.trim() ||
    latestTurn?.question?.trim() ||
    liveInterim ||
    latestFinal?.text.trim() ||
    '';
  const showingInterim = Boolean(!pending && !latestTurn?.question && liveInterim);
  // 新题还在等首字时，不要把上一题答案顶上来；否则看起来像“这题答了”，实际是旧答案
  const answerText = pending ? pending.text : latestTurn?.answerMd || '';
  const answerKind = pending
    ? pending.qaId
      ? '标准问答'
      : '模型生成'
    : latestTurn
    ? latestTurn.qaId
      ? '标准问答'
      : '模型生成'
    : '';
  const asrError = (systemError || '').trim();
  const asrActive = systemOn || listening;
  const asrReconnecting = /正在重连|重连失败/.test(asrError);
  const asrState = asrReconnecting
    ? '重连中'
    : asrError
    ? '异常'
    : systemBusy
    ? '连接中'
    : asrActive
    ? '监听中'
    : '未开启';
  const asrTone = asrReconnecting ? 'text-warn' : asrError ? 'text-danger' : asrActive ? 'text-ok' : 'text-txt-mute';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    const el = answerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pending?.text, pending?.error, latestTurn?.id, latestTurn?.answerMd]);

  const copyAnswer = async () => {
    if (!answerText) return;
    try {
      await copyText(answerText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex flex-col bg-[#0b0e13] text-txt"
    >
      <header className="flex h-[56px] shrink-0 items-center justify-between gap-3 border-b border-ink-line/70 px-5 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-ok/60" />
            <span className="relative h-2 w-2 rounded-full bg-ok" />
          </span>
          <span className="truncate text-[13px] font-semibold">{sessionLabel}</span>
          <span className="hidden shrink-0 text-[11px] text-txt-mute sm:inline">
            开始于 {fmtClock(startedAt)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px]">
          <span className={cn('inline-flex items-center gap-1.5', asrTone)} title={asrError || ''}>
            {asrError ? <AlertTriangle size={12} /> : <Radio size={12} />}
            ASR {asrState}
          </span>
          {systemModel ? (
            <span className="hidden text-txt-mute md:inline">{systemModel.replace(/^cn:/, '')}</span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-txt-mute">
            <Timer size={11} />
            首字 {fmtLatency(pending?.latencyMs || lastLatency)}
          </span>
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1 rounded-btn border border-ink-line px-2.5 py-1.5 text-txt-dim transition-colors hover:border-ink-line2 hover:text-txt"
          >
            <X size={11} />
            退出专注 <span className="text-[9px] text-txt-mute">Esc</span>
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1240px] flex-1 flex-col px-5 sm:px-8">
        <section className="shrink-0 border-b border-ink-line/50 pb-5 pt-7">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-brand">
            <Radio size={11} />
            面试官提问
          </div>
          {question ? (
            <p
              className={cn(
                'max-w-[1080px] whitespace-pre-wrap break-words text-[27px] font-medium leading-[1.5] sm:text-[31px]',
                showingInterim ? 'text-txt/75' : 'text-txt'
              )}
            >
              {question}
              {showingInterim ? <span className="ml-1 animate-pulse text-brand">▍</span> : null}
            </p>
          ) : (
            <p className="text-[22px] text-txt-mute">正在听面试官说话…</p>
          )}
        </section>

        <section className="flex min-h-0 flex-1 flex-col pt-5">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-medium text-txt-mute">
              最新答稿
              {answerKind ? (
                <span className="rounded-full border border-ink-line px-1.5 py-px text-[9.5px] text-txt-mute">
                  {answerKind}
                </span>
              ) : null}
              {pending ? (
                <span className="inline-flex items-center gap-1 text-brand">
                  <Loader2 size={9} className="animate-spin" />
                  生成中
                </span>
              ) : null}
            </div>
            {answerText ? (
              <button
                onClick={copyAnswer}
                className="inline-flex items-center gap-1 text-[10.5px] text-txt-mute transition-colors hover:text-txt-dim"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? '已复制' : '复制'}
              </button>
            ) : null}
          </div>

          <div ref={answerRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-8">
            {answerText ? (
              <Markdown text={answerText} className={ANSWER_CLASS} />
            ) : pending ? null : (
              <div className="pt-2 text-[16px] text-txt-mute">
                问题结束后会自动出答稿；命中标准问答会直接显示准备好的答案。
              </div>
            )}
            {pending?.error ? (
              <div className="mt-3 rounded-[7px] border border-danger/30 bg-danger/[.06] px-3 py-2 text-[12px] text-danger">
                {pending.error}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-ink-line/70 bg-[#0a0d12]/90 px-5 py-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <CornerDownLeft
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-mute"
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="手动输入问题，Enter 发送…"
              className="field h-[38px] w-full pl-8 text-[13px]"
            />
          </div>
          <button
            onClick={onSend}
            disabled={!input.trim() || sending}
            className={cn(
              'inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-btn border px-3 text-[12px] font-medium transition-colors',
              input.trim() && !sending
                ? 'border-brand/35 bg-brand/12 text-[#9cc0ff] hover:bg-brand/18'
                : 'border-ink-line bg-ink-panel text-txt-mute'
            )}
          >
            <CornerDownLeft size={11} />
            发送
          </button>
          <button
            onClick={onToggleAuto}
            className={cn(
              'inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-btn border px-3 text-[11.5px] transition-colors',
              autoAnswer
                ? 'border-ok/30 bg-ok/[.07] text-ok'
                : 'border-ink-line bg-ink-panel text-txt-mute hover:text-txt-dim'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', autoAnswer ? 'bg-ok' : 'bg-txt-mute')} />
            自动作答 {autoAnswer ? '开' : '关'}
          </button>
          <button
            onClick={onToggleSystem}
            disabled={systemBusy}
            className={cn(
              'inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-btn border px-3 text-[11.5px] transition-colors',
              systemOn
                ? 'border-danger/25 bg-danger/[.07] text-danger hover:bg-danger/[.12]'
                : 'border-ink-line bg-ink-panel text-txt-dim hover:border-ink-line2 hover:text-txt',
              systemBusy && 'cursor-wait opacity-65'
            )}
          >
            {systemBusy ? (
              <Loader2 size={11} className="animate-spin" />
            ) : systemOn ? (
              <Square size={10} fill="currentColor" />
            ) : (
              <Mic size={11} />
            )}
            {systemBusy ? '连接中…' : systemOn ? '停止监听' : '开始监听'}
          </button>
        </div>
      </footer>
    </div>
  );
}
