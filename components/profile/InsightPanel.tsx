'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Crosshair, HelpCircle, Sparkles, Target, TrendingUp } from 'lucide-react';
import * as db from '@/lib/db';
import { chatStream, collect, extractJson } from '@/lib/llm';
import { buildInsightMessages } from '@/lib/prompts';
import { demoInsight, type Insight } from '@/lib/demo';
import { useApp } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHead } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import type { Doc, Profile } from '@/lib/types';

const WEIGHT_TONE = { 高: 'brand', 中: 'violet', 低: 'muted' } as const;

/** kv 里存的不再是裸 Insight，而是带 local 标记的信封；旧数据仍能读。 */
interface InsightRecord {
  data: Insight;
  local: boolean;
  at: number;
}

function readInsightRecord(raw: unknown): { data: Insight; local: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;
  if (obj.data && typeof obj.data === 'object' && obj.data.核心考察) {
    return { data: obj.data as Insight, local: Boolean(obj.local) };
  }
  // 兼容旧版本直接存的 Insight
  if (obj.核心考察) return { data: raw as Insight, local: false };
  return null;
}

export function InsightPanel({
  profile,
  docs,
}: {
  profile: Profile;
  docs: Doc[];
}) {
  const settings = useApp((s) => s.settings);
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [local, setLocal] = useState(false);
  const profileIdRef = useRef(profile.id);

  const resume = docs.filter((d) => d.type === 'resume').map((d) => d.raw ?? '').join('\n\n');
  const jd = docs.filter((d) => d.type === 'jd').map((d) => d.raw ?? '').join('\n\n');
  const ready = resume.length > 20 || jd.length > 20;

  useEffect(() => {
    const pid = profile.id;
    profileIdRef.current = pid;
    // 切档立刻清空，绝不让上一份档案的洞察留在界面上。
    setData(null);
    setLocal(false);
    setLoading(false);
    let alive = true;
    void db
      .kvGet<unknown>(`insight:${pid}`)
      .then((raw) => {
        if (!alive || profileIdRef.current !== pid) return;
        const rec = readInsightRecord(raw);
        if (rec) {
          setData(rec.data);
          setLocal(rec.local);
        }
      })
      .catch(() => {
        /* kv 读取失败按无缓存处理 */
      });
    return () => {
      alive = false;
    };
  }, [profile.id]);

  async function persist(pid: string, value: Insight, isLocal: boolean) {
    const record: InsightRecord = { data: value, local: isLocal, at: Date.now() };
    await db.kvSet(`insight:${pid}`, record);
    if (profileIdRef.current !== pid) return;
    setData(value);
    setLocal(isLocal);
  }

  async function generate() {
    if (!ready) {
      toast('先上传简历或粘贴 JD', 'warn', '没有材料时只能给空泛结论，不如不给');
      return;
    }
    const pid = profile.id;
    setLoading(true);
    try {
      const text = await collect(
        chatStream({
          settings,
          temperature: 0.3,
          messages: buildInsightMessages(resume, jd),
          demo: () =>
            JSON.stringify(demoInsight(resume, jd, profile.targetRole, profile.company)),
        })
      );
      const parsed = extractJson<Insight>(text);
      const isLocal = !settings.apiKey.trim();
      if (parsed && parsed.核心考察) {
        await persist(pid, parsed, isLocal);
        if (profileIdRef.current === pid) {
          toast(isLocal ? '已用本地启发式生成洞察' : '洞察已生成', 'ok');
        }
      } else {
        const fb = demoInsight(resume, jd, profile.targetRole, profile.company);
        await persist(pid, fb, true);
        if (profileIdRef.current === pid) {
          toast('模型返回无法解析，已回退到本地启发式', 'warn');
        }
      }
    } catch (e: any) {
      if (profileIdRef.current === pid) {
        toast('生成失败', 'err', String(e?.message ?? e).slice(0, 160));
      }
    } finally {
      if (profileIdRef.current === pid) setLoading(false);
    }
  }

  return (
    <Panel>
      <PanelHead
        title="岗位对齐洞察"
        desc="每一条结论都要能追溯到简历或 JD 里的具体句子"
        icon={<Crosshair size={14} />}
        right={
          <>
            {local ? <Badge tone="warn">本地启发式</Badge> : null}
            <Button variant="outline" size="xs" onClick={() => void generate()} loading={loading}>
              <Sparkles size={11} />
              {data ? '重新生成' : '生成洞察'}
            </Button>
          </>
        }
      />

      <div className="px-4 pb-4">
        {!ready ? (
          <EmptyState
            compact
            icon={<Target size={16} />}
            title="还缺简历或 JD"
            desc="左侧上传一份简历、粘贴一段 JD，这里的结论才有依据。"
          />
        ) : loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-[52px] w-full" />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Skeleton className="h-[120px]" />
              <Skeleton className="h-[120px]" />
            </div>
          </div>
        ) : !data ? (
          <div className="rounded-card border border-dashed border-ink-line bg-[#0e131a]/40 px-4 py-8 text-center">
            <div className="text-[12.5px] text-txt-dim">材料已就绪，可以生成这场面试的考察图谱</div>
            <div className="mt-1 text-[11px] text-txt-mute">
              输出：核心考察 / 匹配优势 / 风险点 / 必问 5 题
            </div>
            <Button variant="primary" size="sm" className="mt-3" onClick={() => void generate()}>
              <Sparkles size={12} />
              生成岗位洞察
            </Button>
          </div>
        ) : (
          <div className="animate-fadeUp space-y-3">
            <div className="relative overflow-hidden rounded-card border border-brand/25 bg-[linear-gradient(110deg,rgba(77,141,255,.1),rgba(123,92,255,.06))] px-3.5 py-3">
              <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-brand/20 blur-2xl" />
              <div className="relative flex gap-2.5">
                <Sparkles size={14} className="mt-[3px] shrink-0 text-[#9cc0ff]" />
                <div>
                  <div className="text-[10.5px] font-semibold tracking-wide text-[#8db6ff]">一句话判断</div>
                  <div className="mt-1 text-[13px] leading-relaxed text-txt">{data.一句话判断}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="panel-sub p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt-dim">
                  <Target size={12} className="text-brand" />
                  核心考察
                </div>
                <div className="space-y-2">
                  {data.核心考察?.map((x, i) => (
                    <div key={i} className="rounded-[7px] border border-ink-line/70 bg-[#0e131a]/60 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-txt">{x.点}</span>
                        <Badge tone={WEIGHT_TONE[x.权重 as '高'] ?? 'muted'} className="shrink-0">
                          {x.权重}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[10.5px] leading-relaxed text-txt-mute">依据：{x.依据}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="panel-sub p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt-dim">
                    <TrendingUp size={12} className="text-ok" />
                    你的匹配优势
                  </div>
                  <div className="space-y-1.5">
                    {data.你的匹配优势?.map((x, i) => (
                      <div key={i} className="flex gap-2 text-[11.5px] leading-relaxed">
                        <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-ok/70" />
                        <span className="text-txt-dim">
                          <span className="text-txt">{x.优势}</span>
                          <span className="text-txt-mute"> · {x.对应JD要求}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-card border border-danger/20 bg-danger/[.04] p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#ff9aa2]">
                    <AlertCircle size={12} />
                    你的风险点
                  </div>
                  <div className="space-y-2">
                    {data.你的风险点?.map((x, i) => (
                      <div key={i} className="text-[11.5px] leading-relaxed">
                        <div className="text-txt-dim">{x.风险}</div>
                        <div className="mt-0.5 text-[10.5px] text-txt-mute">→ {x.面试官会怎么问}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel-sub p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-txt-dim">
                <HelpCircle size={12} className="text-brand-violet" />
                大概率被追问的 5 个问题
              </div>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {data.必问5题?.map((x, i) => (
                  <div
                    key={i}
                    className="flex gap-2 rounded-[7px] border border-ink-line/60 bg-[#0e131a]/50 px-2.5 py-2"
                  >
                    <span className="mt-[1px] font-mono text-[10.5px] text-brand/80">0{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-[11.5px] leading-snug text-txt">{x.问题}</div>
                      <div className="mt-0.5 text-[10.5px] text-txt-mute">考察：{x.考察点}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
