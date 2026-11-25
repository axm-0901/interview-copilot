'use client';

import Link from 'next/link';
import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowUpRight, Compass, Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#pain', label: '痛点' },
  { href: '#how', label: '机制' },
  { href: '#loop', label: '闭环' },
  { href: '#listen', label: '听题' },
  { href: '#features', label: '能力' },
  { href: '#boundary', label: '边界' },
];

const NAV_OFFSET = 64;

export function Nav() {
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
      setScrolled(y > 8);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [open]);

  const go = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.querySelector<HTMLElement>(href);
    if (!el) return;
    e.preventDefault();
    setOpen(false);
    if (!parseFloat(window.getComputedStyle(el).scrollMarginTop || '0')) {
      el.style.scrollMarginTop = `${NAV_OFFSET}px`;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scroll = () =>
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (open) window.requestAnimationFrame(scroll);
    else scroll();
    window.history.replaceState(null, '', href);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? 'border-[var(--s-line)] bg-[rgba(7,8,12,0.72)] backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div
        className="s-progress"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />

      <div className="s-wrap flex h-16 items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="面试副驾 · 工作台">
          <span className="grid h-7 w-7 place-items-center rounded-[7px] bg-gradient-to-br from-[#4d8dff] to-[#8b6bff] shadow-[0_8px_22px_-10px_rgba(77,141,255,0.95)]">
            <Compass size={16} strokeWidth={1.6} className="text-white/90" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[14.5px] font-medium tracking-[-0.01em] text-[var(--s-txt)]">
              面试副驾
            </span>
            <span className="s-mono mt-1 text-[8.5px] tracking-[0.3em] text-[var(--s-mute)]">
              COPILOT
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="页面锚点">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={go(l.href)}
              className="relative px-3 py-2 text-[13px] text-[var(--s-dim)] transition-colors hover:text-[var(--s-txt)] after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-[#4d8dff] after:to-[#8b6bff] after:transition-transform after:duration-300 hover:after:scale-x-100"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden lg:block">
            <Link href="/" className="s-btn s-btn-primary s-btn-sm">
              打开工作台
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-nav-panel"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-[var(--s-line2)] bg-[rgba(13,16,22,0.7)] text-[var(--s-dim)] transition-colors hover:text-[var(--s-txt)] lg:hidden"
          >
            {open ? <X size={18} strokeWidth={1.6} /> : <Menu size={18} strokeWidth={1.6} />}
          </button>
        </div>
      </div>

      <div
        id="site-nav-panel"
        className={`overflow-hidden bg-[rgba(7,8,12,0.97)] backdrop-blur-xl transition-all duration-300 ease-out lg:hidden ${
          open ? 'max-h-[480px] border-t border-[var(--s-line)] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="s-wrap pb-5 pt-2">
          <nav className="flex flex-col" aria-label="移动端锚点">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={go(l.href)}
                tabIndex={open ? 0 : -1}
                className="flex items-center justify-between border-b border-[var(--s-line)] py-3 text-[14px] text-[var(--s-dim)] transition-colors hover:text-[var(--s-txt)]"
              >
                {l.label}
                <span className="s-mono text-[10px] text-[var(--s-mute)]">{l.href}</span>
              </a>
            ))}
          </nav>
          <Link
            href="/"
            tabIndex={open ? 0 : -1}
            className="s-btn s-btn-primary mt-4 w-full"
          >
            打开工作台
            <ArrowUpRight size={16} strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    </header>
  );
}
