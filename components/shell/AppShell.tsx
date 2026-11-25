'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { SettingsDialog } from './SettingsDialog';
import { CommandPalette } from './CommandPalette';
import { ToastHost } from './ToastHost';
import { useApp } from '@/lib/store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ready = useApp((s) => s.ready);
  const boot = useApp((s) => s.boot);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 布局演示窗口是一个独立浮窗，不显示侧栏/顶栏，也不参与业务导航
  if (pathname === '/layout-stage') {
    return <div className="min-h-screen bg-[#0b0e13]">{children}</div>;
  }

  // 营销页是一张独立落地页，用自己的导航与视觉，不套工作台外壳
  if (pathname === '/site') {
    return <div className="min-h-screen bg-[#07080c]">{children}</div>;
  }

  // 手机练习端：独立全屏，不套桌面侧栏/顶栏
  if (pathname === '/m') {
    return <div className="min-h-screen bg-[#07080c]">{children}</div>;
  }

  return (
    <div className="relative z-[1] flex h-screen overflow-hidden">
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav onOpenSettings={() => setSettingsOpen(true)} />
        <TopBar onOpenSettings={() => setSettingsOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {ready ? (
            children
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[13px] bg-[linear-gradient(135deg,#4d8dff,#7b5cff)] shadow-[0_10px_30px_-12px_rgba(77,141,255,.9)]">
                <Sparkles size={19} className="animate-breathe text-white" />
              </div>
              <div className="text-[12.5px] text-txt-mute">正在读取本地档案…</div>
            </div>
          )}
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ToastHost />
    </div>
  );
}
