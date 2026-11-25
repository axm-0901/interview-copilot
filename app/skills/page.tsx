'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, FileText, Layers, Plus, Sparkles, Wand2 } from 'lucide-react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { emptyCard, cardCompleteness } from '@/lib/cards';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { SkillCardItem, SkillEmpty } from '@/components/skills/SkillCardItem';
import { CardEditor } from '@/components/skills/CardEditor';
import { PrepDialog } from '@/components/skills/PrepDialog';
import type { SkillCard } from '@/lib/types';

type Filter = 'all' | 'confirmed' | 'draft';

export default function SkillsPage() {
  const { activeId, profiles, docs, cards, refreshActive, chunks } = useApp();
  const active = profiles.find((p) => p.id === activeId);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<SkillCard | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [prepping, setPrepping] = useState<SkillCard | null>(null);

  const confirmed = cards.filter((c) => c.status === 'confirmed');
  const draft = cards.filter((c) => c.status === 'draft');

  const avgPct = useMemo(() => {
    if (!cards.length) return 0;
    return Math.round(cards.reduce((n, c) => n + cardCompleteness(c).pct, 0) / cards.length);
  }, [cards]);

  const list = filter === 'all' ? cards : filter === 'confirmed' ? confirmed : draft;

  function createCard() {
    if (!activeId) return;
    // 先只在编辑器里新建，保存/确认时才落库；取消不会留下空白草稿。
    setEditing(emptyCard(activeId));
    setEditorOpen(true);
  }

  if (!activeId) {
    return (
      <div className="mx-auto max-w-[860px] px-5 py-8">
        <Panel className="p-6">
          <div className="text-[15px] font-semibold text-txt">先建一份档案</div>
          <div className="mt-1.5 text-[12px] text-txt-mute">技能卡属于某一次求职目标，先有档案才有卡。</div>
          <Link href="/profile" className="mt-4 inline-block">
            <Button variant="primary" size="md">
              去建档案
            </Button>
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] space-y-4 px-5 py-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold tracking-tight text-txt">技能卡</h2>
            <Badge tone="brand" dot>
              核心资产
            </Badge>
          </div>
          <p className="mt-1 max-w-[620px] text-[11.5px] leading-relaxed text-txt-mute">
            一张卡就是一段能被追问的事实：我的动作、我的取舍、可量化的结果。只有「已确认」的卡会被冻结进实战快照。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" onClick={() => void createCard()}>
            <Plus size={14} />
            新建卡片
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!cards.length}
            onClick={() => {
              const target = draft[0] ?? cards[0];
              if (target) setPrepping(target);
            }}
          >
            <Sparkles size={14} />
            准备对话
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: '卡片总数', value: cards.length, icon: <Layers size={11} />, tone: 'text-txt' },
          { label: '已确认', value: confirmed.length, icon: <BadgeCheck size={11} />, tone: 'text-ok' },
          { label: '草稿待补', value: draft.length, icon: <Wand2 size={11} />, tone: 'text-warn' },
          { label: '平均完整度', value: `${avgPct}%`, icon: <FileText size={11} />, tone: 'text-[#9cc0ff]' },
        ].map((x) => (
          <div
            key={x.label}
            className="flex items-center gap-2.5 rounded-card border border-ink-line/80 bg-ink-panel/70 px-3 py-2.5"
          >
            <span className="grid h-[24px] w-[24px] place-items-center rounded-[6px] border border-ink-line bg-[#0e131a] text-txt-mute">
              {x.icon}
            </span>
            <div>
              <div className="text-[10.5px] text-txt-mute">{x.label}</div>
              <div className={`font-mono text-[16px] font-semibold leading-tight ${x.tone}`}>{x.value}</div>
            </div>
          </div>
        ))}
      </div>

      {!docs.length && !chunks.length ? (
        <div className="flex items-start gap-2.5 rounded-card border border-warn/25 bg-warn/[.05] px-3.5 py-2.5">
          <FileText size={13} className="mt-[3px] shrink-0 text-warn" />
          <div className="text-[11.5px] leading-relaxed text-txt-dim">
            这个档案还没有材料。技能卡可以手写，但先上传项目材料，追问会具体得多。
            <Link href="/profile" className="ml-1 text-[#9cc0ff] underline-offset-2 hover:underline">
              去上传 →
            </Link>
          </div>
        </div>
      ) : null}

      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: '全部', count: cards.length },
          { value: 'confirmed', label: '已确认', count: confirmed.length },
          { value: 'draft', label: '草稿', count: draft.length },
        ]}
      />

      {list.length === 0 ? (
        cards.length === 0 ? (
          <div className="space-y-3">
            <SkillEmpty />
            <div className="flex justify-center gap-2">
              <Button variant="primary" size="sm" onClick={() => void createCard()}>
                <Plus size={12} />
                手写第一张卡
              </Button>
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  先传材料
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-panel border border-dashed border-ink-line py-10 text-center text-[12px] text-txt-mute">
            这个筛选下没有卡片
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((c) => (
            <SkillCardItem
              key={c.id}
              card={c}
              onEdit={() => {
                setEditing(c);
                setEditorOpen(true);
              }}
              onPrep={() => setPrepping(c)}
            />
          ))}
        </div>
      )}

      <CardEditor
        open={editorOpen}
        card={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={refreshActive}
      />

      <PrepDialog
        open={Boolean(prepping)}
        card={prepping}
        onClose={() => setPrepping(null)}
        onSaved={refreshActive}
        onOpenEditor={async () => {
          if (!prepping) return;
          const fresh = (await db.getCardsByIds([prepping.id]))[0];
          setPrepping(null);
          if (fresh) {
            setEditing(fresh);
            setEditorOpen(true);
          }
        }}
      />
    </div>
  );
}
