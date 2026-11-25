'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Layers,
  Monitor,
  Move,
  Pin,
  Play,
  RotateCcw,
  Square,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHead } from '@/components/ui/Panel';
import { Slider, Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/utils';
import type { DesktopDisplay, DesktopLayoutState, LayoutPosition } from '@/lib/types';

const POSITIONS: { value: LayoutPosition; label: string }[] = [
  { value: 'center', label: '居中' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-right', label: '右下' },
  { value: 'top-left', label: '左上' },
  { value: 'bottom-left', label: '左下' },
];

const POS_CLASS: Record<LayoutPosition, string> = {
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
  'top-right': 'right-3 top-3',
  'bottom-right': 'bottom-3 right-3',
  'top-left': 'left-3 top-3',
  'bottom-left': 'bottom-3 left-3',
};

export default function LayoutDemoPage() {
  const [desktop, setDesktop] = useState(false);
  const [displays, setDisplays] = useState<DesktopDisplay[]>([]);
  const [state, setState] = useState<DesktopLayoutState | null>(null);
  const [displayId, setDisplayId] = useState('');
  const [position, setPosition] = useState<LayoutPosition>('center');
  const [opacity, setOpacity] = useState(94);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const open = Boolean(state?.open);

  const refresh = useCallback(async () => {
    const api = window.copilotDesktop?.layout;
    if (!api) return;
    try {
      const next = await api.state();
      setState(next);
      if (next.displays?.length) {
        setDisplays(next.displays);
        setDisplayId((prev) => prev || next.primaryId || next.displays[0].id);
      }
    } catch {
      /* 窗口正在关闭时可能取不到状态 */
    }
  }, []);

  useEffect(() => {
    const api = window.copilotDesktop?.layout;
    if (!api) return;
    setDesktop(true);
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, [refresh]);

  const apply = useCallback(
    async (patch?: Partial<{ displayId: string; position: LayoutPosition; opacity: number; alwaysOnTop: boolean }>) => {
      const api = window.copilotDesktop?.layout;
      if (!api) {
        setMessage('这个功能只在桌面端可用；Web 版只能看布局预览。');
        return;
      }
      const opts = {
        displayId,
        position,
        opacity: opacity / 100,
        alwaysOnTop,
        ...patch,
      };
      setBusy(true);
      setMessage('');
      try {
        const next = open ? await api.apply(opts) : await api.open(opts);
        setState(next);
        setMessage(open ? '布局已应用' : '演示窗口已打开');
      } catch (e: any) {
        setMessage(String(e?.message ?? e).slice(0, 180));
      } finally {
        setBusy(false);
      }
    },
    [alwaysOnTop, displayId, open, opacity, position]
  );

  const close = async () => {
    const api = window.copilotDesktop?.layout;
    if (!api) return;
    setBusy(true);
    try {
      await api.close();
      await refresh();
      setMessage('演示窗口已关闭');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    const primary = displays.find((d) => d.primary)?.id ?? displays[0]?.id ?? '';
    setDisplayId(primary);
    setPosition('center');
    setOpacity(94);
    setAlwaysOnTop(true);
    setMessage('已恢复为：主屏居中 · 94% · 置顶');
    if (open) {
      void apply({ displayId: primary, position: 'center', opacity: 0.94, alwaysOnTop: true });
    }
  };

  const currentDisplay = useMemo(
    () => displays.find((d) => d.id === displayId),
    [displayId, displays]
  );

  return (
    <div className="mx-auto max-w-[1160px] space-y-4 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight text-txt">布局演示</h1>
            <Badge tone="ok" dot>
              共享中可见
            </Badge>
          </div>
          <p className="mt-1 max-w-[760px] text-[12px] leading-relaxed text-txt-mute">
            用来测试浮窗的置顶、透明度和多显示器位置。它不会隐藏，也不会从录屏/共享里消失；对面始终能看到这个窗口。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={reset} disabled={!desktop}>
            <RotateCcw size={14} />
            恢复默认
          </Button>
          {open ? (
            <Button variant="danger" size="md" onClick={() => void close()} loading={busy}>
              <Square size={13} />
              关闭演示窗
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={() => void apply()} loading={busy} disabled={!desktop}>
              <Play size={14} />
              打开演示窗口
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-card border border-warn/30 bg-warn/[.06] px-3 py-2 text-[11px] leading-relaxed text-[#f3cf8e]">
        <TriangleAlert size={12} className="mr-1.5 inline-block align-[-2px]" />
        这个页面只做窗口布局测试。面试平台通常会把整个桌面或指定窗口录进去，置顶、半透明都不会让窗口“消失”。
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHead title="窗口参数" desc="改完即时生效（桌面端）" icon={<Monitor size={14} />} />
            <div className="space-y-3.5 px-4 pb-4">
              <div>
                <label className="label">显示器</label>
                <select
                  className="field text-[12px]"
                  value={displayId}
                  onChange={(e) => {
                    setDisplayId(e.target.value);
                    if (open) void apply({ displayId: e.target.value });
                  }}
                  disabled={!desktop}
                >
                  {displays.length === 0 ? <option value="">未检测到显示器</option> : null}
                  {displays.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} · {d.width}×{d.height}
                    </option>
                  ))}
                </select>
                {currentDisplay ? (
                  <div className="mt-1 text-[10px] text-txt-mute">
                    {currentDisplay.primary ? '主显示器' : '副显示器'} · 缩放 {Math.round(currentDisplay.scaleFactor * 100)}%
                  </div>
                ) : null}
              </div>

              <div>
                <label className="label">停靠位置</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {POSITIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setPosition(p.value);
                        if (open) void apply({ position: p.value });
                      }}
                      className={cn(
                        'rounded-[7px] border px-2 py-1.5 text-[11px] transition-colors',
                        position === p.value
                          ? 'border-brand/40 bg-brand/12 text-[#9cc0ff]'
                          : 'border-ink-line bg-ink-sub text-txt-mute hover:border-ink-line2 hover:text-txt-dim'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="label mb-0">窗口透明度</label>
                  <span className="font-mono text-[11px] text-txt-dim">{opacity}%</span>
                </div>
                <Slider
                  value={opacity}
                  min={40}
                  max={100}
                  step={1}
                  onChange={(v) => {
                    setOpacity(v);
                    if (open) void apply({ opacity: v / 100 });
                  }}
                />
                <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                  透明度只影响你自己的观感，不会改变共享画面里的可见性。
                </div>
              </div>

              <div className="border-t border-ink-line/60 pt-3">
                <Switch
                  checked={alwaysOnTop}
                  onChange={(v) => {
                    setAlwaysOnTop(v);
                    if (open) void apply({ alwaysOnTop: v });
                  }}
                  label="窗口置顶"
                  desc="让演示窗浮在其他窗口上面，方便测试位置；共享屏幕时仍然可见。"
                />
              </div>

              {message ? (
                <div className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/60 px-2.5 py-2 text-[10.5px] leading-relaxed text-txt-dim">
                  {message}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void apply()} loading={busy} disabled={!desktop}>
                  {open ? <Move size={12} /> : <Play size={12} />}
                  {open ? '应用布局' : '打开演示窗口'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={!desktop}>
                  <RotateCcw size={12} />
                  刷新状态
                </Button>
              </div>
            </div>
          </Panel>

          <Panel className="px-4 py-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-txt">
              <Pin size={12} className="text-brand" />
              当前状态
            </div>
            <div className="space-y-1.5 text-[11px] text-txt-mute">
              <div className="flex justify-between gap-3">
                <span>演示窗</span>
                <span className={open ? 'text-ok' : 'text-txt-mute'}>{open ? '已打开' : '未打开'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>显示器</span>
                <span className="truncate text-txt-dim">{currentDisplay?.label ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>透明度 / 置顶</span>
                <span className="font-mono text-txt-dim">
                  {Math.round((state?.opacity ?? opacity / 100) * 100)}% · {state?.alwaysOnTop ?? alwaysOnTop ? '开' : '关'}
                </span>
              </div>
              {state?.bounds ? (
                <div className="flex justify-between gap-3">
                  <span>窗口坐标</span>
                  <span className="font-mono text-[10px] text-txt-dim">
                    {state.bounds.x},{state.bounds.y} · {state.bounds.width}×{state.bounds.height}
                  </span>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          <PanelHead
            title="模拟桌面"
            desc="虚线框是演示窗的预期位置；真实效果以桌面端为准"
            icon={<Layers size={14} />}
            right={<Badge tone="muted">对面可见</Badge>}
          />
          <div className="px-4 pb-4">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[12px] border border-ink-line2 bg-[#0a0d12]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(77,141,255,.12),transparent_35%),radial-gradient(circle_at_75%_80%,rgba(123,92,255,.1),transparent_35%)]" />
              <div className="absolute left-4 top-4 flex items-center gap-2 text-[10px] text-txt-mute">
                <Monitor size={11} />
                {currentDisplay?.label ?? '显示器'} · 共享画面示意
              </div>
              <div className="absolute inset-x-8 bottom-8 top-14 rounded-[8px] border border-dashed border-ink-line2/80" />
              <div
                className={cn(
                  'absolute w-[42%] rounded-[10px] border border-brand/40 bg-[#12161d]/95 p-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,.9)] transition-all duration-300',
                  POS_CLASS[position]
                )}
                style={{ opacity: opacity / 100 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-brand/15 px-1.5 py-px text-[9px] text-[#9cc0ff]">演示窗</span>
                  <span className="flex items-center gap-1 text-[9px] text-warn">
                    <Eye size={8} />
                    共享可见
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-medium text-txt">面试提示浮窗</div>
                <div className="mt-1 space-y-1 text-[9.5px] leading-relaxed text-txt-mute">
                  <div>先给结论，再讲两点依据。</div>
                  <div>项目题：背景 → 我的动作 → 结果。</div>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[10.5px] leading-relaxed text-txt-mute sm:grid-cols-3">
              <div className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/50 px-2.5 py-2">
                <span className="text-txt-dim">置顶</span> 只改变窗口层级
              </div>
              <div className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/50 px-2.5 py-2">
                <span className="text-txt-dim">透明度</span> 只影响你的观感
              </div>
              <div className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/50 px-2.5 py-2">
                <span className="text-txt-dim">多显示器</span> 用来测试摆放
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {!desktop ? (
        <div className="text-[11px] text-txt-mute">
          Web 版只能预览布局；要移动真实窗口，请在桌面客户端打开这个页面。
        </div>
      ) : null}
    </div>
  );
}
