'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 滚动进入视口后淡入。默认只触发一次。 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'span' | 'p';
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`s-reveal ${seen ? 'is-in' : ''} ${className}`}
      style={{ ['--s-delay' as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** 数字滚动，进入视口才跑。 */
export function useCountUp(target: number, duration = 1400, decimals = 0) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    let started = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const tick = (t: number) => {
          if (!started) started = t;
          const p = Math.min(1, (t - started) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Number((target * eased).toFixed(decimals)));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration, decimals]);

  return { ref, value };
}

/** 逐字打字机。visible=false 时直接显示全文（减少动效情形）。 */
export function useTypewriter(text: string, active: boolean, speed = 22) {
  const [out, setOut] = useState('');

  useEffect(() => {
    if (!active) {
      setOut('');
      return;
    }
    if (reduceMotion()) {
      setOut(text);
      return;
    }
    setOut('');
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, active, speed]);

  return out;
}

export function SectionHead({
  index,
  kicker,
  title,
  lead,
  align = 'left',
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-[760px] text-center' : 'max-w-[780px]'}>
      <Reveal>
        <div className={`s-eyebrow ${align === 'center' ? 'justify-center' : ''}`}>
          <span className="text-[#6f9dff]">{index}</span>
          <span className="text-[#2e3948]">/</span>
          <span>{kicker}</span>
        </div>
      </Reveal>
      <Reveal delay={90}>
        <h2 className="s-h2 mt-4 text-balance">{title}</h2>
      </Reveal>
      {lead ? (
        <Reveal delay={160}>
          <p className="s-lead mt-4 max-w-[680px]">{lead}</p>
        </Reveal>
      ) : null}
    </div>
  );
}

/** 带编号的细标尺，用于小节。 */
export function NumTag({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="s-mono text-[10.5px] text-[#4d8dff]">{n}</span>
      <span className="h-px w-5 bg-[#2a3442]" />
      <span className="text-[11.5px] tracking-[0.08em] text-[#97a1b2]">{children}</span>
    </div>
  );
}
