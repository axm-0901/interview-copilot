'use client';

import { useRef } from 'react';
import { Camera, CornerDownLeft, Loader2, Radio, Sparkles, Trash2 } from 'lucide-react';
import { Segmented } from '@/components/ui/Tabs';
import { SourcePanel } from './SourcePanel';
import { cn } from '@/lib/utils';
import type { SessionMode } from '@/lib/types';

export interface TranscriptLine {
  id: string;
  text: string;
  final: boolean;
}

export function LiveConsole({
  mode,
  setMode,
  listening,
  onToggleMic,
  micSupported,
  transcript,
  interim,
  input,
  setInput,
  onSend,
  sending,
  onScreenshot,
  onPracticeAsk,
  generatingQ,
  autoAnswer,
  silenceMs,
  micMode,
  pttActive,
  hint,
  onToggleAuto,
  onClear,
  systemOn,
  systemLevel,
  systemBusy,
  asrReady,
  systemError,
  systemLatency,
  systemModel,
  systemInterim,
  onToggleSystem,
}: {
  mode: SessionMode;
  setMode: (m: SessionMode) => void;
  listening: boolean;
  onToggleMic: () => void;
  micSupported: boolean;
  transcript: TranscriptLine[];
  interim: string;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onScreenshot: () => void;
  onPracticeAsk: () => void;
  generatingQ: boolean;
  autoAnswer: boolean;
  silenceMs: number;
  micMode: 'always' | 'ptt';
  pttActive: boolean;
  hint: string;
  onToggleAuto: () => void;
  onClear: () => void;
  systemOn: boolean;
  systemLevel: number;
  systemBusy: boolean;
  asrReady: boolean;
  systemError: string;
  systemLatency?: number;
  systemModel?: string;
  systemInterim: string;
  onToggleSystem: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex min-w-0 flex-col rounded-panel border border-ink-line bg-ink-panel/70 xl:h-full xl:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ink-line/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-txt">
          <Radio size={12} className="text-brand" />
          控制台
        </div>
        <Segmented<SessionMode>
          value={mode}
          onChange={setMode}
          size="xs"
          items={[
            { value: 'assist', label: '辅助模式' },
            { value: 'practice', label: '练习模式' },
          ]}
        />
      </div>

      <SourcePanel
        systemOn={systemOn}
        systemLevel={systemLevel}
        systemBusy={systemBusy}
        asrReady={asrReady}
        systemError={systemError}
        systemLatency={systemLatency}
        systemModel={systemModel}
        micOn={listening}
        micSupported={micSupported}
        micMode={micMode}
        pttActive={pttActive}
        autoAnswer={autoAnswer}
        silenceMs={silenceMs}
        onToggleSystem={onToggleSystem}
        onToggleMic={onToggleMic}
        onToggleAuto={onToggleAuto}
      />

      {mode === 'practice' ? (
        <div className="shrink-0 px-3 pt-2">
          <button
            onClick={onPracticeAsk}
            disabled={generatingQ}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-violet/30 bg-brand-violet/10 px-2.5 py-[3px] text-[10.5px] text-[#b6a5ff] transition-colors hover:bg-brand-violet/16"
          >
            {generatingQ ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
            让面试官出下一题
          </button>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between px-3 pb-1 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-txt-mute">转录流</span>
        {transcript.length > 0 ? (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[10px] text-txt-mute transition-colors hover:text-txt-dim"
          >
            <Trash2 size={9} />
            清空
          </button>
        ) : null}
      </div>

      {hint ? (
        <div className="mx-3 mb-1 mt-1 shrink-0 rounded-[6px] border border-brand/25 bg-brand/[.06] px-2 py-1 text-[10px] leading-relaxed text-[#9cc0ff]">
          {hint}
        </div>
      ) : null}

      <div ref={boxRef} className="scroll-thin h-[30vh] min-h-[120px] max-h-[240px] overflow-y-auto px-3 py-1 xl:h-auto xl:min-h-[76px] xl:max-h-none xl:flex-1">
        {transcript.length === 0 && !interim && !systemInterim ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 py-4 text-center">
            <div className="text-[11px] text-txt-mute">
              {systemOn ? '等着听对方说话…' : '识别到的内容会实时出现在这里'}
            </div>
            <div className="text-[10px] text-txt-mute/60">
              {systemOn ? '对方的声音会直接进这里，不需要你开口' : '中间结果用斜体显示，final 后转正体'}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {transcript.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'rounded-[7px] border px-2 py-1.5 text-[11.5px] leading-relaxed',
                  t.final
                    ? 'border-ink-line/60 bg-[#0e131a]/60 text-txt-dim'
                    : 'border-ink-line/40 bg-transparent italic text-txt-mute'
                )}
              >
                {t.text}
              </div>
            ))}
            {systemInterim ? (
              <div className="rounded-[7px] border border-ok/25 bg-ok/[.05] px-2 py-1.5 text-[11.5px] italic leading-relaxed text-[#bfe8d6]">
                <span className="mr-1 not-italic text-[9px] text-ok/80">对方</span>
                {systemInterim}
                <span className="ml-1 inline-block h-[10px] w-[2px] animate-breathe bg-ok align-middle" />
              </div>
            ) : null}
            {interim ? (
              <div className="rounded-[7px] border border-dashed border-brand/25 bg-brand/[.04] px-2 py-1.5 text-[11.5px] italic leading-relaxed text-[#9cc0ff]/80">
                {interim}
                <span className="ml-1 inline-block h-[10px] w-[2px] animate-breathe bg-[#9cc0ff] align-middle" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-ink-line/60 p-2.5">
        <div className="rounded-card border border-ink-line bg-[#0e131a] px-2.5 py-2 transition-colors focus-within:border-brand/50">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder={
              systemOn
                ? '对方的话会自动转成文字出现在这里，也可以手动修正后重发…'
                : mode === 'practice'
                ? '用文字作答，或点上方麦克风说出来…'
                : '识别错了可以在这里改，也可以直接手动输入问题…'
            }
            className="w-full resize-none bg-transparent text-[12px] leading-relaxed text-txt placeholder:text-txt-mute/70 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={onScreenshot}
                className="inline-flex items-center gap-1 rounded-[5px] px-1.5 py-[3px] text-[10.5px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
              >
                <Camera size={10} />
                截图解题
              </button>
              <span className="kbd">⌘⇧S</span>
            </div>
            <button
              onClick={onSend}
              disabled={!input.trim() || sending}
              className={cn(
                'inline-flex items-center gap-1 rounded-[6px] px-2 py-[3px] text-[10.5px] font-medium transition-colors',
                input.trim() && !sending
                  ? 'bg-[linear-gradient(97deg,#4d8dff,#7b5cff)] text-white'
                  : 'bg-white/[.05] text-txt-mute'
              )}
            >
              {sending ? <Loader2 size={10} className="animate-spin" /> : <CornerDownLeft size={10} />}
              {mode === 'practice' ? '提交作答' : '出答稿'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
