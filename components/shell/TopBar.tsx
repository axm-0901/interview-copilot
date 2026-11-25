'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, Command, Settings2, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';

const META: Record<string, { title: string; desc: string }> = {
  '/': { title: '工作台', desc: '准备 → 演练 → 实战 → 复盘，一条闭环' },
  '/profile': { title: '面试档案', desc: '简历、JD 与项目材料，是个人事实的来源' },
  '/qa': { title: '标准问答', desc: '提前写好题目、同义问法和答案，命中后原样显示' },
  '/skills': { title: '技能卡', desc: '把「我们做了」问成「我做了什么」，这是核心资产' },
  '/live': { title: '实战辅助', desc: '听题、判断题型、出答稿；经历题走材料，知识题走模型判断' },
  '/review': { title: '复盘', desc: '逐条点评，指出哪一句话让面试官起了疑心' },
  '/layout': { title: '布局演示', desc: '置顶、透明度、多显示器位置测试；共享屏幕时始终可见' },
};

export function TopBar({
  onOpenSettings,
  onOpenPalette,
}: {
  onOpenSettings: () => void;
  onOpenPalette: () => void;
}) {
  const pathname = usePathname();
  const { settings, activeId, profiles } = useApp();
  const key = Object.keys(META).find((k) => (k === '/' ? pathname === '/' : pathname.startsWith(k)));
  const meta = META[key ?? '/'];
  const demo = !settings.apiKey.trim();
  const active = profiles.find((p) => p.id === activeId);

  return (
    <header className="sticky top-0 z-40 flex h-[54px] shrink-0 items-center justify-between gap-3 border-b border-ink-line/60 bg-[#0b0e13]/78 px-3 backdrop-blur-md sm:gap-4 sm:px-5">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="shrink-0 text-[14.5px] font-semibold tracking-tight text-txt">{meta.title}</h1>
        <span className="hidden truncate text-[11.5px] text-txt-mute lg:block">{meta.desc}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          {demo ? (
            <Badge tone="warn" dot>
              演示模式
            </Badge>
          ) : (
            <Badge tone="ok" dot className="font-mono">
              {settings.model}
            </Badge>
          )}

          {active ? (
            <span className="hidden items-center gap-1.5 rounded-full border border-ink-line bg-ink-sub/70 px-2.5 py-[3px] text-[11px] text-txt-dim md:inline-flex">
              <Sparkles size={11} className="text-brand" />
              {active.round}
            </span>
          ) : null}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <IconButton onClick={onOpenPalette} title="命令面板 (Ctrl/Cmd + K)">
            <Command size={14} />
          </IconButton>
          <IconButton onClick={onOpenSettings} title="设置">
            <Settings2 size={14} />
          </IconButton>
        </div>

        <Link href="/live" className="hidden sm:block">
          <Button variant="primary" size="sm" className="ml-1">
            <Activity size={13} />
            开始本轮
            <ArrowUpRight size={12} className="opacity-70" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
