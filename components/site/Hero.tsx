'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Reveal, useCountUp } from './primitives';
import { LivePipeline } from './LivePipeline';

const METRICS = [
  { value: 2, decimals: 0, unit: 'ms', label: '命中即答' },
  { value: 0.7, decimals: 1, unit: 's', label: '语音出字' },
  { value: 13, decimals: 0, unit: '类', label: '题型骨架' },
  { value: 7, decimals: 0, unit: '页', label: '工作台' },
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pb-20 pt-[104px] md:pb-24 md:pt-[120px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
        <div className="s-grid-bg absolute inset-0 opacity-80" />
        <div
          className="s-aurora"
          style={{ left: '-6%', top: '-180px', width: '560px', height: '360px', background: 'rgba(77,141,255,.5)' }}
        />
        <div
          className="s-aurora"
          style={{ right: '-2%', top: '-120px', width: '520px', height: '320px', background: 'rgba(139,107,255,.38)' }}
        />
      </div>

      <div className="s-wrap relative">
        <Reveal>
          <div className="s-eyebrow">AI INTERVIEW COPILOT · v1.7.1</div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="s-h1 mt-4 sm:mt-5">
            面试不是临场发挥，
            <span className="s-grad block">是把你的经历提前练到能说出口。</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="s-lead mt-5 max-w-[640px] sm:mt-6">
            面试副驾把你自己的简历、项目和真正想说的话，整理成一套能命中、能复用、能复盘的答案。听题、出稿、点评，一条闭环。
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <Link href="/" className="s-btn s-btn-primary">
              打开工作台
              <ArrowRight size={18} strokeWidth={1.6} />
            </Link>
            <Link href="#listen" className="s-btn s-btn-ghost">
              看它怎么听题
            </Link>
          </div>
        </Reveal>

        <Reveal delay={300}>
          <div className="mt-5 flex items-center gap-2 text-[11.5px] tracking-[0.02em] text-[#5f6b7d] sm:mt-6">
            <ShieldCheck size={16} strokeWidth={1.6} className="shrink-0 opacity-70" />
            <span>本地优先 · Key 只存本机 · 不做反检测</span>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-10 md:mt-12">
          <LivePipeline />
        </Reveal>

        <div className="mt-12 border-t border-[#161d27] pt-7 md:mt-14">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
            {METRICS.map((m, i) => (
              <Metric key={m.label} {...m} delay={i * 80} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  value,
  decimals,
  unit,
  label,
  delay,
}: {
  value: number;
  decimals: number;
  unit: string;
  label: string;
  delay: number;
}) {
  const { ref, value: shown } = useCountUp(value, 1200, decimals);

  return (
    <Reveal delay={delay} className="sm:border-l sm:border-[#161d27] sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
      <div className="flex items-baseline gap-1.5">
        <span
          ref={ref}
          className="s-mono text-[clamp(24px,3vw,30px)] font-medium leading-none tracking-[-0.02em] text-[#eef2f8]"
        >
          {shown.toFixed(decimals)}
        </span>
        <span className="s-mono text-[11px] text-[#6d798b]">{unit}</span>
      </div>
      <div className="mt-2 text-[11.5px] tracking-[0.04em] text-[#7b8698]">{label}</div>
    </Reveal>
  );
}
