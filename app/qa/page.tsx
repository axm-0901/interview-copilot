'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { normalizeKey, parseFaqMarkdown } from '@/lib/faqTemplate';
import { deleteQAsByIds, planQAImport } from '@/lib/qaImport';
import { matchQA, qaThreshold, rankQA } from '@/lib/qaMatch';
import type { QAEntry } from '@/lib/types';

interface FormState {
  question: string;
  aliases: string;
  answer: string;
  tags: string;
}

const EMPTY: FormState = { question: '', aliases: '', answer: '', tags: '' };

export default function QAPage() {
  const { activeId, qas, refreshActive, profiles, settings } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QAEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [replaceMode, setReplaceMode] = useState(false);
  const [importing, setImporting] = useState(false);
  const [probe, setProbe] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseFaqMarkdown(importText), [importText]);
  /** 导入计划：预览重复问法，也保证真正写入时和预览看到的一致。 */
  const importPlan = useMemo(
    () =>
      activeId
        ? planQAImport({
            profileId: activeId,
            parsed: parsed.entries,
            existing: qas,
            replace: replaceMode,
          })
        : null,
    [activeId, parsed, qas, replaceMode]
  );
  const probeHit = useMemo(
    () => (probe.trim() ? matchQA(probe, qas) : null),
    [probe, qas]
  );
  const probeRanked = useMemo(
    () => (probe.trim() ? rankQA(probe, qas, 4) : []),
    [probe, qas]
  );
  /** 同一个问法挂在两道题上，是串答案的头号原因。 */
  const conflicts = useMemo(() => {
    const byKey = new Map<string, { id: string; question: string; key: string }[]>();
    for (const qa of qas) {
      for (const v of [qa.question, ...qa.aliases]) {
        const key = normalizeKey(v);
        if (!key) continue;
        const list = byKey.get(key) ?? [];
        if (!list.some((x) => x.id === qa.id)) list.push({ id: qa.id, question: qa.question, key: v });
        byKey.set(key, list);
      }
    }
    return [...byKey.values()].filter((list) => new Set(list.map((x) => x.id)).size > 1);
  }, [qas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qas;
    return qas.filter((x) =>
      [x.question, ...x.aliases, x.answer, ...x.tags].join('\n').toLowerCase().includes(q)
    );
  }, [qas, query]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (qa: QAEntry) => {
    setEditing(qa);
    setForm({
      question: qa.question,
      aliases: qa.aliases.join('\n'),
      answer: qa.answer,
      tags: qa.tags.join('，'),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!activeId) return toast('先建一份面试档案', 'warn');
    const question = form.question.trim();
    const answer = form.answer.trim();
    if (!question) return toast('题目不能为空', 'warn');
    if (!answer) return toast('标准答案不能为空', 'warn');

    const aliases = form.aliases
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s, i, arr) => arr.indexOf(s) === i);

    // 同一个问法不能同时挂在两道题上，否则实战一定会串答案。
    const newKeys = new Set([question, ...aliases].map(normalizeKey).filter(Boolean));
    const conflict = qas.find(
      (x) =>
        x.id !== editing?.id &&
        [x.question, ...x.aliases].some((v) => newKeys.has(normalizeKey(v)))
    );
    if (conflict) {
      return toast(
        '这个问法和已有题目重复',
        'warn',
        `「${conflict.question}」已经用过同一句问法，换成更具体的说法再保存`
      );
    }

    setSaving(true);
    try {
      const now = Date.now();
      const entry: QAEntry = {
        id: editing?.id ?? db.uid('qa'),
        profileId: activeId,
        question,
        aliases,
        answer,
        tags: form.tags
          .split(/[，,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
      };
      await db.putQA(entry);
      await refreshActive();
      setOpen(false);
      toast(editing ? '已更新标准问答' : '已加入标准问答', 'ok', '下一轮命中后会原样显示');
    } catch (e: any) {
      toast('保存失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (qa: QAEntry) => {
    if (!window.confirm(`删除「${qa.question}」？`)) return;
    await db.deleteQA(qa.id);
    await refreshActive();
    toast('已删除', 'ok');
  };

  const openImport = () => {
    setImportText('');
    setReplaceMode(false);
    setImportOpen(true);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    toast('已读取文件', 'ok', file.name);
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/faq-template.md');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '面试标准问答模板.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('模板已下载', 'ok', '发给 GPT，让它按格式生成');
    } catch {
      toast('模板下载失败', 'err');
    }
  };

  const doImport = async () => {
    if (!activeId) return toast('先建一份面试档案', 'warn');
    if (!parsed.entries.length) return toast('没有识别到题目', 'warn', '检查一下「问：」和「答：」格式');
    if (!importPlan) return;
    if (importPlan.conflicts.length) {
      return toast(
        '导入文件里有重复问法',
        'warn',
        `${importPlan.conflicts.length} 组问法同时挂在两道题上，先在预览里改掉再导入`
      );
    }
    if (
      replaceMode &&
      !window.confirm(
        `将用 ${importPlan.items.length} 题替换当前 ${qas.length} 题：先写入新题库，写入成功后才删除不再需要的 ${importPlan.removeIds.length} 道旧题。继续？`
      )
    )
      return;

    setImporting(true);
    try {
      const now = Date.now();
      const toPut: QAEntry[] = importPlan.items.map((item) => ({
        id: item.existingId ?? db.uid('qa'),
        profileId: activeId,
        question: item.question,
        aliases: item.aliases,
        answer: item.answer,
        tags: item.tags,
        createdAt: item.createdAt ?? now,
        updatedAt: now,
      }));

      // 先把新题库整批写进去（单事务，失败自动回滚），旧题这时完全没动。
      await db.putQAs(toPut);

      // 写入成功后才清理替换模式下的旧题；清理失败最多留下旧题，不会丢新题。
      let removeFailed = 0;
      if (replaceMode && importPlan.removeIds.length) {
        try {
          await deleteQAsByIds(importPlan.removeIds);
        } catch {
          removeFailed = importPlan.removeIds.length;
        }
      }

      await refreshActive();
      setImportOpen(false);
      if (removeFailed) {
        toast(
          '新题库已写入，但旧题未清理干净',
          'warn',
          `还有 ${removeFailed} 道旧题没删掉，再导入一次或到列表里手动删除`
        );
      } else if (replaceMode) {
        toast(
          `已替换为 ${importPlan.items.length} 题`,
          'ok',
          `${importPlan.created} 题新增，${importPlan.updated} 题更新，${importPlan.removeIds.length} 道旧题已删除`
        );
      } else {
        toast(
          `已导入 ${importPlan.items.length} 题`,
          'ok',
          `${importPlan.created} 题新增${importPlan.updated ? `，${importPlan.updated} 题更新` : ''}`
        );
      }
    } catch (e: any) {
      // putQAs 是单事务：失败时旧题库保持原样
      toast('导入失败，题库未改动', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setImporting(false);
    }
  };

  const syncMobile = async () => {
    if (!activeId || !qas.length) return;
    setSyncing(true);
    try {
      const profile = profiles.find((p) => p.id === activeId);
      const res = await fetch('/api/mobile/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncedAt: Date.now(),
          profile: profile
            ? {
                name: profile.name,
                company: profile.company,
                targetRole: profile.targetRole,
                round: profile.round,
                lang: profile.lang,
                instructions: profile.instructions,
              }
            : undefined,
          qas: qas.map((q) => ({
            id: q.id,
            question: q.question,
            aliases: q.aliases,
            answer: q.answer,
            tags: q.tags,
          })),
          settings: {
            apiBase: settings.apiBase,
            apiKey: settings.apiKey,
            model: settings.model,
            fastModel: settings.fastModel,
            noThink: settings.noThink,
            temperature: settings.temperature,
            asrBase: settings.asrBase,
            asrKey: settings.asrKey,
            asrModel: settings.asrModel,
            asrFinalModel: settings.asrFinalModel,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `同步失败（${res.status}）`);
      toast(
        `已同步 ${data?.qas ?? qas.length} 题`,
        'ok',
        '手机浏览器打开 /m，点右上角「同步」即可；只同步题库和配置，不上传面试现场音频'
      );
    } catch (e: any) {
      toast('手机同步失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mx-auto max-w-[980px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight text-txt">标准问答</h1>
            <Badge tone="brand">命中即答</Badge>
            {profiles.find((p) => p.id === activeId)?.company ? (
              <Badge tone="muted">{profiles.find((p) => p.id === activeId)?.company}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-txt-mute">
            提前把面试官可能问的问题、同义问法和完整答案写进去。实战命中后原样显示，不经过模型改写，也没有思考延迟。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="md"
            onClick={() => void syncMobile()}
            disabled={!activeId || !qas.length || syncing}
          >
            <Smartphone size={14} />
            {syncing ? '同步中…' : '同步到手机'}
          </Button>
          <Button variant="outline" size="md" onClick={() => void downloadTemplate()}>
            <Download size={14} />
            模板
          </Button>
          <Button variant="outline" size="md" onClick={openImport} disabled={!activeId}>
            <Upload size={14} />
            导入
          </Button>
          <Button variant="primary" size="md" onClick={openNew} disabled={!activeId}>
            <Plus size={14} />
            添加题目
          </Button>
        </div>
      </div>

      <Panel className="mb-3 flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-mute" />
          <input
            className="field h-[32px] pl-8 text-[12px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索题目、同义问法或答案…"
          />
        </div>
        <div className="text-[11px] text-txt-mute">
          共 <span className="font-mono text-txt">{qas.length}</span> 题
          {query ? ` · 命中 ${filtered.length}` : ''}
        </div>
      </Panel>

      <Panel className="mb-3 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="text-[12px] font-medium text-txt">命中测试</div>
          <div className="text-[10.5px] text-txt-mute">
            输入面试官可能说的一句话，看会不会串题；只比对题目和同义问法，不调用模型。
          </div>
        </div>
        <input
          className="field mt-2 h-[32px] text-[12px]"
          value={probe}
          onChange={(e) => setProbe(e.target.value)}
          placeholder="例如：能不能接受工作岗位调剂 / 能不能接受工作地点调剂"
        />
        {probe.trim() ? (
          <div className="mt-2 space-y-1.5">
            <div
              className={cn(
                'rounded-[6px] border px-2 py-1.5 text-[11px]',
                probeHit
                  ? 'border-ok/30 bg-ok/[.06] text-[#bfe8d6]'
                  : 'border-warn/30 bg-warn/[.06] text-[#f3cf8e]'
              )}
            >
              {probeHit
                ? `会命中「${probeHit.entry.question}」· 命中问法：${probeHit.variant}`
                : '不会命中标准问答，交给模型现场生成'}
            </div>
            {probeRanked.map((c) => (
              <div
                key={`${c.entry.id}-${c.variant}`}
                className="rounded-[6px] border border-ink-line/60 bg-[#0e131a]/50 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-txt-dim">{c.entry.question}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-txt-mute">
                    {c.score.toFixed(2)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-txt-mute">
                  问法：{c.variant} · 覆盖 {Math.round(c.coverage * 100)}%
                </div>
              </div>
            ))}
            {probeRanked.length > 1 &&
            probeRanked[0].entry.id !== probeRanked[1].entry.id &&
            probeRanked[0].score - probeRanked[1].score < 0.08 ? (
              <div className="text-[10.5px] leading-relaxed text-warn">
                两道题分数太接近，系统会放弃命中，避免把另一道题的答案贴出来。
              </div>
            ) : null}
            <div className="text-[10px] text-txt-mute">
              命中门槛 {qaThreshold(probe).toFixed(2)}；还会检查双向覆盖、意图/对象是否一致；任一不满足或前两名太接近，都不会出标准答案。
            </div>
          </div>
        ) : null}

        {conflicts.length ? (
          <div className="mt-2 rounded-[6px] border border-warn/30 bg-warn/[.06] px-2 py-1.5 text-[10.5px] leading-relaxed text-[#f3cf8e]">
            检测到 {conflicts.length} 组重复问法，可能串题：
            {conflicts
              .slice(0, 3)
              .map((list) => list.map((x) => x.question).join(' / '))
              .join('；')}
            。请把同义问法写得更具体，或删掉重复的那条。
          </div>
        ) : null}
      </Panel>

      {!activeId ? (
        <Empty text="还没有面试档案。先去「面试档案」建一份，再往这里加题。" />
      ) : filtered.length === 0 ? (
        <Empty
          text={
            qas.length === 0
              ? '还没有标准问答。先把「自我介绍」「为什么选我们公司」「你最大的缺点」这几道高频题写进去。'
              : '没有匹配的题目。'
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((qa) => (
            <Panel key={qa.id} className="group px-4 py-3 transition-colors hover:border-ink-line2">
              <div className="flex items-start gap-3">
                <div className="mt-[2px] grid h-7 w-7 shrink-0 place-items-center rounded-[7px] border border-brand/20 bg-brand/[.08] text-brand">
                  <MessageSquareText size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => openEdit(qa)}
                      className="text-left text-[13px] font-medium leading-relaxed text-txt hover:text-[#a8c6ff]"
                    >
                      {qa.question}
                    </button>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(qa)}
                        className="rounded-[6px] p-1.5 text-txt-mute hover:bg-white/[.06] hover:text-txt"
                        title="编辑"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => void remove(qa)}
                        className="rounded-[6px] p-1.5 text-txt-mute hover:bg-danger/10 hover:text-danger"
                        title="删除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {qa.aliases.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {qa.aliases.slice(0, 4).map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-ink-line bg-ink-sub px-2 py-[1px] text-[10px] text-txt-mute"
                        >
                          {a}
                        </span>
                      ))}
                      {qa.aliases.length > 4 ? (
                        <span className="px-1 text-[10px] text-txt-mute/70">+{qa.aliases.length - 4}</span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-[11.5px] leading-relaxed text-txt-dim">
                    {qa.answer}
                  </p>

                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-txt-mute">
                    <span className="inline-flex items-center gap-1 text-ok/80">
                      <Sparkles size={9} />
                      命中后原样显示
                    </span>
                    {qa.tags.map((t) => (
                      <span key={t} className="text-txt-mute/70">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[640px] overflow-hidden rounded-panel border border-ink-line2 bg-ink-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-line/70 px-4 py-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-txt">
                <MessageSquareText size={14} className="text-brand" />
                {editing ? '编辑题目' : '添加题目'}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-[6px] p-1.5 text-txt-mute hover:bg-white/[.06] hover:text-txt"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
              <div>
                <label className="label">题目</label>
                <textarea
                  className="field min-h-[58px] resize-y text-[12.5px]"
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="面试官可能怎么问，例如：为什么选择我们公司"
                />
              </div>
              <div>
                <label className="label">同义问法（每行一条，可选）</label>
                <textarea
                  className="field min-h-[72px] resize-y text-[12.5px]"
                  value={form.aliases}
                  onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))}
                  placeholder={'换个说法也能命中，例如：\n为什么想来我们这边\n你选择我们的原因是什么'}
                />
                <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                  尽量写完整问句，不要只写「调剂」「薪资」这种单个词；越短越容易和别的题互相串。
                </div>
              </div>
              <div>
                <label className="label">标准答案（命中后原样显示）</label>
                <textarea
                  className="field min-h-[190px] resize-y text-[12.5px] leading-relaxed"
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  placeholder="准备好的一段完整回答。可以分几段，但不要写成 bullet 清单。"
                />
              </div>
              <div>
                <label className="label">标签（逗号分隔，可选）</label>
                <input
                  className="field text-[12.5px]"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="自我介绍，公司，行为"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ink-line/70 px-4 py-3">
              <div className="text-[10.5px] text-txt-mute">
                命中只比对题目与同义问法，答案不会被改写。
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  取消
                </Button>
                <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
          onClick={() => setImportOpen(false)}
        >
          <div
            className="w-full max-w-[720px] overflow-hidden rounded-panel border border-ink-line2 bg-ink-panel shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-line/70 px-4 py-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-txt">
                <FileUp size={14} className="text-brand" />
                批量导入标准问答
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="rounded-[6px] p-1.5 text-txt-mute hover:bg-white/[.06] hover:text-txt"
              >
                <X size={14} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    void onFile(f);
                  }}
                />
                <Button variant="subtle" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} />
                  选择 .md 文件
                </Button>
                <span className="text-[10.5px] text-txt-mute">
                  也可以把 GPT 生成的 Markdown 直接粘贴到下面
                </span>
              </div>

              <textarea
                className="field min-h-[180px] resize-y font-mono text-[11.5px] leading-relaxed"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'---\n问：请你先做一个自我介绍\n同义：简单介绍一下自己\n同义：一分钟自我介绍\n答：\n第一段…\n第二段…\n---\n问：…'}
              />

              <div className="rounded-card border border-ink-line/70 bg-[#0e131a]/60 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[12px] font-medium text-txt">
                    识别到 <span className="font-mono text-ok">{parsed.entries.length}</span> 题
                  </div>
                  {parsed.errors.length ? (
                    <div className="inline-flex items-center gap-1 text-[10.5px] text-warn">
                      <TriangleAlert size={10} />
                      {parsed.errors.length} 段跳过
                    </div>
                  ) : null}
                </div>

                {parsed.entries.length ? (
                  <div className="mt-2 space-y-1.5">
                    {parsed.entries.slice(0, 3).map((e, i) => (
                      <div key={i} className="rounded-[6px] border border-ink-line/50 bg-ink-sub/40 px-2 py-1.5">
                        <div className="truncate text-[11.5px] text-txt-dim">{e.question}</div>
                        <div className="mt-0.5 truncate text-[10px] text-txt-mute">
                          {e.aliases.length ? `${e.aliases.length} 条同义问法 · ` : ''}
                          {e.answer.slice(0, 60)}…
                        </div>
                      </div>
                    ))}
                    {parsed.entries.length > 3 ? (
                      <div className="pl-1 text-[10px] text-txt-mute">
                        还有 {parsed.entries.length - 3} 题…
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10.5px] leading-relaxed text-txt-mute">
                    还没有识别到题目。每题用单独一行 <code className="text-[10px]">---</code> 分隔，并包含
                    <code className="text-[10px]"> 问：</code> 和 <code className="text-[10px]"> 答：</code>。
                  </div>
                )}

                {parsed.errors.length ? (
                  <div className="mt-2 space-y-1">
                    {parsed.errors.slice(0, 4).map((err, i) => (
                      <div key={i} className="text-[10px] leading-relaxed text-warn/90">
                        · {err}
                      </div>
                    ))}
                  </div>
                ) : null}

                {importPlan?.conflicts.length ? (
                  <div className="mt-2 rounded-[6px] border border-danger/35 bg-danger/[.07] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-danger">
                      <TriangleAlert size={11} />
                      有 {importPlan.conflicts.length} 组重复问法，导入后会串答案
                    </div>
                    <div className="mt-1 space-y-1">
                      {importPlan.conflicts.slice(0, 4).map((c) => (
                        <div key={c.key} className="text-[10px] leading-relaxed text-[#f0a8a6]">
                          「{c.owners[0]?.variant}」同时出现在：
                          {[...new Set(c.owners.map((o) => o.question))].join(' / ')}
                        </div>
                      ))}
                      {importPlan.conflicts.length > 4 ? (
                        <div className="text-[10px] text-txt-mute">
                          还有 {importPlan.conflicts.length - 4} 组…
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                      同一条问法只能挂在一道题上。删掉重复的同义问法，或改得更具体后再导入。
                    </div>
                  </div>
                ) : null}
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-relaxed text-txt-dim">
                <input
                  type="checkbox"
                  checked={replaceMode}
                  onChange={(e) => setReplaceMode(e.target.checked)}
                  className="mt-[2px] accent-[#4d8dff]"
                />
                <span>
                  用本次导入替换现有题库
                  <span className="text-txt-mute">
                    （先把新题库写入成功，再删除其余 {importPlan?.removeIds.length ?? 0} 道旧题，不会先清空）
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-ink-line/70 px-4 py-3">
              <div className="text-[10.5px] text-txt-mute">
                {importPlan?.conflicts.length
                  ? `有 ${importPlan.conflicts.length} 组重复问法，先处理完才能导入`
                  : '同题会合并同义问法并更新答案；重复问法会在导入前拦下。'}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={importing}
                  disabled={!parsed.entries.length || (importPlan?.conflicts.length ?? 0) > 0}
                  onClick={() => void doImport()}
                >
                  导入 {parsed.entries.length || ''} 题
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Panel className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-[12px] border border-ink-line bg-ink-sub text-txt-mute">
        <MessageSquareText size={17} />
      </div>
      <p className={cn('mt-3 max-w-[420px] text-[12px] leading-relaxed text-txt-mute')}>{text}</p>
    </Panel>
  );
}
