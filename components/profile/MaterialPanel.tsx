'use client';

import { useRef, useState } from 'react';
import {
  ClipboardType,
  FileText,
  FolderUp,
  Loader2,
  UploadCloud,
} from 'lucide-react';
import * as db from '@/lib/db';
import { parseFile } from '@/lib/parse';
import { splitIntoChunks, tokenize } from '@/lib/retrieval';
import { useApp } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHead } from '@/components/ui/Panel';
import { Dialog } from '@/components/ui/Dialog';
import { DocList } from './DocList';
import { PasteDialog } from './PasteDialog';
import { DOC_TYPE_LABEL, type Doc } from '@/lib/types';
import { cn } from '@/lib/utils';

type Slot = 'resume' | 'jd' | 'project';

const SLOTS: { key: Slot; title: string; hint: string; accept: string; icon: any }[] = [
  {
    key: 'resume',
    title: '简历',
    hint: 'PDF / DOCX / TXT / MD，可多份',
    accept: '.pdf,.docx,.txt,.md,.markdown',
    icon: FileText,
  },
  {
    key: 'jd',
    title: '岗位 JD',
    hint: '粘贴文本，或上传正式 JD',
    accept: '.pdf,.docx,.txt,.md',
    icon: ClipboardType,
  },
  {
    key: 'project',
    title: '项目材料',
    hint: '项目复盘 / 设计文档 / 周报；写清你的角色和结果',
    accept: '.pdf,.docx,.txt,.md,.markdown',
    icon: FolderUp,
  },
];

export function MaterialPanel({
  profileId,
  docs,
  onChanged,
}: {
  profileId: string;
  docs: Doc[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState<Slot | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pendingDel, setPendingDel] = useState<Doc | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const totalChunks = docs.reduce((n, d) => n + Math.max(1, Math.ceil(d.chars / 420)), 0);

  const isActiveProfile = (target: string) => useApp.getState().activeId === target;

  function buildChunks(docId: string, ownerId: string, text: string) {
    return splitIntoChunks(text).map((p, idx) => ({
      id: db.uid('ch'),
      docId,
      profileId: ownerId,
      idx,
      text: p,
      tokens: tokenize(p),
    }));
  }

  /** 文档和片段在同一个事务里写入；切不出片段时连文档也不落库。 */
  async function storeDoc(doc: Doc, text: string) {
    const chunks = buildChunks(doc.id, doc.profileId, text);
    if (!chunks.length) return 0;
    await db.putDocWithChunks(doc, chunks);
    return chunks.length;
  }

  async function handleFiles(files: FileList | null, type: Slot) {
    if (!files?.length) return;
    const target = profileId;
    for (const f of Array.from(files)) {
      if (!isActiveProfile(target)) {
        toast('档案已切换，已停止导入', 'warn', '剩余文件没有写入任何档案');
        break;
      }
      setBusy(`解析 ${f.name}…`);
      try {
        const { text, note } = await parseFile(f);
        if (!text || !text.trim()) {
          toast(`《${f.name}》没提取到文字`, 'warn', note ?? '可能是扫描件，建议直接粘贴文本');
          continue;
        }
        // 解析期间可能已经切档：写入前再确认一次，避免把材料挂到新档案上。
        if (!isActiveProfile(target)) {
          toast('档案已切换，已停止导入', 'warn', `《${f.name}》未保存`);
          break;
        }
        const doc: Doc = {
          id: db.uid('doc'),
          profileId: target,
          name: f.name,
          type,
          chars: text.length,
          source: 'file',
          createdAt: Date.now(),
          raw: text,
        };
        const n = await storeDoc(doc, text);
        if (!n) {
          toast(`《${f.name}》未保存`, 'warn', `有效内容 ${text.trim().length} 字，切不出可检索片段（每段需超过 20 字）`);
          continue;
        }
        toast(
          `《${f.name}》解析完成`,
          'ok',
          `${text.length} 字 · 切成 ${n} 个片段${note ? ` · ${note}` : ''}`
        );
      } catch (e: any) {
        toast(`解析失败：${f.name}`, 'err', String(e?.message ?? e).slice(0, 160));
      }
    }
    setBusy(null);
    await onChanged();
  }

  async function savePaste(input: { name: string; type: Doc['type']; text: string }) {
    if (!isActiveProfile(profileId)) {
      toast('档案已切换，本次粘贴未保存', 'warn');
      return false;
    }
    const name =
      input.name || `${DOC_TYPE_LABEL[input.type]} · ${new Date().toLocaleDateString('zh-CN')}`;
    const doc: Doc = {
      id: db.uid('doc'),
      profileId,
      name,
      type: input.type,
      chars: input.text.length,
      source: 'paste',
      createdAt: Date.now(),
      raw: input.text,
    };
    try {
      const n = await storeDoc(doc, input.text);
      if (!n) {
        toast('内容太短，未保存', 'warn', `有效内容 ${input.text.trim().length} 字，切不出可检索片段（每段需超过 20 字）`);
        return false;
      }
      toast('已保存并建立索引', 'ok', `${input.text.length} 字 · ${n} 个片段`);
      await onChanged();
      return true;
    } catch (e: any) {
      toast('保存失败', 'err', String(e?.message ?? e).slice(0, 160));
      return false;
    }
  }

  async function reindex(doc: Doc) {
    if (!doc.raw) {
      toast('这份文档没有保存原文', 'warn', '请重新上传一次');
      return;
    }
    const ownerId = doc.profileId || profileId;
    if (ownerId !== profileId || !isActiveProfile(ownerId)) {
      toast('档案已切换，已取消重建索引', 'warn');
      return;
    }
    setBusy(`重新索引 ${doc.name}…`);
    try {
      const chunks = buildChunks(doc.id, ownerId, doc.raw);
      if (!chunks.length) {
        toast('原文切不出片段，索引未改动', 'warn', '切块要求每段超过 20 字；旧索引仍然可用');
        return;
      }
      if (!isActiveProfile(ownerId)) {
        toast('档案已切换，已取消重建索引', 'warn');
        return;
      }
      // 删除旧片段与写入新片段在同一个事务里：失败时回滚，旧索引不会丢。
      await db.replaceChunksOfDoc(doc.id, chunks);
      toast('索引已重建', 'ok', `${chunks.length} 个片段`);
      await onChanged();
    } catch (e: any) {
      toast('重建索引失败，旧索引保持不变', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel>
      <PanelHead
        title="材料与索引"
        desc={`已解析 ${docs.length} 份文档 · ${totalChunks} 个片段（检索按二元切分 + BM25）`}
        icon={<UploadCloud size={14} />}
        right={
          <Button variant="outline" size="xs" onClick={() => setPasteOpen(true)}>
            <ClipboardType size={11} />
            粘贴文本
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-2.5 px-4 sm:grid-cols-3">
        {SLOTS.map((s) => {
          const Icon = s.icon;
          const active = drag === s.key;
          return (
            <div
              key={s.key}
              onClick={() => inputs.current[s.key]?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(s.key);
              }}
              onDragLeave={() => setDrag(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(null);
                void handleFiles(e.dataTransfer.files, s.key);
              }}
              className={cn(
                'group cursor-pointer rounded-card border border-dashed px-3 py-3 transition-colors',
                active
                  ? 'border-brand/60 bg-brand/[.08]'
                  : 'border-ink-line bg-[#0e131a]/50 hover:border-ink-line2 hover:bg-white/[.025]'
              )}
            >
              <input
                ref={(el) => {
                  inputs.current[s.key] = el;
                }}
                type="file"
                multiple={s.key !== 'jd'}
                accept={s.accept}
                className="hidden"
                onChange={(e) => {
                  void handleFiles(e.target.files, s.key);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-txt-dim group-hover:text-txt">
                <Icon size={13} className="text-brand" />
                {s.title}
              </div>
              <div className="mt-1 text-[10.5px] leading-relaxed text-txt-mute">{s.hint}</div>
            </div>
          );
        })}
      </div>

      <div className="mx-4 mt-2 rounded-[7px] border border-ink-line/60 bg-[#0e131a]/40 px-2.5 py-2 text-[10.5px] leading-relaxed text-txt-mute">
        简历和 JD 是必填；项目材料可选，用来回答「讲一个项目 / 故障 / 难点」这类经历题。建议一个项目一份复盘，写清背景、你的角色、具体动作、结果数字和取舍，不要上传整份代码或客户机密。
      </div>

      {busy ? (
        <div className="mx-4 mt-2.5 flex items-center gap-2 rounded-[7px] border border-brand/25 bg-brand/[.06] px-2.5 py-1.5 text-[11.5px] text-[#9cc0ff]">
          <Loader2 size={12} className="animate-spin" />
          {busy}
        </div>
      ) : null}

      <div className="mt-3 px-2 pb-2">
        <DocList
          docs={docs}
          busy={Boolean(busy)}
          onReindex={(d) => void reindex(d)}
          onDelete={setPendingDel}
        />
      </div>

      <PasteDialog open={pasteOpen} onClose={() => setPasteOpen(false)} onSave={savePaste} />

      <Dialog
        open={Boolean(pendingDel)}
        onClose={() => setPendingDel(null)}
        title="删除这份材料？"
        desc={pendingDel ? `《${pendingDel.name}》及其全部索引片段会被移除，已生成的技能卡不受影响。` : ''}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDel(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!pendingDel) return;
                await db.deleteDocCascade(pendingDel.id);
                setPendingDel(null);
                await onChanged();
                toast('已删除', 'ok');
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <div className="text-[12px] leading-relaxed text-txt-mute">
          删除后无法恢复。如果只是想让检索范围变小，可以保留文档但把对应技能卡设为草稿。
        </div>
      </Dialog>
    </Panel>
  );
}
