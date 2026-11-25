'use client';

import { useEffect, useState } from 'react';
import { Eye, Monitor, X } from 'lucide-react';
import type { DesktopLayoutState } from '@/lib/types';

/**
 * 布局演示浮窗。
 * 这是给「置顶 / 透明度 / 多显示器」测试用的示例窗口，
 * 不做任何捕获排除：共享屏幕时它会被完整看到。
 */
export default function LayoutStagePage() {
  const [state, setState] = useState<DesktopLayoutState | null>(null);

  useEffect(() => {
    const api = window.copilotDesktop?.layout;
    if (!api) return;
    let alive = true;
    const tick = async () => {
      try {
        const next = await api.state();
        if (alive) setState(next);
      } catch {
        /* ignore */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 1200);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const display = state?.displays.find((d) => d.id === state.displayId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b0e13] text-txt">
      <div className="flex items-start justify-between gap-3 border-b border-ink-line/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-[7px] bg-brand/12 text-brand">
            <Monitor size={13} />
          </div>
          <div>
            <div className="text-[12.5px] font-semibold">布局演示窗口</div>
            <div className="text-[10px] text-txt-mute">置顶 / 透明度 / 多显示器测试</div>
          </div>
        </div>
        <button
          onClick={() => void window.copilotDesktop?.layout.close()}
          className="rounded-[6px] p-1.5 text-txt-mute transition-colors hover:bg-white/[.06] hover:text-txt"
          title="关闭演示窗口"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between px-4 py-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/[.07] px-2 py-1 text-[10px] text-ok">
            <Eye size={10} />
            共享屏幕时对面可见
          </div>
          <h1 className="mt-3 text-[18px] font-semibold leading-snug">
            这是一块面试提示浮窗
          </h1>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-txt-mute">
            它只用来测试窗口的置顶、透明度和多显示器位置，不会被隐藏，也不会从录屏或共享画面里消失。
          </p>
        </div>

        <div className="rounded-[10px] border border-ink-line/80 bg-[#12161d] p-3">
          <div className="text-[10px] uppercase tracking-[.12em] text-txt-mute">示例提示</div>
          <div className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-txt-dim">
            <div>先给结论，再讲两点依据。</div>
            <div>项目题：背景 → 我的动作 → 结果与取舍。</div>
            <div>不会的题：先说不确定，再给判断过程。</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-txt-mute">
          <span>
            {display?.label ?? '当前显示器'} · 透明度{' '}
            {Math.round((state?.opacity ?? 1) * 100)}% · {state?.alwaysOnTop ? '置顶' : '不置顶'}
          </span>
          <span className="font-mono text-[9.5px] text-txt-mute/70">layout stage</span>
        </div>
      </div>
    </div>
  );
}
