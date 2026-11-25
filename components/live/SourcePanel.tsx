'use client';

import { AlertTriangle, Headphones, Mic, MicOff, Radio, Volume2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

function Row({
  icon,
  title,
  meta,
  on,
  disabled,
  onClick,
  meter,
  error,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  meter?: number;
  error?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-[8px] border px-2.5 py-2 text-left transition-colors',
        on
          ? 'border-ok/40 bg-ok/[.07]'
          : 'border-ink-line bg-[#0e131a]/60 hover:border-ink-line2 hover:bg-white/[.025]',
        disabled && 'cursor-not-allowed opacity-55'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('shrink-0', on ? 'text-ok' : 'text-txt-mute')}>{icon}</span>
        <span className={cn('flex-1 text-[11.5px] font-medium', on ? 'text-txt' : 'text-txt-dim')}>
          {title}
        </span>
        <span className="shrink-0 text-[9.5px] text-txt-mute">{meta}</span>
        <span
          className={cn(
            'h-[5px] w-[5px] shrink-0 rounded-full',
            on ? 'bg-ok shadow-[0_0_0_2px_rgba(53,197,138,.18)]' : 'bg-txt-mute/45'
          )}
        />
      </div>
      {typeof meter === 'number' ? (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/[.06]">
          <div
            className="h-full rounded-full bg-ok transition-[width] duration-100"
            style={{ width: `${Math.min(100, meter * 520)}%` }}
          />
        </div>
      ) : null}
      {error ? (
        <div className="mt-1 flex items-start gap-1 text-[9.5px] leading-relaxed text-danger">
          <AlertTriangle size={9} className="mt-[2px] shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </button>
  );
}

export function SourcePanel({
  systemOn,
  systemLevel,
  systemBusy,
  asrReady,
  systemError,
  systemLatency,
  systemModel,
  micOn,
  micSupported,
  micMode,
  pttActive,
  autoAnswer,
  silenceMs,
  onToggleSystem,
  onToggleMic,
  onToggleAuto,
}: {
  systemOn: boolean;
  systemLevel: number;
  systemBusy: boolean;
  asrReady: boolean;
  systemError: string;
  systemLatency?: number;
  systemModel?: string;
  micOn: boolean;
  micSupported: boolean;
  micMode: 'always' | 'ptt';
  pttActive: boolean;
  autoAnswer: boolean;
  silenceMs: number;
  onToggleSystem: () => void;
  onToggleMic: () => void;
  onToggleAuto: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-ink-line/50 px-3 py-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[.14em] text-txt-mute">
        <Radio size={9} />
        收音源
      </div>

      <div className="space-y-1.5">
        <Row
          icon={<Volume2 size={13} />}
          title="对方声音"
          meta={
            !asrReady ? '需配置 ASR' : systemBusy ? '连接中…' : systemOn ? '系统音频' : '未开启'
          }
          on={systemOn}
          onClick={onToggleSystem}
          meter={systemOn ? systemLevel : undefined}
          error={systemError}
        />
        <Row
          icon={micSupported ? <Mic size={13} /> : <MicOff size={13} />}
          title="我的声音"
          meta={!micSupported ? '不可用' : micOn ? '麦克风' : '未开启'}
          on={micOn}
          disabled={!micSupported}
          onClick={onToggleMic}
        />
      </div>

      <div className="mt-2 flex items-center justify-between rounded-[6px] border border-ink-line/60 bg-[#0e131a]/50 px-2 py-1">
        <button onClick={onToggleAuto} className="inline-flex items-center gap-1.5 text-[10px]">
          <span className={cn('h-[5px] w-[5px] rounded-full', autoAnswer ? 'bg-ok' : 'bg-txt-mute/60')} />
          <span className={autoAnswer ? 'text-txt-dim' : 'text-txt-mute'}>
            自动作答 {autoAnswer ? '开' : '关'}
          </span>
        </button>
        <span className="text-[9.5px] text-txt-mute">
          {micMode === 'ptt' ? '推按拾音' : '常开拾音'}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-[9.5px] leading-relaxed text-txt-mute">
        {systemOn ? (
          <>
            <Headphones size={9} className="shrink-0" />
            只收电脑里放出来的声音，不含你的麦克风
          </>
        ) : micMode === 'ptt' ? (
          <>
            <Mic size={9} className="shrink-0" />
            按住空格说话，松开 {silenceMs / 1000}s 后作答
          </>
        ) : (
          <>
            <Mic size={9} className="shrink-0" />
            麦克风会同时收到你和扬声器，建议开「对方声音」
          </>
        )}
      </div>
      {systemOn && systemModel ? (
        <div className="mt-1 flex items-center gap-1 text-[9.5px] text-ok/80">
          <Zap size={9} className="shrink-0" />
          转写 {systemModel}
          {systemLatency ? ` · 上次 ${systemLatency}ms` : ' · 边说边出字'}
        </div>
      ) : null}
      {pttActive ? (
        <div className="mt-1 rounded-[6px] border border-danger/30 bg-danger/[.08] px-2 py-1 text-[9.5px] text-danger">
          正在收音…
        </div>
      ) : null}
    </div>
  );
}
