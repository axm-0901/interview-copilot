'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpenCheck,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: '工作台', icon: LayoutDashboard },
  { href: '/profile', label: '档案', icon: FileText },
  { href: '/qa', label: '问答', icon: MessageSquareText },
  { href: '/live', label: '实战', icon: Activity },
  { href: '/review', label: '复盘', icon: BookOpenCheck },
];

export function MobileNav({ onOpenSettings }: { onOpenSettings: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 border-b border-ink-line/60 bg-[#0a0d12]/90 px-2 py-1.5 lg:hidden">
      <div className="mr-1 flex items-center gap-1.5 px-1">
        <div className="grid h-[22px] w-[22px] place-items-center rounded-[6px] bg-[linear-gradient(135deg,#4d8dff,#7b5cff)]">
          <MessageSquareText size={11} className="text-white" />
        </div>
      </div>
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-[7px] px-1 py-1 transition-colors',
              active ? 'bg-brand/12 text-[#9cc0ff]' : 'text-txt-mute'
            )}
          >
            <Icon size={14} />
            <span className="text-[9.5px] leading-none">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onOpenSettings}
        className="ml-0.5 grid h-8 w-8 place-items-center rounded-[7px] text-txt-mute"
        aria-label="设置"
      >
        <Settings2 size={14} />
      </button>
    </div>
  );
}
