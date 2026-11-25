'use client';

import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

export function EndSessionDialog({
  open,
  onClose,
  count,
  ending,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
  ending: boolean;
  onFinish: (withReview: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="结束本轮"
      desc="结束后就不能再往这一轮里加问答了。建议直接生成复盘，趁记忆还热。"
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onFinish(false)} disabled={ending}>
            只结束
          </Button>
          <Button variant="primary" onClick={() => onFinish(true)} loading={ending}>
            结束并生成复盘
            <ArrowRight size={12} />
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-2 rounded-[7px] border border-warn/25 bg-warn/[.05] px-2.5 py-2">
        <TriangleAlert size={12} className="mt-[3px] shrink-0 text-warn" />
        <div className="text-[11px] leading-relaxed text-txt-dim">
          本轮共 {count} 条问答。复盘会逐条给分，指出「哪句话让面试官起了疑心」，并给 30 秒改写示范。
        </div>
      </div>
    </Dialog>
  );
}
