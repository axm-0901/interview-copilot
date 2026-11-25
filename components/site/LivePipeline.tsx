'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FileText, Link2, Mic, RotateCcw } from 'lucide-react';
import { useTypewriter } from './primitives';

type Phase = 'q1' | 'hit1' | 'a1' | 's1' | 'q2' | 'hit2' | 'a2' | 's2' | 'done';

const STEP: Record<Exclude<Phase, 'done'>, { next: Phase; ms: number }> = {
  q1: { next: 'hit1', ms: 1350 },
  hit1: { next: 'a1', ms: 900 },
  a1: { next: 's1', ms: 1550 },
  s1: { next: 'q2', ms: 1100 },
  q2: { next: 'hit2', ms: 1350 },
  hit2: { next: 'a2', ms: 1000 },
  a2: { next: 's2', ms: 1650 },
  s2: { next: 'done', ms: 1100 },
};

type SourceItem = { tag: string; title: string; meta?: string; hit?: boolean };
type Round = { hit: boolean; q: string; badge: string; answer: string; footer?: string; sources: SourceItem[] };

const ROUNDS: Round[] = [
  {
    hit: true,
    q: '那你说说……你们这个缓存……是怎么设计的？',
    badge: '命中标准问答 · 相似度 0.93 · 2 ms',
    answer: '结论：做过两级缓存，本地挡热点，Redis 兜一致性。\n写路径先更新库再删缓存，回填加互斥锁，避免击穿。\n热点 key 单独预热，命中率每天统计，低了就告警。',
    sources: [
      { tag: '标准问答', title: '你们这个缓存是怎么设计的？', meta: '相似度 0.93 · 2 ms', hit: true },
    ],
  },
  {
    hit: false,
    q: '如果 QPS 再涨十倍，你这套方案先崩在哪？',
    badge: '未命中 · 识别为「场景设计」',
    answer: '先崩的是本地缓存的容量和回源放大，不是 Redis。\n十倍流量下热点更集中，我会先做热点分片和请求合并。\n再补一层边缘缓存，最后才谈扩容，压测按十倍打。',
    footer: '引用技能卡 2 张 · 知识库 3 段',
    sources: [
      { tag: '技能卡', title: '容量评估 · 瓶颈顺序' },
      { tag: '技能卡', title: '场景设计 · 热点分片' },
      { tag: '知识库', title: '压测记录 · 缓存层' },
      { tag: '知识库', title: '架构评审 · 热点 key' },
      { tag: '知识库', title: '故障复盘 · 缓存击穿' },
    ],
  },
];

const BARS = [10, 18, 26, 14, 22, 9, 20, 25, 12, 17, 23];

const isRoundOne = (p: Phase) => p === 'q1' || p === 'hit1' || p === 'a1' || p === 's1';

export function LivePipeline() {
  const [run, setRun] = useState(0);
  return <Pipeline key={run} onReplay={() => setRun((n) => n + 1)} />;
}

function Pipeline({ onReplay }: { onReplay: () => void }) {
  const [phase, setPhase] = useState<Phase>('q1');
  const [armed, setArmed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const qRef = useRef<HTMLDivElement | null>(null);
  const aRef = useRef<HTMLDivElement | null>(null);
  const sRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setPhase('done');
      setArmed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setArmed(true);
        io.disconnect();
      },
      { threshold: 0.2 },
    );
    if (rootRef.current) io.observe(rootRef.current);
    else setArmed(true);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!armed || reduced || phase === 'done') return;
    const step = STEP[phase];
    const timer = window.setTimeout(() => setPhase(step.next), step.ms);
    return () => window.clearTimeout(timer);
  }, [armed, reduced, phase]);

  useEffect(() => {
    for (const el of [qRef.current, aRef.current, sRef.current]) {
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [phase]);

  const live = phase !== 'done';
  const roundIndex = isRoundOne(phase) ? 0 : 1;
  const round = ROUNDS[roundIndex];
  const answerStarted = phase === 'a1' || phase === 's1' || phase === 'a2' || phase === 's2';
  const qText = useTypewriter(round.q, armed && live, 42);
  const aText = useTypewriter(answerStarted ? round.answer : '', armed && live, 15);

  const roundLive = (i: number) => live && i === roundIndex;
  const reached = (i: number) => !live || i <= roundIndex;
  const badgeOn = (i: number) => (roundLive(i) ? phase !== (i === 0 ? 'q1' : 'q2') : true);
  const answerOn = (i: number) => !roundLive(i) || answerStarted;
  const sourcesOn = (i: number) => !roundLive(i) || phase === (i === 0 ? 's1' : 's2');
  const sourceCount = [0, 1].reduce((n, i) => (reached(i) && sourcesOn(i) ? n + ROUNDS[i].sources.length : n), 0);
  const playing = armed && live && !reduced;

  return (
    <div ref={rootRef} className="s-card s-noise relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(77,141,255,0.65),rgba(139,107,255,0.45),transparent)]" />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1b2330] px-3 py-2.5 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="s-dot-live" />
          <span className="s-mono text-[10px] tracking-[0.22em] text-[#35c58a]">LIVE</span>
          <span className="hidden h-3 w-px bg-[#26313f] sm:block" />
          <span className="s-mono truncate text-[10px] text-[#6a7587]">本轮快照：后端简历 · 12 题 · 3 份材料</span>
        </div>
        <button type="button" onClick={onReplay} className="s-mono inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#242e3b] px-2 py-1 text-[10.5px] text-[#8e9aac] transition-colors hover:border-[#37445a] hover:text-[#e9edf5]">
          <RotateCcw size={16} strokeWidth={1.6} />
          重播一轮
        </button>
      </div>
      <div className="grid grid-cols-1 sm:h-[300px] sm:grid-cols-3">
        <div className="flex min-h-0 flex-col border-b border-[#1b2330] sm:border-b-0 sm:border-r">
          <ColumnHead icon={<Mic size={16} strokeWidth={1.6} className="opacity-70" />} label="转录" meta="ASR" />
          <div ref={qRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
            {[0, 1].map((i) =>
              reached(i) ? (
                <div
                  key={i}
                  className="border-l pl-2.5"
                  style={{ borderColor: roundLive(i) ? 'rgba(77,141,255,0.55)' : '#1e2733' }}
                >
                  <div className="s-mono mb-1 flex items-center gap-2 text-[9px] tracking-[0.14em] text-[#49566a]">
                    <span>Q{i + 1}</span>
                    <span className="text-[#384353]">{roundLive(i) ? 'STREAM' : 'FINAL'}</span>
                  </div>
                  <p className="text-[12.5px] leading-[1.7] text-[#d6dde9]">
                    {roundLive(i) ? qText : ROUNDS[i].q}
                    {armed && roundLive(i) && qText.length < ROUNDS[i].q.length ? <span className="s-caret" /> : null}
                  </p>
                  {badgeOn(i) ? <Badge text={ROUNDS[i].badge} hit={ROUNDS[i].hit} /> : null}
                </div>
              ) : null,
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col border-b border-[#1b2330] sm:border-b-0 sm:border-r">
          <ColumnHead icon={<FileText size={16} strokeWidth={1.6} className="opacity-70" />} label="答稿" meta="COPILOT" />
          <div ref={aRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {[0, 1].map((i) =>
              reached(i) ? (
                <div key={i} className={i === 0 ? '' : 'mt-3 border-t border-[#1a222e] pt-3'}>
                  <div className="s-mono mb-1.5 text-[9px] tracking-[0.14em] text-[#49566a]">A{i + 1}</div>
                  {answerOn(i) ? (
                    <AnswerText
                      text={roundLive(i) ? aText : ROUNDS[i].answer}
                      caret={armed && roundLive(i) && aText.length < ROUNDS[i].answer.length}
                    />
                  ) : (
                    <div className="space-y-2 py-1" aria-hidden="true">
                      {[92, 74, 84].map((w) => (
                        <div key={w} className="h-px bg-[#1c2431]" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null,
            )}
            {reached(1) && sourcesOn(1) && ROUNDS[1].footer ? (
              <div className="s-mono mt-3 flex items-center gap-1.5 border-t border-[#1a222e] pt-2 text-[9.5px] text-[#556173]">
                <Link2 size={16} strokeWidth={1.6} className="opacity-50" />
                <span className="truncate">{ROUNDS[1].footer}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <ColumnHead
            icon={<Link2 size={16} strokeWidth={1.6} className="opacity-70" />}
            label="来源"
            meta={String(sourceCount).padStart(2, '0')}
          />
          <div ref={sRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {sourceCount === 0 ? <div className="s-mono text-[9px] tracking-[0.14em] text-[#384353]">待命</div> : null}
            {[0, 1].map((i) =>
              reached(i) && sourcesOn(i) ? (
                <div key={i} className={i === 0 ? '' : 'mt-3 border-t border-[#1a222e] pt-3'}>
                  {i === 0 ? null : (
                    <div className="s-mono mb-2 text-[9px] tracking-[0.14em] text-[#3f4a5b]">R2 引用</div>
                  )}
                  <div className="space-y-1.5">
                    {ROUNDS[i].sources.map((s, j) => (
                      <div
                        key={s.title}
                        className={`flex items-start gap-2 ${reduced ? '' : 'animate-fadeUp'}`}
                        style={{ animationDelay: `${j * 60}ms` }}
                      >
                        <span
                          className={`mt-[6px] h-1 w-1 shrink-0 rounded-full ${
                            s.hit ? 'bg-[#35c58a]' : 'bg-[#39465a]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[11.5px] leading-[1.5] text-[#c8d1dd]">{s.title}</div>
                          <div
                            className={`s-mono mt-0.5 truncate text-[9px] ${
                              s.hit ? 'text-[#4fbf8f]' : 'text-[#4f5b6d]'
                            }`}
                          >
                            {s.tag}
                            {s.meta ? ` · ${s.meta}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#1b2330] px-3 py-2 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-7 items-end gap-[3px]" aria-hidden="true">
            {BARS.map((h, i) => (
              <span
                key={i}
                className={`w-[3px] origin-bottom rounded-sm bg-[linear-gradient(180deg,#6f9dff,#2f4a7d)] ${
                  playing ? 'animate-[s-bar_1.1s_ease-in-out_infinite]' : 'scale-y-[0.22] opacity-50'
                }`}
                style={{
                  height: `${h}px`,
                  animationDelay: `${i * 70}ms`,
                  animationDuration: `${1000 + (i % 4) * 90}ms`,
                }}
              />
            ))}
          </div>
          <span className="s-mono truncate text-[9px] tracking-[0.14em] text-[#465366]">16k · 100 ms / 包</span>
        </div>
        <div className="s-mono flex shrink-0 items-center gap-2 text-[9px] tracking-[0.14em] text-[#465366]">
          <span className={playing ? 'text-[#7d8b9f]' : ''}>{phase === 'done' ? '完成' : '播放中'}</span>
          <span className="h-3 w-px bg-[#26313f]" />
          <span>R{roundIndex + 1} / 2</span>
        </div>
      </div>
    </div>
  );
}

function ColumnHead({ icon, label, meta }: { icon: ReactNode; label: string; meta: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[#171e29] bg-[#0a0d12]/60 px-3 py-[7px]">
      <div className="flex items-center gap-1.5 text-[#7f8b9d]">
        {icon}
        <span className="s-mono text-[10.5px] tracking-[0.16em] text-[#8b97a9]">{label}</span>
      </div>
      <span className="s-mono text-[9px] tracking-[0.14em] text-[#3f4a5b]">{meta}</span>
    </div>
  );
}

function Badge({ text, hit }: { text: string; hit: boolean }) {
  return (
    <div
      className={`s-mono mt-2 flex w-fit max-w-full items-start gap-1.5 rounded-[5px] border px-1.5 py-[3px] text-[9.5px] leading-[1.6] ${
        hit ? 'border-[#1e4a3a] bg-[#0b1a15] text-[#5fd8a4]' : 'border-[#3b3222] bg-[#161207] text-[#e0b36a]'
      }`}
    >
      <span className={`mt-[5px] h-1 w-1 shrink-0 rounded-full ${hit ? 'bg-[#35c58a]' : 'bg-[#f5a623]'}`} />
      <span>{text}</span>
    </div>
  );
}

function AnswerText({ text, caret }: { text: string; caret?: boolean }) {
  const cut = text.indexOf('。');
  const head = cut === -1 ? text : text.slice(0, cut + 1);
  const tail = cut === -1 ? '' : text.slice(cut + 1);
  return (
    <p className="whitespace-pre-line text-[12px] leading-[1.8] text-[#b6c0cf]">
      {head ? <strong className="font-semibold text-[#f0f4fa]">{head}</strong> : null}
      {tail}
      {caret ? <span className="s-caret" /> : null}
    </p>
  );
}
