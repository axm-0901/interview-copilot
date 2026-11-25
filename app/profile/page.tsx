'use client';

import { useEffect, useState } from 'react';
import { FilePlus2, FolderOpen, Layers, Plus, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store';
import { seedSample } from '@/lib/sample';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Dialog } from '@/components/ui/Dialog';
import { ROUNDS, type LangKey, type RoundKey } from '@/lib/types';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { MaterialPanel } from '@/components/profile/MaterialPanel';
import { InsightPanel } from '@/components/profile/InsightPanel';
import { ResearchPanel } from '@/components/profile/ResearchPanel';

const BLANK_FORM = {
  name: '新的面试档案',
  targetRole: '',
  company: '',
  round: '一面' as RoundKey,
  lang: '中文' as LangKey,
};

export default function ProfilePage() {
  const { activeId, profiles, docs, chunks, refreshActive, createProfile } = useApp();
  const active = profiles.find((p) => p.id === activeId);
  const [newOpen, setNewOpen] = useState(false);
  const [nameError, setNameError] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });

  const openNewProfile = () => {
    setForm({ ...BLANK_FORM });
    setNameError('');
    setNewOpen(true);
  };

  // 侧栏「+ 新建档案」既会带上 ?new=1 导航，也会在当前页直接派发事件。
  useEffect(() => {
    const open = () => {
      setForm({ ...BLANK_FORM });
      setNameError('');
      setNewOpen(true);
    };
    if (new URLSearchParams(window.location.search).get('new') === '1') open();
    window.addEventListener('profile:new', open);
    return () => window.removeEventListener('profile:new', open);
  }, []);

  const submitNew = async () => {
    const name = form.name.trim();
    if (!name) {
      setNameError('档案名不能为空');
      return;
    }
    if (creating) return;
    setNameError('');
    setCreating(true);
    try {
      await createProfile({
        ...form,
        name,
        company: form.company.trim(),
        targetRole: form.targetRole.trim(),
      });
      setNewOpen(false);
      toast('档案已创建', 'ok', '先上传简历和 JD');
    } catch (e: any) {
      toast('创建失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setCreating(false);
    }
  };

  const newDialog = (
    <NewProfileDialog
      open={newOpen}
      onClose={() => setNewOpen(false)}
      form={form}
      setForm={setForm}
      error={nameError}
      creating={creating}
      onSubmit={submitNew}
      clearError={() => setNameError('')}
    />
  );

  if (!active) {
    return (
      <>
        <div className="mx-auto max-w-[860px] px-5 py-8">
          <Panel className="p-6">
            <div className="text-[15px] font-semibold text-txt">还没有面试档案</div>
            <div className="mt-1.5 text-[12px] leading-relaxed text-txt-mute">
              一份档案对应一次求职目标的垂直切片：目标岗位、公司、轮次、材料、技能卡、场次都挂在它下面。
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="md" onClick={openNewProfile}>
                <Plus size={14} />
                新建档案
              </Button>
              <Button
                variant="outline"
                size="md"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const p = await seedSample();
                    await useApp.getState().refreshProfiles();
                    await useApp.getState().setActive(p.id);
                    toast('示例档案已载入', 'ok');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Sparkles size={14} />
                载入示例档案
              </Button>
            </div>
          </Panel>
        </div>
        {newDialog}
      </>
    );
  }

  const chars = docs.reduce((n, d) => n + d.chars, 0);

  return (
    <>
      <div className="mx-auto max-w-[1240px] space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-txt">面试档案</h1>
            <p className="mt-1 text-[11.5px] text-txt-mute">
              一家公司一份档案：题库、JD、简历、技能卡和调研结果都互相隔离。
            </p>
          </div>
          <Button variant="primary" size="md" onClick={openNewProfile}>
            <Plus size={14} />
            新建面试档案
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[316px_1fr]">
          <div className="space-y-4">
            <ProfileForm profile={active} />

          <Panel className="px-4 py-3.5">
            <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.14em] text-txt-mute">
              索引概况
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '文档', value: docs.length, icon: <FolderOpen size={11} /> },
                { label: '片段', value: chunks.length, icon: <Layers size={11} /> },
                {
                  label: '字数',
                  value: chars > 999 ? `${(chars / 1000).toFixed(1)}k` : chars,
                  icon: <FilePlus2 size={11} />,
                },
              ].map((x) => (
                <div
                  key={x.label}
                  className="rounded-[8px] border border-ink-line/70 bg-[#0e131a]/60 px-2 py-2 text-center"
                >
                  <div className="flex items-center justify-center gap-1 text-[10.5px] text-txt-mute">
                    {x.icon}
                    {x.label}
                  </div>
                  <div className="mt-1 font-mono text-[15px] font-semibold text-txt">{x.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 rounded-[7px] border border-ink-line/60 bg-[#0e131a]/40 px-2.5 py-2 text-[10.5px] leading-relaxed text-txt-mute">
              切块大小 420 字、重叠 60 字；中文按二元切分建 BM25 索引，同一文档最多命中 2 段。
            </div>
          </Panel>

            <Button variant="outline" size="md" className="w-full" onClick={openNewProfile}>
              <Plus size={14} />
              新建档案
            </Button>
          </div>

          <MaterialPanel profileId={active.id} docs={docs} onChanged={refreshActive} />
        </div>

        <InsightPanel profile={active} docs={docs} />
        <ResearchPanel profile={active} docs={docs} />
      </div>
      {newDialog}
    </>
  );
}

function NewProfileDialog({
  open,
  onClose,
  form,
  setForm,
  error,
  creating,
  onSubmit,
  clearError,
}: {
  open: boolean;
  onClose: () => void;
  form: any;
  setForm: (v: any) => void;
  error: string;
  creating: boolean;
  onSubmit: () => Promise<void>;
  clearError: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="新建面试档案"
      desc="每家公司单独一份：题库、JD、简历和调研结果互相隔离，面试时只读选中的那一份。"
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" loading={creating} onClick={() => void onSubmit()}>
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">档案名</label>
          <input
            className="field"
            value={form.name}
            aria-invalid={!!error}
            onChange={(e) => {
              clearError();
              setForm({ ...form, name: e.target.value });
            }}
            placeholder="例如：中国铁塔 · AI 方向 · 一面"
          />
          {error ? (
            <div className="mt-1 text-[10.5px] text-danger">{error}</div>
          ) : (
            <div className="mt-1 text-[10px] text-txt-mute">不能为空；同名档案不会自动区分。</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="label">公司</label>
            <input
              className="field"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="字节跳动"
            />
          </div>
          <div>
            <label className="label">轮次</label>
            <select
              className="field"
              value={form.round}
              onChange={(e) => setForm({ ...form, round: e.target.value })}
            >
              {ROUNDS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">目标岗位</label>
          <input
            className="field"
            value={form.targetRole}
            onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
            placeholder="后端开发工程师（增长方向）"
          />
        </div>
        <div>
          <label className="label">面试语言</label>
          <select
            className="field"
            value={form.lang}
            onChange={(e) => setForm({ ...form, lang: e.target.value })}
          >
            <option value="中文">中文</option>
            <option value="英文">English</option>
          </select>
        </div>
      </div>
    </Dialog>
  );
}
