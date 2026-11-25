'use client';

import { Lock, Maximize2, Square, Timer, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fmtTime } from '@/lib/utils';
import type { SessionMode, Snapshot } from '@/lib/types';

export function LiveHeader({
  mode,
  listening,
  snap,
  startedAt,
  lastLatency,
  fastModel,
  onScreenshot,
  onFocus,
  onEnd,
}: {
  mode: SessionMode;
  listening: boolean;
  snap: Snapshot | null;
  startedAt: number;
  lastLatency?: number;
  fastModel?: string;
  onScreenshot: () => void;
  onFocus: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-txt">实战辅助</h2>
          <Badge tone={mode === 'practice' ? 'violet' : 'brand'} dot>
            {mode === 'practice' ? '练习模式' : '辅助模式'}
          </Badge>
          {snap?.profile?.company ? (
            <Badge tone="muted">{snap.profile.company}</Badge>
          ) : null}
          {listening ? <Badge tone="danger">正在监听</Badge> : null}
          {fastModel ? (
            <Badge tone="ok">
              <Zap size={9} />
              极速 · {fastModel.replace(/^cn:/, '')}
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-txt-mute">
          <span className="inline-flex items-center gap-1">
            <Lock size={9} />
            本轮快照：{snap?.label ?? '—'}
          </span>
          <span className="hidden h-[2px] w-[2px] rounded-full bg-txt-mute/60 sm:block" />
          <span>开始于 {fmtTime(startedAt)}</span>
          {lastLatency ? (
            <>
              <span className="hidden h-[2px] w-[2px] rounded-full bg-txt-mute/60 sm:block" />
              <span className="inline-flex items-center gap-1">
                <Timer size={9} />
                首字 {lastLatency}ms
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'assist' ? (
          <Button variant="primary" size="sm" onClick={onFocus}>
            <Maximize2 size={11} />
            专注模式
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onScreenshot}>
          <Square size={11} />
          截图解题
        </Button>
        <Button variant="danger" size="sm" onClick={onEnd}>
          结束本轮
        </Button>
      </div>
    </div>
  );
}
