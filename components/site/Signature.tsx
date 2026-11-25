import { Headphones, KeyRound, MicOff, ScanLine, ShieldCheck } from 'lucide-react';
import { Reveal, SectionHead } from '@/components/site/primitives';

const chain = [
  '系统音频 · loopback',
  '16k / 16bit / 单声道',
  '100 ms / 包',
  '本机桥 8761',
  '腾讯云实时 16k_zh',
  'partial 边说边出字',
  '静音 700 ms',
  'final',
];

const notes = [
  {
    icon: MicOff,
    title: '不含麦克风',
    body: '抓的是播放流，不会把你的声音混进去，也没有回声。',
  },
  {
    icon: Headphones,
    title: '戴耳机可用',
    body: '不依赖房间收音，面试官的声音从系统里直接进来。',
  },
  {
    icon: KeyRound,
    title: '密钥不出本机',
    body: '密钥只在桥的一侧，渲染进程拿不到。',
  },
];

const chainCss = `
.sig-flow{position:relative;padding-top:24px}
.sig-rail{position:absolute;left:6px;right:6px;top:0;height:1px;background:linear-gradient(90deg,transparent,#24303f 4%,#24303f 96%,transparent)}
.sig-spark{position:absolute;left:0;top:-2px;width:5px;height:5px;border-radius:999px;background:#8fb6ff;box-shadow:0 0 10px 2px rgba(77,141,255,.7);animation:sig-x 9s linear infinite}
.sig-nodes{position:relative;display:flex;gap:8px}
.sig-node{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:5px;padding:8px 10px 10px;border:1px solid var(--s-line);border-radius:9px;background:#0a0d13}
.sig-node::before{content:'';position:absolute;left:10px;top:-24px;width:1px;height:24px;background:linear-gradient(180deg,#2a3442,#1c232e)}
.sig-idx{font-family:var(--s-mono);font-size:9.5px;letter-spacing:.08em;color:#3a4658}
.sig-label{font-family:var(--s-mono);font-size:10.5px;line-height:1.55;color:#c6cedb;min-height:2.9em;word-break:break-word}
@keyframes sig-x{0%{left:0;opacity:0}7%{opacity:1}93%{opacity:1}100%{left:100%;opacity:0}}
@keyframes sig-y{0%{top:0;opacity:0}7%{opacity:1}93%{opacity:1}100%{top:100%;opacity:0}}
@media (max-width:1080px){
 .sig-flow{padding-top:0;padding-left:26px}
 .sig-rail{left:3px;right:auto;top:4px;bottom:4px;width:1px;height:auto;background:linear-gradient(180deg,transparent,#24303f 4%,#24303f 96%,transparent)}
 .sig-spark{left:-2px;top:0;animation:sig-y 9s linear infinite}
 .sig-nodes{flex-direction:column;gap:8px}
 .sig-node::before{left:-24px;top:22px;width:24px;height:1px;background:#24303f}
}
@media (prefers-reduced-motion: reduce){
 .sig-spark{animation:none;opacity:0}
}
`;

export function Signature() {
  return (
    <section id="listen" className="relative scroll-mt-24 py-[72px] md:py-[120px]">
      <style dangerouslySetInnerHTML={{ __html: chainCss }} />
      <div className="s-wrap">
        <SectionHead
          index="05"
          kicker="听题 · 系统音频"
          title="戴耳机，也听得见面试官。"
          lead="桌面端直接抓 Windows 的系统播放流，不经过麦克风。你戴耳机、房间很安静、自己不出声，转写照样走。"
        />

        <Reveal delay={200}>
          <div className="s-card mt-10 p-5 md:mt-12 md:p-7">
            <div className="flex items-center justify-between">
              <span className="s-mono text-[10.5px] tracking-[0.16em] text-[#5c6678]">
                SIGNAL CHAIN
              </span>
              <span className="s-pill s-mono text-[10.5px] text-[#7d8798]">loopback</span>
            </div>

            <div className="sig-flow mt-6">
              <div className="sig-rail" aria-hidden>
                <span className="sig-spark" />
              </div>
              <ol className="sig-nodes">
                {chain.map((label, i) => (
                  <li key={label} className="sig-node">
                    <span className="sig-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="sig-label">{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {notes.map((n, i) => (
            <Reveal key={n.title} delay={i * 80} className="h-full">
              <article className="s-card s-card-hover flex h-full flex-col p-5 md:p-6">
                <n.icon size={16} strokeWidth={1.6} className="text-[#6f9dff]" />
                <h3 className="mt-4 text-[14.5px] font-medium text-[#e9edf5]">{n.title}</h3>
                <p className="mt-1.5 text-[13px] leading-[1.9] text-[#97a1b2]">{n.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Reveal delay={80} className="h-full">
            <article className="s-card s-card-hover flex h-full flex-col p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <ScanLine size={16} strokeWidth={1.6} className="text-[#6f9dff]" />
                  <h3 className="text-[15px] font-medium text-[#e9edf5]">截图解题</h3>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <kbd className="s-kbd">Ctrl</kbd>
                  <span className="text-[11px] text-[#4c5768]">/</span>
                  <kbd className="s-kbd">⌘</kbd>
                  <span className="text-[11px] text-[#4c5768]">+</span>
                  <kbd className="s-kbd">Shift</kbd>
                  <span className="text-[11px] text-[#4c5768]">+</span>
                  <kbd className="s-kbd">S</kbd>
                </div>
              </div>
              <p className="mt-4 text-[12px] tracking-[0.04em] text-[#5c6678]">四段式输出</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['题目理解', '解题思路', '参考解法', '坑与追问'].map((t) => (
                  <span key={t} className="s-pill text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </article>
          </Reveal>

          <Reveal delay={160} className="h-full">
            <article className="s-card s-card-hover flex h-full flex-col p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={16} strokeWidth={1.6} className="text-[#6f9dff]" />
                  <h3 className="text-[15px] font-medium text-[#e9edf5]">防自激</h3>
                </div>
                <span className="s-pill s-mono text-[10.5px] text-[#7d8798]">≥ 0.68</span>
              </div>
              <p className="mt-4 text-[13px] leading-[1.9] text-[#97a1b2]">
                答稿冷却 + 念稿检测：识别结果与上一份答稿重合度 ≥ 0.68 直接丢弃。
              </p>
            </article>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <p className="mt-8 flex gap-3 text-[12.5px] leading-[1.9] text-[#5c6678]">
            <span className="s-mono shrink-0 text-[10.5px] tracking-[0.14em] text-[#3f4b5c]">
              NOTE
            </span>
            <span>
              纯 Web 版只能听麦克风，抓不到会议里对方的声音——这是平台限制，不是藏着没做。
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
