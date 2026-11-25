'use client';

import { Activity, ArrowRight, Briefcase, FileText, Loader2, Lock, MessageSquareText, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Tabs';
import type { Profile, QAEntry, SessionMode } from '@/lib/types';

export function StartPanel({
  qas,
  docCount,
  instructions,
  mode,
  setMode,
  onStart,
  starting,
  demo,
  hasProfile,
  profiles,
  activeId,
  switching,
  onSelectProfile,
  onNewProfile,
}: {
  qas: QAEntry[];
  docCount: number;
  instructions?: string;
  mode: SessionMode;
  setMode: (m: SessionMode) => void;
  onStart: () => void;
  starting: boolean;
  demo: boolean;
  hasProfile: boolean;
  profiles: Profile[];
  activeId: string | null;
  switching: boolean;
  onSelectProfile: (id: string) => void;
  onNewProfile: () => void;
}) {
  const activeProfile = profiles.find((p) => p.id === activeId);

  return (
    <div className="mx-auto grid w-full max-w-[900px] grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
      <Panel className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-brand/14 blur-[60px]" />
        <div className="relative">
          <div className="mb-4 rounded-card border border-brand/25 bg-brand/[.05] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9cc0ff]">
                <Briefcase size={11} />
                本次面试档案
              </div>
              <button
                type="button"
                onClick={onNewProfile}
                className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2 py-[2px] text-[10px] text-[#9cc0ff] transition-colors hover:bg-brand/16"
              >
                <Plus size={9} />
                新建面试档案
              </button>
            </div>
            <select
              className="field mt-2 h-[36px] text-[12px]"
              value={activeId ?? ''}
              onChange={(e) => onSelectProfile(e.target.value)}
              disabled={switching || !profiles.length}
            >
              <option value="" disabled>
                {profiles.length ? '选择要面试的公司档案' : '还没有面试档案'}
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company || p.name} · {p.targetRole || '未填岗位'} · {p.round}
                </option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] leading-relaxed text-txt-mute">
              {switching ? <Loader2 size={9} className="animate-spin" /> : null}
              {activeProfile
                ? `本轮只会读取「${activeProfile.company || activeProfile.name}」的题库、文档和公司调研，不会串到其他档案。`
                : '先新建一份档案，填公司、岗位并上传 JD。'}
            </div>
          </div>

          <Badge tone="brand" dot>
            开始前确认
          </Badge>
          <h2 className="mt-2.5 text-[19px] font-semibold tracking-tight text-txt">这一轮会冻结什么</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-txt-mute">
            点「开始本轮」时，当前标准问答与全部文档会被冻结成快照。命中标准问答就直接原样出答案，没命中再结合简历和 JD 现场生成。
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-card border border-ink-line/70 bg-[#0e131a]/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-txt-mute">
                <MessageSquareText size={10} />
                标准问答
              </div>
              <div className="mt-1 font-mono text-[20px] font-semibold text-txt">{qas.length}</div>
            </div>
            <div className="rounded-card border border-ink-line/70 bg-[#0e131a]/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-txt-mute">
                <FileText size={10} />
                知识库文档
              </div>
              <div className="mt-1 font-mono text-[20px] font-semibold text-txt">{docCount}</div>
            </div>
            <div className="col-span-2 rounded-card border border-ink-line/70 bg-[#0e131a]/60 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-txt-mute">
                <Sparkles size={10} />
                自定义答题指令
              </div>
              <div className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-relaxed text-txt-dim">
                {instructions?.trim() || '未设置。建议去「面试档案」写 3~5 条，告诉模型怎么说、说多长。'}
              </div>
            </div>
          </div>

          {qas.length === 0 ? (
            <div className="mt-2.5 flex items-start gap-2 rounded-[7px] border border-warn/30 bg-warn/[.06] px-2.5 py-2">
              <TriangleAlert size={12} className="mt-[2px] shrink-0 text-warn" />
              <div className="text-[11px] leading-relaxed text-txt-dim">
                没有标准问答，本轮命中不了就只能现场调用模型。建议先去
                <span className="text-[#9cc0ff]"> 标准问答 </span>
                把自我介绍、为什么选我们、最大缺点这几道高频题写进去。
              </div>
            </div>
          ) : (
            <div className="mt-2.5 space-y-1">
              {qas.slice(0, 4).map((q) => (
                <div key={q.id} className="flex items-center gap-1.5 text-[11px] text-txt-dim">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
                  <span className="truncate">{q.question}</span>
                  <span className="shrink-0 text-txt-mute/60">{q.aliases.length} 问法</span>
                </div>
              ))}
              {qas.length > 4 ? (
                <div className="pl-3 text-[10.5px] text-txt-mute">还有 {qas.length - 4} 题…</div>
              ) : null}
            </div>
          )}

          {!hasProfile ? (
            <div className="mt-3 text-[11px] text-warn">还没有绑定档案，先去「面试档案」建一份。</div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Segmented<SessionMode>
              value={mode}
              onChange={setMode}
              items={[
                { value: 'assist', label: '辅助模式' },
                { value: 'practice', label: '练习模式' },
              ]}
            />
            <Button
              variant="primary"
              size="md"
              onClick={onStart}
              loading={starting}
              disabled={!hasProfile || switching}
              className="min-w-[132px]"
            >
              <Activity size={14} />
              开始本轮
              <ArrowRight size={12} className="opacity-70" />
            </Button>
          </div>
          <div className="mt-2 text-[10.5px] leading-relaxed text-txt-mute">
            {mode === 'assist'
              ? '辅助模式：听真人提问（或手动输入），实时给答稿。'
              : '练习模式：AI 出题、你作答，每题给即时点评与 30 秒改写。'}
            {demo ? ' 当前未配置 Key，会以演示模式运行。' : ''}
          </div>
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-txt">
            <Lock size={11} className="text-brand" />
            为什么要有快照
          </div>
          <div className="space-y-1.5 text-[10.5px] leading-relaxed text-txt-mute">
            <p>面试中途改材料是很常见的事。如果没有快照，同一场里前后答案会互相矛盾。</p>
            <p>冻结之后，你随时能回答「这句引用的是哪一版」。</p>
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-txt">
            <Sparkles size={11} className="text-brand-violet" />
            开麦前自查
          </div>
          <ul className="space-y-1.5 text-[10.5px] leading-relaxed text-txt-mute">
            <li className="flex gap-1.5">
              <span className="text-txt-mute/50">1</span>
              用 Chrome / Edge，语音识别才可用
            </li>
            <li className="flex gap-1.5">
              <span className="text-txt-mute/50">2</span>
              外放会把自己的声音也收进来：设置里切「按住空格」，或戴耳机改手动输入
            </li>
            <li className="flex gap-1.5">
              <span className="text-txt-mute/50">3</span>
              纯 Web 抓不到系统声音，听不到会议对面的人
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
