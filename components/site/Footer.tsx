import Link from 'next/link';
import { ArrowUpRight, Compass } from 'lucide-react';

const PRODUCT_LINKS = [
  { href: '/profile', label: '面试档案' },
  { href: '/qa', label: '标准问答' },
  { href: '/live', label: '实战辅助' },
  { href: '/review', label: '复盘' },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--s-line)]">
      <div className="s-wrap py-12 md:py-14">
        <div className="flex flex-col gap-9 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-gradient-to-br from-[#4d8dff] to-[#8b6bff] shadow-[0_8px_22px_-10px_rgba(77,141,255,0.95)]">
              <Compass size={16} strokeWidth={1.6} className="text-white/90" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[var(--s-txt)]">面试副驾</span>
                <span className="s-mono rounded-full border border-[var(--s-line)] px-1.5 py-[1px] text-[10px] text-[var(--s-mute)]">
                  v1.7.1
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--s-mute)]">本地优先 · 不做反检测</p>
            </div>
          </div>

          <nav
            className="grid grid-cols-2 gap-x-8 gap-y-2.5 md:flex md:items-center md:gap-7"
            aria-label="产品页面"
          >
            {PRODUCT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group inline-flex items-center gap-1 text-[12.5px] text-[var(--s-dim)] transition-colors hover:text-[var(--s-txt)]"
              >
                {l.label}
                <ArrowUpRight
                  size={16}
                  strokeWidth={1.6}
                  className="text-[var(--s-mute)] transition-colors group-hover:text-[var(--s-txt)]"
                />
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--s-line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="s-mono text-[11px] tracking-[0.02em] text-[var(--s-mute)]">
            面试副驾 · Copilot
          </p>
        </div>
      </div>
    </footer>
  );
}
