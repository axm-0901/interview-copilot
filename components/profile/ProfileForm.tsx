'use client';

import { useEffect, useState } from 'react';
import { Save, UserRound } from 'lucide-react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHead } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { Segmented } from '@/components/ui/Tabs';
import { ROUNDS, type LangKey, type Profile, type RoundKey } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

export function ProfileForm({ profile }: { profile: Profile }) {
  const { refreshProfiles, refreshActive } = useApp();
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(profile), [profile]);

  const dirty =
    draft.name !== profile.name ||
    draft.targetRole !== profile.targetRole ||
    draft.company !== profile.company ||
    draft.round !== profile.round ||
    draft.lang !== profile.lang ||
    (draft.instructions ?? '') !== (profile.instructions ?? '');

  const save = async () => {
    if (!draft.name.trim()) {
      toast('档案名不能为空', 'warn');
      return;
    }
    setSaving(true);
    try {
      await db.putProfile({ ...draft, name: draft.name.trim() });
      await refreshProfiles();
      await refreshActive();
      toast('档案已保存', 'ok');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHead
        title="档案信息"
        desc="这些字段会进入每一轮提示词的上下文"
        icon={<UserRound size={14} />}
        right={
          dirty ? (
            <Button variant="primary" size="xs" onClick={save} loading={saving}>
              <Save size={11} />
              保存
            </Button>
          ) : (
            <span className="text-[10.5px] text-txt-mute">已同步</span>
          )
        }
      />
      <div className="space-y-3 px-4 pb-4">
        <div>
          <label className="label">档案名</label>
          <input
            className="field"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="例如：字节 · 后端二面"
          />
        </div>
        <div>
          <label className="label">目标岗位</label>
          <input
            className="field"
            value={draft.targetRole}
            onChange={(e) => setDraft({ ...draft, targetRole: e.target.value })}
            placeholder="例如：后端开发工程师（增长方向）"
          />
        </div>
        <div>
          <label className="label">公司</label>
          <input
            className="field"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            placeholder="例如：字节跳动"
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="label">轮次</label>
            <Select
              value={draft.round}
              onChange={(e) => setDraft({ ...draft, round: e.target.value as RoundKey })}
            >
              {ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">面试语言</label>
            <Segmented<LangKey>
              value={draft.lang}
              onChange={(v) => setDraft({ ...draft, lang: v })}
              items={[
                { value: '中文', label: '中文' },
                { value: '英文', label: 'English' },
              ]}
              className="w-full justify-center"
            />
          </div>
        </div>

        <div className="hairline" />
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">自定义答题指令</label>
            <span className="text-[10px] text-txt-mute">3~5 条，写「怎么说」</span>
          </div>
          <textarea
            className="field min-h-[124px] resize-y text-[12px] leading-relaxed"
            value={draft.instructions ?? ''}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
            placeholder={
              '例：\n1. 第一句话先给结论，再展开两点依据。\n2. 每题控制在 30 秒内，简单题两三句说完。\n3. 不会的题先说不确定，再给判断和推理过程。'
            }
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[
              {
                name: '通用',
                text: '第一句话先给结论，再展开两点依据。\n每题控制在 30 秒内，简单题两三句说完。\n不会的题先说不确定，再给判断和推理过程。',
              },
              {
                name: '互联网',
                text: '第一句话给出结论或核心思路，再展开关键细节。\n方案对比讲清适用场景和最关键的取舍。\n排障题按「定位、处理、验证」的顺序说。\n概念题三四句话讲完，追问再深入。',
              },
              {
                name: '金融',
                text: '先给结论，再讲依据和适用条件。\n计算题说清口径、关键步骤和结果。\n案例题按「判断标准、主要风险、下一步行动」来答。\n每题控制在 30 秒内。',
              },
            ].map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setDraft({ ...draft, instructions: t.text })}
                className="rounded-full border border-ink-line bg-ink-sub px-2 py-[2px] text-[10px] text-txt-mute transition-colors hover:border-ink-line2 hover:text-txt-dim"
              >
                {t.name}模板
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] leading-relaxed text-txt-mute">
            只影响语气、结构和长度，不改变事实来源。点「开始本轮」时冻结，面试中途改不会影响当前场次。
          </div>
        </div>

        <div className="hairline" />
        <div className="flex items-center justify-between text-[10.5px] text-txt-mute">
          <span>创建于 {fmtDate(profile.createdAt)}</span>
          <span className="font-mono">{profile.id.slice(-6)}</span>
        </div>
      </div>
    </Panel>
  );
}
