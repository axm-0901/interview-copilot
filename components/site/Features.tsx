import {
  LayoutGrid,
  Layers,
  Link2,
  ListChecks,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Reveal, SectionHead } from '@/components/site/primitives';

type Feature = { n: string; title: string; body: string; icon: LucideIcon };

const rest: Feature[] = [
  {
    n: '02',
    title: '快照锁定',
    body: '开始本轮时冻结问答、卡片、文档、指令；中途改，下一轮生效。',
    icon: Snowflake,
  },
  {
    n: '03',
    title: '题库批量导入',
    body: '模板 → GPT 生成 → 预览题数 → 一次性写入。',
    icon: Upload,
  },
  {
    n: '04',
    title: '13 类题型骨架',
    body: '自我介绍、项目深挖、薪资、反问……先判题型，再决定塞什么材料。',
    icon: Layers,
  },
  {
    n: '05',
    title: '逐条复盘',
    body: '类型、1–5 分、致命伤、30 秒改写、一句口诀。',
    icon: ListChecks,
  },
  {
    n: '06',
    title: '引用可追溯',
    body: '命中哪道问答、哪张卡、哪段材料，带相似度，可展开原文。',
    icon: Link2,
  },
  {
    n: '07',
    title: '自定义答题指令',
    body: '只改语气、结构和长度，不改事实来源。',
    icon: SlidersHorizontal,
  },
  {
    n: '08',
    title: '演示模式',
    body: '没配 Key 也能走完整链路，全部标注「本地合成」。',
    icon: Sparkles,
  },
  {
    n: '09',
    title: '窗口布局',
    body: '置顶、40–100% 透明度、多显示器；共享屏幕中始终可见。',
    icon: LayoutGrid,
  },
];

const bars = [0.3, 0.55, 0.4, 0.74, 0.48, 0.92, 0.6, 0.36, 0.64, 0.46, 0.82, 0.38];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-[72px] md:py-[120px]">
      <div className="s-wrap">
        <SectionHead
          index="06"
          kicker="能力清单"
          title={
            <>
              不是功能堆料，是<span className="s-grad">一条能跑通的链路</span>。
            </>
          }
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          <Reveal className="h-full md:col-span-2 lg:row-span-2">
            <article className="s-card s-card-hover group flex h-full flex-col p-6 md:p-7">
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1f4a3a] bg-[#0b1a15] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#35c58a]" />
                  <span className="s-mono text-[11px] text-[#35c58a]">2 ms</span>
                </span>
                <span className="s-mono text-[10px] text-[#3a4658]">01</span>
              </div>

              <h3 className="mt-6 text-[20px] font-semibold leading-snug tracking-[-0.015em] text-[#e9edf5] md:text-[22px]">
                命中即答
              </h3>
              <p className="mt-2.5 max-w-[440px] text-[13.5px] leading-[1.9] text-[#97a1b2]">
                标准问答命中后原样显示，2 ms 内落稿。
              </p>

              <div className="mt-auto pt-10">
                <div className="flex h-16 items-end gap-1.5">
                  {bars.map((h, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-[#35c58a]"
                      style={{ height: `${h * 100}%`, opacity: 0.16 + h * 0.42 }}
                    />
                  ))}
                </div>
                <p className="s-mono mt-4 text-[10.5px] tracking-[0.12em] text-[#5c6678]">
                  标准问答 → 原样出稿
                </p>
              </div>
            </article>
          </Reveal>

          {rest.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.n} delay={(i % 3) * 80} className="h-full">
                <article className="s-card s-card-hover flex h-full flex-col p-5 md:p-6">
                  <div className="flex items-start justify-between">
                    <Icon size={16} strokeWidth={1.6} className="text-[#6f9dff]" />
                    <span className="s-mono text-[10px] text-[#3a4658]">{f.n}</span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-medium text-[#e9edf5]">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-[1.9] text-[#97a1b2]">{f.body}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
