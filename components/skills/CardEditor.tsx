'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { normalizeCard } from '@/lib/cards';
import * as db from '@/lib/db';
import { toast } from '@/lib/toast';
import type { SkillCard } from '@/lib/types';
import { cn } from '@/lib/utils';

function ListField({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const list = items.length ? items : [''];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="label mb-0">{label}</label>
        {hint ? <span className="text-[10px] text-txt-mute">{hint}</span> : null}
      </div>
      <div className="space-y-1.5">
        {list.map((v, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <textarea
              className="field min-h-[52px] text-[12.5px] leading-relaxed"
              value={v}
              rows={2}
              placeholder={i === 0 ? placeholder : ''}
              onChange={(e) => {
                const next = [...list];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <IconButton
              className="mt-1 h-7 w-7 hover:text-danger"
              title="删除这一条"
              onClick={() => onChange(list.filter((_, x) => x !== i))}
            >
              <Trash2 size={11} />
            </IconButton>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange([...list, ''])}
        className="mt-1.5 inline-flex items-center gap-1 rounded-[6px] px-1.5 py-1 text-[11px] text-brand/85 transition-colors hover:bg-brand/[.08]"
      >
        <Plus size={11} />
        添加一条
      </button>
    </div>
  );
}

export function CardEditor({
  open,
  card,
  onClose,
  onSaved,
}: {
  open: boolean;
  card: SkillCard | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<SkillCard | null>(card);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(card ? { ...card } : null);
  }, [open, card]);

  if (!draft) return null;

  const patch = (p: Partial<SkillCard>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const save = async (status?: 'draft' | 'confirmed') => {
    if (!draft.project.trim()) {
      toast('先填项目名', 'warn');
      return;
    }
    setSaving(true);
    try {
      const next = normalizeCard({ ...draft, status: status ?? draft.status });
      await db.putCard(next);
      await onSaved();
      toast(
        next.status === 'confirmed' ? '已确认，可进入快照' : '已保存为草稿',
        'ok',
        `指纹 ${next.fingerprint.slice(0, 8)}`
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          编辑技能卡
          <Badge tone={draft.status === 'confirmed' ? 'ok' : 'warn'}>
            {draft.status === 'confirmed' ? '已确认' : '草稿'}
          </Badge>
        </span>
      }
      desc="只有「已确认」的卡片才会进入实战上下文。编辑后会自动重算指纹。"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="outline" onClick={() => void save('draft')} loading={saving}>
            存为草稿
          </Button>
          <Button variant="primary" onClick={() => void save('confirmed')} loading={saving}>
            <CheckCircle2 size={13} />
            保存并确认
          </Button>
        </>
      }
    >
      <div className="max-h-[62vh] space-y-3.5 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="label">项目名</label>
            <input
              className="field"
              value={draft.project}
              onChange={(e) => patch({ project: e.target.value })}
              placeholder="例如：订单履约系统重构"
            />
          </div>
          <div>
            <label className="label">时间区间</label>
            <input
              className="field font-mono text-[12px]"
              value={draft.period}
              onChange={(e) => patch({ period: e.target.value })}
              placeholder="2023.03 – 2023.09"
            />
          </div>
        </div>

        <div>
          <label className="label">我的角色</label>
          <input
            className="field"
            value={draft.role}
            onChange={(e) => patch({ role: e.target.value })}
            placeholder="写「我」的角色，不是团队的角色"
          />
        </div>

        <div>
          <label className="label">背景（一句话）</label>
          <textarea
            className="field min-h-[52px] text-[12.5px] leading-relaxed"
            value={draft.background}
            rows={2}
            onChange={(e) => patch({ background: e.target.value })}
            placeholder="当时是什么问题、为什么要做。不要写公司介绍。"
          />
        </div>

        <div className="hairline" />

        <ListField
          label="我的具体动作"
          hint="必须是「我」做的"
          items={draft.actions}
          onChange={(v) => patch({ actions: v })}
          placeholder="例如：把同步调用改成事件驱动，主链路只写本地消息表"
        />

        <ListField
          label="关键决策与取舍"
          hint="为什么这么做、放弃了什么"
          items={draft.decisions}
          onChange={(v) => patch({ decisions: v })}
          placeholder="例如：没上 Seata，因为大促时协调者是单点，接受秒级中间态换吞吐"
        />

        <ListField
          label="可量化结果"
          hint="数字必须有来源"
          items={draft.results}
          onChange={(v) => patch({ results: v })}
          placeholder="例如：P99 从 380ms 降到 95ms（同机房灰度对比）"
        />

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label className="label mb-0">可能的追问</label>
            <span className="text-[10px] text-txt-mute">3 条最佳</span>
          </div>
          <div className="space-y-1.5">
            {(draft.followups.length ? draft.followups : [{ q: '', a: '' }]).map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="flex-1 space-y-1">
                  <input
                    className="field text-[12px]"
                    value={f.q}
                    placeholder="面试官可能问：这里为什么不用事务消息？"
                    onChange={(e) => {
                      const next = [...draft.followups];
                      next[i] = { ...next[i], q: e.target.value };
                      patch({ followups: next });
                    }}
                  />
                  <input
                    className="field text-[12px]"
                    value={f.a}
                    placeholder="一句话应答"
                    onChange={(e) => {
                      const next = [...draft.followups];
                      next[i] = { ...next[i], a: e.target.value };
                      patch({ followups: next });
                    }}
                  />
                </div>
                <IconButton
                  className="mt-1 h-7 w-7 hover:text-danger"
                  onClick={() => patch({ followups: draft.followups.filter((_, x) => x !== i) })}
                >
                  <Trash2 size={11} />
                </IconButton>
              </div>
            ))}
          </div>
          <button
            onClick={() => patch({ followups: [...draft.followups, { q: '', a: '' }] })}
            className="mt-1.5 inline-flex items-center gap-1 rounded-[6px] px-1.5 py-1 text-[11px] text-brand/85 transition-colors hover:bg-brand/[.08]"
          >
            <Plus size={11} />
            添加一组
          </button>
        </div>
      </div>

      <div
        className={cn(
          'mt-3 rounded-[7px] border px-2.5 py-2 text-[11px] leading-relaxed',
          draft.status === 'confirmed'
            ? 'border-ok/25 bg-ok/[.05] text-txt-dim'
            : 'border-warn/25 bg-warn/[.05] text-txt-dim'
        )}
      >
        {draft.status === 'confirmed'
          ? '当前为已确认状态：这张卡会被冻结进下一轮快照，答稿可以引用它的事实。'
          : '草稿不会进入上下文。补齐动作、取舍、结果后点「保存并确认」。'}
      </div>
    </Dialog>
  );
}
