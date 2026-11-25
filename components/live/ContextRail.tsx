'use client';

import { Camera, Command, Compass, Keyboard, Layers, Lock, Radar, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { AnswerMode, AnswerStyle, Snapshot } from '@/lib/types';
import { STYLE_LABEL } from '@/lib/types';

export interface PreviewHit {
  label: string;
  text: string;
  score: number;
  type: 'card' | 'chunk' | 'qa';
}

const KEYS = [
  { keys: ['Ctrl/⌘', 'Enter'], label: '手动作答' },
  { keys: ['Ctrl/⌘', 'Shift', 'S'], label: '截图解题' },
  { keys: ['Alt', 'L'], label: '开始 / 停止监听' },
  { keys: ['Ctrl/⌘', 'K'], label: '命令面板' },
];

export function ContextRail({
  snap,
  hits,
  style,
  setStyle,
  answerMode,
  setAnswerMode,
  demo,
  lastLatency,
}: {
  snap: Snapshot | null;
  hits: PreviewHit[];
  style: AnswerStyle;
  setStyle: (s: AnswerStyle) => void;
  answerMode: AnswerMode;
  setAnswerMode: (m: AnswerMode) => void;
  demo: boolean;
  lastLatency?: number;
}) {
  return (
    <div className="scroll-thin flex min-w-0 flex-col gap-3 pr-0.5 xl:h-full xl:min-h-0 xl:overflow-y-auto">
      <div className="rounded-panel border border-ink-line bg-ink-panel/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
          <Lock size={11} className="text-brand" />
          本轮快照
        </div>
        {snap ? (
          <>
            <div className="text-[11px] leading-relaxed text-txt-dim">{snap.label}</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-[6px] border border-ink-line/60 bg-[#0e131a]/60 px-2 py-1.5">
                <div className="text-[9.5px] text-txt-mute">标准问答</div>
                <div className="font-mono text-[13px] font-semibold text-txt">
                  {snap.qaIds?.length ?? 0}
                </div>
              </div>
              <div className="rounded-[6px] border border-ink-line/60 bg-[#0e131a]/60 px-2 py-1.5">
                <div className="text-[9.5px] text-txt-mute">文档</div>
                <div className="font-mono text-[13px] font-semibold text-txt">{snap.docIds.length}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-txt-mute">
              <Timer size={9} />
              冻结于 {new Date(snap.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {snap.research ? (
              <div className="mt-1 flex items-center gap-1 text-[10px] text-ok">
                <Compass size={9} />
                已注入公司调研 · {snap.research.sources.length} 条来源
              </div>
            ) : null}
            <div className="mt-1.5 rounded-[6px] border border-ink-line/50 bg-[#0e131a]/40 px-2 py-1.5 text-[10px] leading-relaxed text-txt-mute">
              命中标准问答直接原样出答案；没命中再由模型结合快照和 JD 生成。新增或修改问答下一轮生效。
            </div>
          </>
        ) : (
          <div className="text-[11px] leading-relaxed text-txt-mute">
            还没开始本轮。开始时会冻结当前标准问答和文档。
          </div>
        )}
      </div>

      <div className="rounded-panel border border-ink-line bg-ink-panel/70 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
            <Radar size={11} className="text-brand-violet" />
            检索预览
          </div>
          {demo ? <Badge tone="warn">演示</Badge> : null}
        </div>
        {hits.length === 0 ? (
          <div className="text-[10.5px] leading-relaxed text-txt-mute">
            输入或说出一句话，这里会显示命中的标准问答或引用片段。
          </div>
        ) : (
          <div className="space-y-1.5">
            {hits.slice(0, 5).map((h, i) => (
              <div key={i} className="rounded-[6px] border border-ink-line/60 bg-[#0e131a]/60 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        'shrink-0 rounded-[3px] px-1 py-px text-[9px]',
                        h.type === 'qa'
                          ? 'bg-ok/15 text-ok'
                          : h.type === 'card'
                          ? 'bg-brand/15 text-[#9cc0ff]'
                          : 'bg-white/[.06] text-txt-mute'
                      )}
                    >
                      {h.type === 'qa' ? '题' : h.type === 'card' ? '卡' : '段'}
                    </span>
                    <span className="truncate text-[10.5px] text-txt-dim">{h.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-txt-mute">{h.score.toFixed(2)}</span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[9.5px] leading-relaxed text-txt-mute">{h.text}</div>
              </div>
            ))}
          </div>
        )}
        {lastLatency ? (
          <div className="mt-2 flex items-center gap-1 text-[9.5px] text-txt-mute">
            <Timer size={9} />
            上一次首字 {lastLatency}ms
          </div>
        ) : null}
      </div>

      <div className="rounded-panel border border-ink-line bg-ink-panel/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
          <Layers size={11} className="text-ok" />
          作答长度
        </div>
        <Segmented<AnswerStyle>
          value={style}
          onChange={setStyle}
          size="xs"
          className="w-full"
          items={[
            { value: 'concise', label: '简洁' },
            { value: 'standard', label: '标准' },
            { value: 'detailed', label: '详细' },
          ]}
        />
        <div className="mt-1.5 text-[9.5px] text-txt-mute">{STYLE_LABEL[style]}</div>
      </div>

      <div className="rounded-panel border border-ink-line bg-ink-panel/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
          <Compass size={11} className="text-brand-violet" />
          作答依据
        </div>
        <Segmented<AnswerMode>
          value={answerMode}
          onChange={setAnswerMode}
          size="xs"
          className="w-full"
          items={[
            { value: 'auto', label: '自动' },
            { value: 'material', label: '我的材料' },
            { value: 'general', label: '通用' },
          ]}
        />
        <div className="mt-1.5 text-[9.5px] leading-relaxed text-txt-mute">
          {answerMode === 'auto'
            ? '按题型走：经历题用你的卡片和简历，知识/公司/场景题让模型自己判断。'
            : answerMode === 'material'
            ? '优先用技能卡和简历里的事实，材料没有的就讲笼统一点。'
            : '完全不引用个人材料，只考模型自己的判断；适合临时救场。'}
        </div>
      </div>

      <div className="rounded-panel border border-ink-line bg-ink-panel/70 p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt">
          <Keyboard size={11} className="text-txt-mute" />
          快捷键
        </div>
        <div className="space-y-1.5">
          {KEYS.map((k) => (
            <div key={k.label} className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] text-txt-mute">{k.label}</span>
              <span className="flex items-center gap-0.5">
                {k.keys.map((x, i) => (
                  <span key={i} className="flex items-center gap-0.5">
                    <span className="kbd">{x}</span>
                    {i < k.keys.length - 1 ? <span className="text-[8px] text-txt-mute/60">+</span> : null}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1 border-t border-ink-line/50 pt-2 text-[9.5px] text-txt-mute">
          <Camera size={9} />
          截图用 getDisplayMedia 抓一帧，不上传原视频
        </div>
      </div>

      <div className="rounded-panel border border-ink-line/60 bg-ink-panel/40 p-3">
        <div className="flex items-start gap-2 text-[9.5px] leading-relaxed text-txt-mute">
          <Command size={10} className="mt-[2px] shrink-0" />
          纯 Web 只能听麦克风，听不到会议对面的人。要听系统音频需要桌面端。
        </div>
      </div>
    </div>
  );
}
