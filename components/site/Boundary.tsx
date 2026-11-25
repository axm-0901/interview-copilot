import { ArrowLeftRight, Database, KeyRound, ShieldCheck } from 'lucide-react';
import { Reveal, SectionHead } from '@/components/site/primitives';

const COLUMNS = [
  {
    title: '不做捕获排除',
    desc: '共享屏幕时，窗口就在画面里。不隐藏进程，不欺骗切屏与焦点检测。',
  },
  {
    title: '不编造事实',
    desc: '答案只来自你确认过的简历、项目与材料；材料里没有的，它会当面说清。',
  },
  {
    title: '不伪装经历',
    desc: '不替你造一个不存在的项目，也不把别人的经历改写成你的。',
  },
];

const LIMITS = [
  '纯 Web 只能听麦克风，抓不到会议里对方的声音',
  '识别质量取决于浏览器与网络，专业术语可能出错',
  '数字与事实的最终准确性由你负责',
];

const PRIVACY = [
  { icon: Database, text: '业务数据存本机 IndexedDB' },
  { icon: KeyRound, text: 'API Key 只在 localStorage' },
  { icon: ArrowLeftRight, text: '请求经 /api/chat 转发，不落盘' },
  { icon: ShieldCheck, text: '出站地址白名单，拒绝元数据与 link-local' },
];

export function Boundary() {
  return (
    <section id="boundary" className="relative scroll-mt-24 py-[72px] md:py-[120px]">
      <div className="s-wrap">
        <SectionHead
          index="07"
          kicker="使用边界"
          title="这是一副副驾，不是一件隐身衣。"
        />

        <Reveal delay={120}>
          <blockquote className="relative mt-14 max-w-[920px] pl-6 md:mt-16 md:pl-10">
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-0 top-1 w-px bg-gradient-to-b from-[#4d8dff]/80 via-[#8b6bff]/45 to-transparent"
            />
            <p
              className="text-balance text-[clamp(22px,3.1vw,34px)] leading-[1.62] tracking-[-0.01em] text-[var(--s-txt)]"
              style={{ fontFamily: 'var(--s-serif)' }}
            >
              我们不做窗口捕获排除，不绕过切屏与焦点检测，不替你编一个不存在的项目。
            </p>
          </blockquote>
        </Reveal>

        <Reveal delay={160}>
          <p className="s-lead mt-10 max-w-[760px]">
            共享屏幕时，它完整地出现在画面里。答案只来自你确认过的材料；材料里没有的，它会明说「未使用你的个人材料」。面试官值得听到真实的你，只是那个你，准备得更充分。
          </p>
        </Reveal>

        <div className="mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
          {COLUMNS.map((c, i) => (
            <Reveal
              key={c.title}
              delay={i * 80}
              className="border-t border-[var(--s-line)] pt-5"
            >
              <h3 className="text-[15px] font-medium tracking-[-0.01em] text-[var(--s-txt)]">
                {c.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.85] text-[var(--s-dim)]">{c.desc}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120} className="mt-16 max-w-[860px]">
          <div className="s-eyebrow">已知限制</div>
          <ul className="mt-5 divide-y divide-[var(--s-line)] border-y border-[var(--s-line)]">
            {LIMITS.map((t, i) => (
              <li key={t} className="flex gap-4 py-3.5">
                <span className="s-mono pt-0.5 text-[10px] text-[var(--s-mute)]">
                  0{i + 1}
                </span>
                <span className="text-[13.5px] leading-[1.8] text-[var(--s-dim)]">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-14 max-w-[800px]">
            <span
              aria-hidden="true"
              className="mb-6 block h-px w-12 bg-gradient-to-r from-[#4d8dff] to-transparent"
            />
            <p className="text-[clamp(15px,1.5vw,18px)] leading-[1.9] text-[var(--s-txt)]">
              把这些写在这里，是因为一个敢说自己做不到什么的产品，才值得你把简历交给它。
            </p>
          </div>
        </Reveal>

        <Reveal delay={120} className="mt-20 md:mt-24">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-[var(--s-line)] bg-[var(--s-line)] sm:grid-cols-2 lg:grid-cols-4">
            {PRIVACY.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 bg-[var(--s-panel)] p-4 lg:p-5">
                <Icon
                  size={16}
                  strokeWidth={1.6}
                  className="mt-0.5 shrink-0 text-[#6f9dff]"
                />
                <span className="text-[12.5px] leading-[1.7] text-[var(--s-dim)]">{text}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
