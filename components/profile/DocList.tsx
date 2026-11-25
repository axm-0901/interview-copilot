'use client';

import { ClipboardType, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { DOC_TYPE_LABEL, type Doc } from '@/lib/types';
import { fmtDate } from '@/lib/utils';

const TYPE_TONE = {
  resume: 'brand',
  jd: 'violet',
  project: 'ok',
  note: 'muted',
} as const;

export function DocList({
  docs,
  busy,
  onReindex,
  onDelete,
}: {
  docs: Doc[];
  busy: boolean;
  onReindex: (d: Doc) => void;
  onDelete: (d: Doc) => void;
}) {
  if (docs.length === 0) {
    return (
      <div className="px-2">
        <EmptyState
          compact
          icon={<FileText size={16} />}
          title="还没有任何材料"
          desc="先上传简历，再粘贴一段 JD。没有材料时，岗位洞察和答稿都只能给通用框架。"
        />
      </div>
    );
  }

  return (
    <div className="space-y-[3px]">
      {docs.map((d) => (
        <div
          key={d.id}
          className="group flex items-center gap-2.5 rounded-[7px] px-2 py-1.5 transition-colors hover:bg-white/[.03]"
        >
          <Badge tone={TYPE_TONE[d.type]} className="shrink-0">
            {DOC_TYPE_LABEL[d.type]}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-[12px] text-txt-dim">{d.name}</span>
          <span className="shrink-0 font-mono text-[10.5px] text-txt-mute">
            {d.chars.toLocaleString()} 字
          </span>
          <span className="hidden shrink-0 text-[10.5px] text-txt-mute/70 sm:block">
            {fmtDate(d.createdAt)}
          </span>
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconButton
              className="h-6 w-6"
              title="重新索引"
              onClick={() => onReindex(d)}
              disabled={busy}
            >
              <RefreshCw size={11} />
            </IconButton>
            <IconButton className="h-6 w-6 hover:text-danger" title="删除" onClick={() => onDelete(d)}>
              <Trash2 size={11} />
            </IconButton>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PasteHint() {
  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] text-txt-mute">
      <ClipboardType size={10} />
      也可以直接粘贴文本
    </span>
  );
}
