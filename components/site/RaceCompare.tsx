'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Reveal, SectionHead } from '@/components/site/primitives';

const HIT_STEPS = ['归一化去标点', '同义问法替换', '字符 + 二元词 IDF 加权', '歧义拒绝', '原样出稿'];
const MISS_STEPS = ['本地判题型', '选材', '注入题型骨架', '流式生成', '标注引用'];
const NODES = [0, 25, 50, 75, 100];

function Track({ pct, tone, speed }: { pct: number; tone: string; speed: number }) {
  return (
    <div className="relative mt-6 h-8" aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--s-line)]" />
      <span
        className="absolute left-0 top-1/2 h-px -translate-y-1/2"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${tone}00, ${tone}b0)`,
          transition: `width ${speed}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      />
      {NODES.map((p) => {
        const reached = p <= pct + 0.1;
        return (
          <span
            key={p}
            className="absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${p}%`,
              background: reached ? tone : '#2a3442',
              boxShadow: reached ? `0 0 9px ${tone}77` : 'none',
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }}
          />
        );
      })}
      <span
        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          left: `${pct}%`,
          background: tone,
          boxShadow: `0 0 0 3px ${tone}1f, 0 0 16px 3px ${tone}88`,
          transitionProperty: 'left',
          transitionDuration: `${speed}ms`,
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}

function Lane({
  code,
  name,
  result,
  resultSize,
  tone,
  tag,
  tagOk,
  steps,
  lit,
  speed,
}: {
  code: string;
  name: string;
  result: string;
  resultSize: string;
  tone: string;
  tag: string;
  tagOk?: boolean;
  steps: string[];
  lit: number;
  speed: number;
}) {
  const pct = (lit / steps.length) * 100;
  return (
    <div className="s-card relative overflow-hidden p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="s-mono text-[10px] tracking-[0.18em] text-[var(--s-mute)]">{code}</div>
          <h3 className="mt-2 text-[14.5px] font-medium text-[var(--s-txt)]">{name}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <div
            className="s-mono leading-none"
            style={{
              fontSize: resultSize,
              color: lit > 0 ? tone : '#4a5464',
              textShadow: lit > 0 ? `0 0 26px ${tone}55` : 'none',
              transition: 'color 0.3s ease, text-shadow 0.3s ease',
            }}
          >
            {result}
          </div>
          <span
            className="s-pill s-mono mt-3"
            style={
              tagOk
                ? { color: '#7fe3b8', borderColor: 'rgba(53, 197, 138, 0.3)', background: 'rgba(53, 197, 138, 0.08)' }
                : { color: '#8b95a8' }
            }
          >
            {tag}
          </span>
        </div>
      </div>

      <Track pct={pct} tone={tone} speed={speed} />

      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => {
          const on = lit > i;
          return (
            <li key={step} className="flex items-center gap-3">
              <span
                className="s-mono w-4 shrink-0 text-right text-[10px]"
                style={{ color: on ? tone : '#3d4756', transition: 'color 0.3s ease' }}
              >
                {`0${i + 1}`}
              </span>
              <span
                className="h-px w-4 shrink-0"
                style={{
                  background: on ? tone : '#242c38',
                  boxShadow: on ? `0 0 8px ${tone}55` : 'none',
                  transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
              />
              <span
                className="text-[13px] leading-[1.7]"
                style={{ color: on ? 'var(--s-txt)' : 'var(--s-mute)', transition: 'color 0.3s ease' }}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RaceCompare() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [reduce, setReduce] = useState(false);

  const run = useCallback((instant = false) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (instant) {
      setLeft(5);
      setRight(5);
      return;
    }
    setLeft(0);
    setRight(0);
    timers.current.push(window.setTimeout(() => setLeft(5), 120));
    MISS_STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setRight(i + 1), 460 + i * 380));
    });
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduce(true);
      run(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (started.current || !entries.some((e) => e.isIntersecting)) return;
        started.current = true;
        run();
        io.disconnect();
      },
      { threshold: 0.28 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, [run]);

  return (
    <section id="how" ref={sectionRef} className="relative scroll-mt-24">
      <div className="s-wrap">
        <div className="s-hairline" />
        <div className="py-[72px] md:py-[120px]">
          <SectionHead
            index="03"
            kicker="机制 · 两条路径"
            title="准备好的题，不该再花三秒重新想一遍。"
          />

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => run(reduce)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--s-line2)] bg-[rgba(13,16,22,0.7)] px-3.5 text-[12.5px] text-[var(--s-dim)] transition-colors hover:border-[#3b4759] hover:text-[var(--s-txt)]"
            >
              <RotateCcw size={16} strokeWidth={1.6} />
              再跑一次
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-5">
            <Lane
              code="PATH 01"
              name="标准问答命中"
              result="2 ms"
              resultSize="clamp(34px, 4vw, 46px)"
              tone="#35c58a"
              tag="命中"
              tagOk
              steps={HIT_STEPS}
              lit={left}
              speed={reduce ? 0 : 140}
            />
            <Lane
              code="PATH 02"
              name="未命中兜底"
              result="0.7–1.2 s"
              resultSize="clamp(24px, 2.8vw, 34px)"
              tone="#6f9dff"
              tag="首字"
              steps={MISS_STEPS}
              lit={right}
              speed={reduce ? 0 : 380}
            />
          </div>

          <Reveal delay={120}>
            <div className="mt-10 flex flex-col gap-3 border-t border-[var(--s-line)] pt-6 md:flex-row md:items-start md:justify-between md:gap-10">
              <p className="max-w-[560px] text-[13px] leading-[1.8] text-[var(--s-dim)]">
                命中不经过模型，所以没有思考延迟，也不会把标准答案改写成另一版。
              </p>
              <p className="s-mono max-w-[520px] text-[11.5px] leading-[1.9] text-[var(--s-mute)]">
                短问题门槛 0.70 / 长问题 0.66；分差 {'<'} 0.04 时宁可不用，也不贴错题答案。
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
