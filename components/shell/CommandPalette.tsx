'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BookOpenCheck,
  Database,
  FileText,
  MessageSquareText,
  LayoutDashboard,
  Monitor,
  Search,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { useApp } from '@/lib/store';
import { seedSample } from '@/lib/sample';
import { toast } from '@/lib/toast';

export function CommandPalette({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const router = useRouter();
  const { createProfile, activeId, refreshActive } = useApp();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () => [
      { id: 'dash', label: '去工作台', hint: '总览与下一步', icon: LayoutDashboard, run: () => router.push('/') },
      { id: 'profile', label: '去面试档案', hint: '简历 / JD / 项目材料', icon: FileText, run: () => router.push('/profile') },
      { id: 'qa', label: '去标准问答', hint: '命中即答', icon: MessageSquareText, run: () => router.push('/qa') },
      { id: 'live', label: '去实战辅助', hint: '开始或继续一轮', icon: Activity, run: () => router.push('/live') },
      { id: 'review', label: '去复盘', hint: '逐条点评', icon: BookOpenCheck, run: () => router.push('/review') },
      {
        id: 'layout',
        label: '窗口布局演示',
        hint: '置顶 / 透明度 / 多显示器（共享中可见）',
        icon: Monitor,
        run: () => router.push('/layout'),
      },
      {
        id: 'settings',
        label: '打开设置',
        hint: 'API Base / Key / 模型',
        icon: Settings2,
        run: () => onOpenSettings(),
      },
      {
        id: 'seed',
        label: '载入示例档案',
        hint: '一份后端简历 + JD + 6 道标准问答',
        icon: Database,
        run: async () => {
          const p = await seedSample();
          await useApp.getState().refreshProfiles();
          await useApp.getState().setActive(p.id);
          toast('示例档案已载入', 'ok', '可以去「标准问答」看看命中后怎么直接出答案');
          router.push('/');
        },
      },
      {
        id: 'newprofile',
        label: '新建一份空档案',
        hint: '从零开始',
        icon: Sparkles,
        run: async () => {
          await createProfile({
            name: '我的面试档案',
            targetRole: '',
            company: '',
            round: '一面',
            lang: '中文',
          });
          toast('档案已创建', 'ok', '先上传简历和 JD');
          router.push('/profile');
        },
      },
    ],
    [router, onOpenSettings, createProfile]
  );

  const filtered = commands.filter(
    (c) => !q.trim() || `${c.label}${c.hint}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const c = filtered[idx];
        if (c) {
          onClose();
          void c.run();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, idx, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  return (
    <Dialog open={open} onClose={onClose} title="命令面板" width="sm">
      <div className="-mx-1 -mt-1">
        <div className="flex items-center gap-2 rounded-btn border border-ink-line bg-[#0e131a] px-2.5 py-2">
          <Search size={14} className="text-txt-mute" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索页面或动作…"
            className="w-full bg-transparent text-[13px] text-txt placeholder:text-txt-mute/70 focus:outline-none"
          />
          <span className="kbd">ESC</span>
        </div>

        <div ref={listRef} className="mt-2 max-h-[320px] space-y-[2px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-[12px] text-txt-mute">没有匹配的命令</div>
          ) : (
            filtered.map((c, i) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  data-i={i}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    onClose();
                    void c.run();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left transition-colors',
                    i === idx ? 'bg-brand/12 text-txt' : 'text-txt-dim hover:bg-white/[.04]'
                  )}
                >
                  <Icon size={14} className={i === idx ? 'text-[#8db6ff]' : 'text-txt-mute'} />
                  <span className="flex-1 text-[12.5px]">{c.label}</span>
                  <span className="text-[10.5px] text-txt-mute">{c.hint}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
