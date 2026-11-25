'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import type { Doc } from '@/lib/types';

type Slot = Doc['type'];

export function PasteDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: { name: string; type: Slot; text: string }) => Promise<boolean>;
}) {
  const [type, setType] = useState<Slot>('jd');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('jd');
      setName('');
      setText('');
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await onSave({ name: name.trim(), type, text: text.trim() });
      // 切不出片段时不关闭，保留用户输入让他补足内容后重试。
      if (saved) onClose();
    } catch (e: any) {
      toast('保存失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="粘贴文本"
      desc="适合直接从招聘网站复制的 JD，或没有文件的项目口述材料。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={saving}>
            保存并建索引
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_120px] gap-2.5">
          <div>
            <label className="label">标题（可不填）</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：字节 JD · 后端增长"
            />
          </div>
          <div>
            <label className="label">类型</label>
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value as Slot)}
            >
              <option value="jd">岗位 JD</option>
              <option value="resume">简历</option>
              <option value="project">项目材料</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">内容</label>
          <textarea
            className="field min-h-[180px] leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="把 JD 或材料原文粘贴到这里…"
          />
          <div className="mt-1 text-right font-mono text-[10.5px] text-txt-mute">{text.length} 字</div>
        </div>
      </div>
    </Dialog>
  );
}
