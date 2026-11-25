'use client';

import Link from 'next/link';
import { Activity, ArrowRight, Database, FileText, Layers, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

export function EmptyLanding({
  onSeed,
  seeding,
}: {
  onSeed: () => void;
  seeding: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-[1000px] flex-col justify-center px-5 py-8">
      <div className="relative overflow-hidden rounded-panel border border-ink-line bg-ink-panel/80 p-8">
        <div className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-brand/16 blur-[70px]" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-brand-violet/16 blur-[70px]" />
        <div className="pointer-events-none absolute right-8 top-1/2 hidden w-[248px] -translate-y-1/2 xl:block">
          <div className="rounded-card border border-ink-line/70 bg-[#0d1219]/85 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] uppercase tracking-[.14em] text-txt-mute">本轮快照</span>
              <span className="rounded-full border border-ok/25 bg-ok/10 px-1.5 py-px text-[9px] text-ok">
                3 张卡
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {['请你先做一个自我介绍', '为什么选择我们公司', '你最大的缺点是什么'].map((p) => (
                <div key={p} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-ok/80" />
                  <span className="truncate text-[10.5px] text-txt-dim">{p}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-ink-line/60 pt-1.5 text-[9px] text-txt-mute">
              命中后原样显示，不走模型
            </div>
          </div>
          <div className="mt-1.5 text-center text-[9px] text-txt-mute/60">
            示例 · 载入后可看到这套结构
          </div>
        </div>

        <div className="relative max-w-[560px]">
          <Badge tone="brand" dot>
            v1 · 本地优先
          </Badge>
          <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight text-txt">
            把面试准备，做成一条<span className="grad-text">能复利的流水线</span>
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-txt-dim">
            不是搜题工具，也不是模拟题库。把面试官常问的题、同义问法和完整答案提前写进标准问答，命中后直接原样显示；没命中再由模型结合你的简历和 JD 现场生成。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="md" loading={seeding} onClick={onSeed}>
              <Sparkles size={14} />
              载入示例档案
            </Button>
            <Link href="/profile">
              <Button variant="outline" size="md">
                从零开始
                <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-txt-mute">
            <Database size={11} />
            所有数据存在浏览器 IndexedDB，不经过任何服务器
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: <FileText size={14} />, t: '档案', d: '简历 / JD / 项目材料，自动切块建索引' },
          { icon: <Layers size={14} />, t: '技能卡', d: '追问式挖掘，把「我们」问成「我」' },
          { icon: <Activity size={14} />, t: '实战', d: '听题、检索、2 秒出答稿，来源可追溯' },
        ].map((x) => (
          <Panel key={x.t} className="p-4">
            <div className="grid h-7 w-7 place-items-center rounded-[7px] border border-ink-line bg-ink-sub text-brand">
              {x.icon}
            </div>
            <div className="mt-2.5 text-[13px] font-medium text-txt">{x.t}</div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-txt-mute">{x.d}</div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
