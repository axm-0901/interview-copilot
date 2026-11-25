'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpenCheck,
  ChevronDown,
  FileText,
  Globe2,
  LayoutDashboard,
  MessageSquareText,
  Monitor,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/Badge';

const NAV = [
  { href: '/', label: '工作台', icon: LayoutDashboard, hint: '总览' },
  { href: '/profile', label: '面试档案', icon: FileText, hint: '简历 / JD' },
  { href: '/qa', label: '标准问答', icon: MessageSquareText, hint: '命中即答' },
  { href: '/live', label: '实战辅助', icon: Activity, hint: '听题作答' },
  { href: '/review', label: '复盘', icon: BookOpenCheck, hint: '逐场点评' },
  { href: '/layout', label: '布局演示', icon: Monitor, hint: '置顶 / 透明 / 多屏' },
];

export function Sidebar({
  onOpenSettings,
  onOpenPalette,
}: {
  onOpenSettings: () => void;
  onOpenPalette: () => void;
}) {
  const pathname = usePathname();
  const { profiles, activeId, setActive, qas, settings, sessions } = useApp();
  const active = profiles.find((p) => p.id === activeId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const qaCount = qas.length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <aside className="hidden h-full w-[236px] shrink-0 flex-col border-r border-ink-line/70 bg-[#0a0d12]/80 lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="relative grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-[linear-gradient(135deg,#4d8dff,#7b5cff)] shadow-[0_6px_18px_-8px_rgba(77,141,255,.9)]">
          <Sparkles size={15} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-semibold tracking-tight text-txt">Copilot</div>
          <div className="text-[10.5px] tracking-[.16em] text-txt-mute">面试副驾</div>
        </div>
      </div>

      <div className="px-3">
        <div className="mb-1.5 mt-3 px-1 text-[10.5px] font-semibold uppercase tracking-[.16em] text-txt-mute/80">
          工作流
        </div>
        <nav className="flex flex-col gap-[2px]">
          {NAV.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex h-[34px] items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] transition-colors',
                  isActive
                    ? 'bg-[linear-gradient(97deg,rgba(77,141,255,.14),rgba(123,92,255,.1))] font-medium text-txt'
                    : 'text-txt-dim hover:bg-white/[.04] hover:text-txt'
                )}
              >
                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-[15px] w-[2px] -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,#4d8dff,#7b5cff)]" />
                ) : null}
                <Icon
                  size={15}
                  className={cn(isActive ? 'text-[#8db6ff]' : 'text-txt-mute group-hover:text-txt-dim')}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === '/qa' && qaCount ? (
                  <span className="rounded-full bg-ok/15 px-1.5 py-px text-[10px] font-medium text-ok">
                    {qaCount}
                  </span>
                ) : (
                  <span className="text-[10px] text-txt-mute/0 transition-colors group-hover:text-txt-mute/70">
                    {item.hint}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 px-3">
        <div className="rounded-card border border-ink-line/70 bg-ink-panel/60 p-2.5">
          <div className="flex items-center justify-between text-[10.5px] tracking-wide text-txt-mute">
            <span>本轮上下文</span>
            <span className="font-mono">
              {qaCount} 题 / {sessions.length} 场
            </span>
          </div>
          <div className="mt-2 flex items-center gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-[3px] flex-1 rounded-full',
                  i < Math.min(12, qaCount)
                    ? 'bg-[linear-gradient(90deg,#4d8dff,#7b5cff)]'
                    : 'bg-white/[.07]'
                )}
              />
            ))}
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-txt-mute">
            {qaCount === 0
              ? '还没有标准问答，答稿只能靠模型现场生成'
              : `${qaCount} 道标准问答已就绪`}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="px-3 pb-3">
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-card border border-ink-line/70 bg-ink-panel/70 p-2.5 text-left transition-colors hover:border-ink-line2 hover:bg-ink-panel"
          >
            <div className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] border border-brand/25 bg-[linear-gradient(135deg,rgba(77,141,255,.25),rgba(123,92,255,.2))] text-[11px] font-semibold text-[#a8c6ff]">
              {(active?.name ?? '未').slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-txt">
                {active?.name ?? '未绑定档案'}
              </div>
              <div className="truncate text-[10.5px] text-txt-mute">
                {active ? `${active.targetRole || '未填岗位'} · ${active.round}` : '先去建一份档案'}
              </div>
            </div>
            <ChevronDown
              size={13}
              className={cn('shrink-0 text-txt-mute transition-transform', open && 'rotate-180')}
            />
          </button>

          {open && profiles.length > 0 ? (
            <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-full overflow-hidden rounded-card border border-ink-line bg-ink-panel shadow-pop">
              <div className="max-h-[220px] overflow-y-auto p-1">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActive(p.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left transition-colors hover:bg-white/[.05]',
                      p.id === activeId && 'bg-brand/10'
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-txt-dim">{p.name}</span>
                    {p.id === activeId ? <span className="text-[10px] text-brand">当前</span> : null}
                  </button>
                ))}
              </div>
              <Link
                href="/profile?new=1"
                onClick={() => {
                  setOpen(false);
                  // 已经停在 /profile 时 Link 不会重挂载，用事件直接打开弹窗
                  window.dispatchEvent(new Event('profile:new'));
                }}
                className="block border-t border-ink-line/70 px-3 py-2 text-[11.5px] text-txt-mute hover:text-txt"
              >
                + 新建档案
              </Link>
            </div>
          ) : null}
        </div>

        <Link
          href="/profile?new=1"
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new Event('profile:new'));
          }}
          className="mt-2 flex h-[28px] items-center gap-1.5 rounded-[7px] px-2 text-[11px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
        >
          <span className="text-[13px] leading-none">＋</span>
          新建面试档案
        </Link>

        <div className="mt-2 flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="flex h-[28px] flex-1 items-center gap-2 rounded-[7px] px-2 text-[11.5px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
          >
            <Settings2 size={13} />
            设置
          </button>
          <button
            onClick={onOpenPalette}
            className="flex h-[28px] items-center gap-1.5 rounded-[7px] px-2 text-[11.5px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
          >
            <span className="kbd">⌘K</span>
          </button>
        </div>

        <Link
          href="/site"
          className="mt-1 flex h-[28px] items-center gap-2 rounded-[7px] px-2 text-[11.5px] text-txt-mute transition-colors hover:bg-white/[.05] hover:text-txt-dim"
        >
          <Globe2 size={13} />
          产品介绍
        </Link>

        <button
          onClick={onOpenSettings}
          className="mt-1 flex w-full items-center gap-1.5 rounded-[7px] px-2 py-1 text-[10.5px] text-txt-mute transition-colors hover:text-txt-dim"
        >
          <StatusDot state={settings.apiKey.trim() ? 'on' : 'warn'} />
          {settings.apiKey.trim() ? (
            <span className="truncate font-mono">{settings.model}</span>
          ) : (
            <span>演示模式 · 未配置 Key</span>
          )}
        </button>
      </div>
    </aside>
  );
}
