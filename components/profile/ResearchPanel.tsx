'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ExternalLink,
  Globe2,
  Lightbulb,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHead, SectionLabel } from '@/components/ui/Panel';
import { generateResearch, loadResearch, type ResearchProgress } from '@/lib/research';
import type { CompanyResearch, Doc, Profile } from '@/lib/types';

function Bullets({ items, empty = '资料不足' }: { items: string[]; empty?: string }) {
  if (!items.length) return <div className="text-[11px] text-txt-mute">{empty}</div>;
  return (
    <ul className="space-y-1">
      {items.slice(0, 6).map((x, i) => (
        <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-txt-dim">
          <span className="mt-[5px] h-[3px] w-[3px] shrink-0 rounded-full bg-brand/70" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-ink-line/60 bg-[#0e131a]/45 px-3 py-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-txt-mute">
        {title}
      </div>
      {children}
    </div>
  );
}

export function ResearchPanel({ profile, docs }: { profile: Profile; docs: Doc[] }) {
  const settings = useApp((s) => s.settings);
  const [data, setData] = useState<CompanyResearch | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<ResearchProgress | null>(null);
  const [error, setError] = useState('');

  const jd = useMemo(
    () => (docs.find((d) => d.type === 'jd')?.raw ?? '').trim().slice(0, 8000),
    [docs]
  );
  const stale = Boolean(
    data && (data.company !== profile.company.trim() || data.role !== profile.targetRole.trim())
  );

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    loadResearch(profile.id)
      .then((r) => {
        if (live) setData(r ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [profile.id]);

  const run = async () => {
    if (!profile.company.trim()) {
      toast('先填写目标公司', 'warn', '档案信息里填公司名，调研才知道要查谁');
      return;
    }
    setLoading(true);
    setError('');
    setStage({ stage: 'searching', detail: '正在检索公开面经和公司背景…' });
    try {
      const r = await generateResearch(
        {
          profileId: profile.id,
          company: profile.company,
          role: profile.targetRole,
          jd,
          settings,
        },
        setStage
      );
      setData(r);
      toast('公司/岗位调研已完成', 'ok', `抓到 ${r.sources.length} 条公开线索`);
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 240);
      setError(msg);
      toast('调研失败', 'err', msg);
    } finally {
      setLoading(false);
      setStage(null);
    }
  };

  const s = data?.summary;
  const canRun = Boolean(profile.company.trim()) && !loading;

  return (
    <Panel>
      <PanelHead
        title={
          <>
            公司 / 岗位调研
            {data ? (
              <Badge tone={data.demo ? 'warn' : 'ok'} dot>
                {data.demo ? '原始线索' : '已归纳'}
              </Badge>
            ) : null}
          </>
        }
        desc="联网查公司背景、往年面经和高频问题；开始本轮后会自动注入答题上下文。"
        icon={<Globe2 size={14} />}
        right={
          <Button variant={data ? 'outline' : 'primary'} size="sm" loading={loading} onClick={run} disabled={!canRun}>
            {data ? <RefreshCw size={12} /> : <Search size={12} />}
            {data ? '重新调研' : '开始调研'}
          </Button>
        }
      />

      <div className="px-4 pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[10.5px] text-txt-mute">
          <span className="rounded-full border border-ink-line bg-ink-sub px-2 py-[1px] text-txt-dim">
            {profile.company.trim() || '未填公司'}
          </span>
          <span>·</span>
          <span>{profile.targetRole.trim() || '未填岗位'}</span>
          {jd ? <span className="text-ok">· 已读取 JD</span> : <span className="text-warn">· 未上传 JD</span>}
          {data ? <span>· {data.sources.length} 条来源</span> : null}
        </div>

        {stale ? (
          <div className="mb-3 rounded-[7px] border border-warn/30 bg-warn/[.06] px-2.5 py-2 text-[10.5px] leading-relaxed text-warn">
            这份调研是按「{data?.company} · {data?.role}」生成的，和当前档案不一致；建议重新调研。
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[8px] border border-brand/25 bg-brand/[.05] px-3 py-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[#9cc0ff]">
              <Sparkles size={13} className="animate-pulse" />
              {stage?.detail || '正在检索…'}
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="h-2 w-4/5 animate-pulse rounded bg-white/[.06]" />
              <div className="h-2 w-3/5 animate-pulse rounded bg-white/[.05]" />
              <div className="h-2 w-2/3 animate-pulse rounded bg-white/[.04]" />
            </div>
            <div className="mt-2 text-[10px] text-txt-mute">
              先抓公开搜索结果，再让模型归纳；通常 10~30 秒。
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-[7px] border border-danger/30 bg-danger/[.06] px-2.5 py-2 text-[10.5px] leading-relaxed text-danger">
            {error}
          </div>
        ) : null}

        {!loading && !data && !error ? (
          <div className="rounded-[8px] border border-dashed border-ink-line/70 bg-[#0e131a]/35 px-4 py-5 text-center">
            <Globe2 size={18} className="mx-auto text-txt-mute/70" />
            <div className="mt-2 text-[12px] font-medium text-txt-dim">面试前先把这家公司查透</div>
            <div className="mx-auto mt-1 max-w-[520px] text-[10.5px] leading-relaxed text-txt-mute">
              会按「公司 + 岗位 + JD」检索公开面经，归纳公司业务、面试流程、高频问题和回答方向；
              面试中模型会带着这些信息作答，不再泛泛而谈。
            </div>
          </div>
        ) : null}

        {!loading && data && s ? (
          <div className="space-y-3">
            <div className="rounded-[8px] border border-brand/20 bg-brand/[.04] px-3 py-2.5">
              <div className="flex items-start gap-2">
                <Target size={13} className="mt-[2px] shrink-0 text-brand" />
                <div className="text-[11.5px] leading-relaxed text-txt-dim">
                  {s.positioning || '资料不足，未能形成一句话定位。'}
                </div>
              </div>
              <div className="mt-1.5 text-[9.5px] text-txt-mute">
                更新于 {new Date(data.updatedAt).toLocaleString('zh-CN', { hour12: false })}
                {data.model && !data.demo ? ` · ${data.model}` : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <Block title="业务 / 文化">
                <Bullets items={[...s.business, ...s.culture]} />
              </Block>
              <Block title="面试流程 / 风格">
                <Bullets items={[...s.interviewProcess, ...s.interviewStyle]} />
              </Block>
              <Block title="岗位能力">
                {s.competencies.length ? (
                  <div className="space-y-1.5">
                    {s.competencies.slice(0, 6).map((c, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                        <Badge tone={c.weight === '高' ? 'brand' : c.weight === '低' ? 'muted' : 'violet'}>
                          {c.weight}
                        </Badge>
                        <span className="text-txt-dim">
                          {c.name}
                          {c.evidence && c.evidence !== c.name && !c.evidence.startsWith(c.name) ? (
                            <span className="text-txt-mute"> · {c.evidence}</span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-txt-mute">资料不足</div>
                )}
              </Block>
              <Block title="风险点 / 可反问">
                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[10px] text-warn">
                      <ShieldAlert size={10} /> 风险点
                    </div>
                    <Bullets items={s.risks} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-1 text-[10px] text-ok">
                      <Lightbulb size={10} /> 反问建议
                    </div>
                    <Bullets items={s.askBack} />
                  </div>
                </div>
              </Block>
            </div>

            <div>
              <SectionLabel>高频问题 · 回答方向</SectionLabel>
              {s.questions.length ? (
                <div className="space-y-1.5">
                  {s.questions.slice(0, 10).map((q, i) => (
                    <div key={i} className="rounded-[7px] border border-ink-line/60 bg-[#0e131a]/50 px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        <Badge tone="muted" className="shrink-0">
                          {q.type || '综合'}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11.5px] font-medium leading-relaxed text-txt-dim">
                            {q.question}
                          </div>
                          {q.why ? (
                            <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                              为什么问：{q.why}
                            </div>
                          ) : null}
                          {q.angles.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {q.angles.slice(0, 4).map((a, j) => (
                                <span
                                  key={j}
                                  className="rounded-full border border-ink-line bg-ink-sub px-1.5 py-[1px] text-[9.5px] text-txt-mute"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-txt-mute">资料不足，未提取到高频问题。</div>
              )}
            </div>

            <div>
              <SectionLabel>来源</SectionLabel>
              <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
                {data.sources.slice(0, 10).map((src) => (
                  <a
                    key={src.id}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-1.5 rounded-[6px] border border-ink-line/50 bg-[#0e131a]/35 px-2 py-1.5 text-[10px] leading-relaxed text-txt-mute transition-colors hover:border-brand/30 hover:text-txt-dim"
                  >
                    <ExternalLink size={9} className="mt-[3px] shrink-0" />
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-txt-dim">{src.title}</span>
                      <span className="text-txt-mute"> · {src.site}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
