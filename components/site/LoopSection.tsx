'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ClipboardCheck, FileText, ListChecks, Radio, type LucideIcon } from 'lucide-react';
import { Reveal, SectionHead } from '@/components/site/primitives';

type Step = {
  n: string;
  route: string;
  title: string;
  points: string[];
  icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    n: '01',
    route: '/profile',
    title: '面试档案',
    points: ['简历、JD、项目材料切块索引', '岗位对齐洞察：这场真正考什么、你的风险点、必问 5 题'],
    icon: FileText,
  },
  {
    n: '02',
    route: '/qa',
    title: '标准问答',
    points: ['题目 + 同义问法 + 完整答案，命中后原样显示', 'GPT 生成的 70~80 题可直接导入，同题只合并问法'],
    icon: ListChecks,
  },
  {
    n: '03',
    route: '/live',
    title: '实战辅助',
    points: ['听题、命中、模型兜底、截图解题', '开始本轮即冻结快照，中途改动下一轮才生效'],
    icon: Radio,
  },
  {
    n: '04',
    route: '/review',
    title: '复盘',
    points: ['逐条给分、致命伤、30 秒改写、一句口诀', '短板分布与上一场对比，可导出 Markdown'],
    icon: ClipboardCheck,
  },
];

export function LoopSection() {
  const [active, setActive] = useState(0);
  const items = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const nodes = items.current.filter((n): n is HTMLLIElement => n !== null);
    if (!nodes.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = nodes.indexOf(e.target as HTMLLIElement);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: '-40% 0px -42% 0px', threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <section id="loop" className="relative scroll-mt-24">
      <div className="s-wrap">
        <div className="s-hairline" />
        <div className="py-[72px] md:py-[120px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-16">
            <div>
              <div className="lg:sticky lg:top-28">
                <SectionHead index="04" kicker="闭环 · 四步" title="一场面试，从准备到复盘只走一遍。" />
                <Reveal delay={200}>
                  <blockquote className="mt-8 border-l border-[var(--s-line2)] pl-4 text-[13.5px] leading-[1.9] text-[var(--s-dim)]">
                    让准备好的东西，在需要的那一刻原样出现。
                  </blockquote>
                </Reveal>
                <Reveal delay={260}>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <span className="s-pill">
                      <ArrowDownRight size={16} strokeWidth={1.6} />
                      四步只需走一遍
                    </span>
                    <span className="s-mono text-[11px] text-[var(--s-mute)]">/profile → /qa → /live → /review</span>
                  </div>
                </Reveal>
              </div>
            </div>

            <ol className="relative space-y-5">
              <span aria-hidden className="absolute bottom-3 left-[15.5px] top-3 w-px bg-[var(--s-line)]" />
              {STEPS.map((step, i) => {
                const on = active === i;
                const Icon = step.icon;
                return (
                  <li
                    key={step.route}
                    ref={(node) => {
                      items.current[i] = node;
                    }}
                    className="relative pl-12 md:pl-14"
                  >
                    <span
                      aria-hidden
                      className="absolute left-[15.5px] top-0 h-full w-px"
                      style={{
                        background: on
                          ? 'linear-gradient(180deg, rgba(77, 141, 255, 0), rgba(77, 141, 255, 0.85) 16%, rgba(139, 107, 255, 0.55) 84%, rgba(139, 107, 255, 0))'
                          : 'transparent',
                        boxShadow: on ? '0 0 14px rgba(77, 141, 255, 0.5)' : 'none',
                        transition: 'box-shadow 0.3s ease',
                      }}
                    />
                    <span
                      className="s-mono absolute left-0 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border text-[10.5px] transition-all duration-300"
                      style={
                        on
                          ? {
                              borderColor: '#4d8dff',
                              color: '#cfe0ff',
                              background: '#0d1420',
                              boxShadow: '0 0 0 4px rgba(77, 141, 255, 0.08), 0 0 18px rgba(77, 141, 255, 0.45)',
                            }
                          : { borderColor: '#232b38', color: '#5c6678', background: '#0a0d12' }
                      }
                    >
                      {step.n}
                    </span>

                    <div
                      className="s-card relative overflow-hidden p-5 transition-colors duration-300 md:p-6"
                      style={
                        on
                          ? {
                              borderColor: 'rgba(77, 141, 255, 0.38)',
                              background: 'linear-gradient(180deg, rgba(20, 26, 38, 0.96), rgba(10, 13, 19, 0.94))',
                              boxShadow: '0 30px 70px -46px rgba(77, 141, 255, 0.75)',
                            }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="s-mono pointer-events-none absolute -right-1 -top-3 text-[64px] leading-none text-white/[0.035]"
                      >
                        {step.n}
                      </span>

                      <div className="flex items-center justify-between gap-3">
                        <span className="s-mono text-[10px] tracking-[0.18em] text-[var(--s-mute)]">STEP {step.n}</span>
                        <span
                          className="s-pill s-mono"
                          style={on ? { color: '#cfe0ff', borderColor: 'rgba(77, 141, 255, 0.35)' } : undefined}
                        >
                          {step.route}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-2.5">
                        <Icon size={18} strokeWidth={1.6} style={{ color: on ? '#8fb6ff' : '#5c6678' }} />
                        <h3 className="s-h3">{step.title}</h3>
                      </div>

                      <ul className="mt-4 space-y-2.5">
                        {step.points.map((p) => (
                          <li key={p} className="flex gap-2.5 text-[13px] leading-[1.75] text-[var(--s-dim)]">
                            <span
                              className="mt-[0.65em] h-px w-3 shrink-0"
                              style={{ background: on ? '#4d8dff' : '#2a3442' }}
                            />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
