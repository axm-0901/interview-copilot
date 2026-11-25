import Link from 'next/link';
import { ArrowRight, MonitorPlay, Package } from 'lucide-react';
import { Reveal } from '@/components/site/primitives';

export function CTA() {
  return (
    <section className="relative overflow-hidden border-t border-[var(--s-line)] py-24 md:py-[140px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[980px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
        style={{
          background:
            'radial-gradient(closest-side, rgba(77,141,255,0.26), rgba(139,107,255,0.13) 52%, transparent 78%)',
        }}
      />

      <div className="s-wrap relative">
        <div className="mx-auto max-w-[820px] text-center">
          <Reveal>
            <h2 className="text-balance text-[clamp(30px,4.6vw,54px)] font-semibold leading-[1.12] tracking-[-0.03em]">
              下一场面试，别再空手上场。
            </h2>
          </Reveal>

          <Reveal delay={90}>
            <p className="s-lead mx-auto mt-5 max-w-[640px]">
              先花 20 分钟，把最常被问的 10 道题写成你自己的答案。剩下的，交给命中。
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/" className="s-btn s-btn-primary w-full sm:w-auto">
                打开工作台
                <ArrowRight size={18} strokeWidth={1.6} />
              </Link>
              <Link href="/live" className="s-btn s-btn-ghost w-full sm:w-auto">
                <MonitorPlay size={18} strokeWidth={1.6} />
                直接进实战
              </Link>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <p className="mt-9 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11.5px] leading-[1.7] text-[var(--s-mute)]">
              <Package size={16} strokeWidth={1.6} className="text-[var(--s-dim)]" />
              <span className="s-mono">Windows 桌面端已打包：面试副驾-Setup-1.7.1.exe</span>
              <span className="text-[#2e3948]">·</span>
              <span>安装后自动创建快捷方式</span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
