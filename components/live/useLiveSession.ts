'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { buildIndex, snippet } from '@/lib/retrieval';
import { SCREENSHOT_PROMPT, buildAnswerMessages } from '@/lib/prompts';
import { chatStream, defaultFastModel, isDemoMode } from '@/lib/llm';
import { demoAnswer } from '@/lib/demo';
import { analyzeQuestion } from '@/lib/playbook';
import { planAnswer, readableText, spokenText } from '@/lib/answer';
import { matchQA } from '@/lib/qaMatch';
import { speak } from '@/lib/asr';
import type {
  AnswerBasis,
  AnswerMode,
  AnswerStyle,
  Citation,
  CompanyResearch,
  QuestionKind,
  Session,
  SessionMode,
  Snapshot,
  Turn,
  TurnSource,
} from '@/lib/types';

export interface PendingAnswer {
  id: string;
  question: string;
  source: TurnSource;
  text: string;
  citations: Citation[];
  degraded: boolean;
  demo: boolean;
  latencyMs: number;
  error?: string;
  qtype: QuestionKind;
  tip: string;
  basis: AnswerBasis;
  qaId?: string;
  qaVariant?: string;
  qaScore?: number;
  used: { cards: number; resume: boolean; jd: boolean; chunks: number; qa?: boolean };
}

type RunOpts = {
  style?: AnswerStyle;
  replaceId?: string;
  imageUrl?: string;
  forceLLM?: boolean;
};

type QueuedAsk = { question: string; source: TurnSource; opts?: RunOpts };

/** 只用于去重：ASR 的 final 和手动输入可能把同一题重复送进来 */
const normQuestion = (s: string) => s.replace(/[\s，。！？、,.!?；;：:""''（）()【】\[\]]/g, '');

export function useLiveSession() {
  const activeId = useApp((s) => s.activeId);
  const profiles = useApp((s) => s.profiles);
  const cards = useApp((s) => s.cards);
  const qas = useApp((s) => s.qas);
  const chunks = useApp((s) => s.chunks);
  const docs = useApp((s) => s.docs);
  const settings = useApp((s) => s.settings);
  const refreshSessions = useApp((s) => s.refreshSessions);

  // 未命中标准问答时，优先用低延迟模型；没手填就按 Base 自动挑非推理模型
  const fastModel = useMemo(() => {
    if (!settings.fastAnswer) return '';
    const custom = settings.fastModel.trim();
    if (custom) return custom;
    return defaultFastModel(settings.apiBase);
  }, [settings.fastAnswer, settings.fastModel, settings.apiBase]);

  const [session, setSession] = useState<Session | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<PendingAnswer | null>(null);
  const [mode, setMode] = useState<SessionMode>('assist');
  const [style, setStyle] = useState<AnswerStyle>(settings.style);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('auto');
  const busy = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  /** 每次生成递增；旧请求被中止后，它的 catch/finally 不能再动新一轮的 pending / busy */
  const runSeq = useRef(0);
  /** 正在回答的题；用来挡住同一题的重复触发，以及让界面锁定当前题不被下一题顶掉 */
  const activeQuestionRef = useRef('');
  /** 上一个答案没结束时，新题先排队，等答案显示完整再依次回答 */
  const queueRef = useRef<QueuedAsk[]>([]);
  const runRef = useRef<((q: string, s: TurnSource, o?: RunOpts) => Promise<Turn | undefined>) | null>(null);

  const snapChunks = useMemo(() => {
    if (!snap) return chunks;
    if (snap.chunks) return snap.chunks;
    return chunks.filter((c) => snap.docIds.includes(c.docId));
  }, [chunks, snap]);
  const snapDocs = useMemo(() => {
    if (!snap) return docs;
    if (snap.docs) return snap.docs;
    return docs.filter((d) => snap.docIds.includes(d.id));
  }, [docs, snap]);
  const index = useMemo(() => buildIndex(snapChunks), [snapChunks]);
  const snapCards = useMemo(() => {
    if (!snap) return cards.filter((c) => c.status === 'confirmed');
    if (snap.cards) return snap.cards;
    return cards.filter((c) => snap.cardIds.includes(c.id));
  }, [cards, snap]);
  const snapQas = useMemo(() => {
    if (!snap) return qas;
    if (snap.qas) return snap.qas;
    if (!snap.qaIds) return []; // 1.4.0 之前的快照没有标准问答
    return qas.filter((q) => snap.qaIds!.includes(q.id));
  }, [qas, snap]);
  const profile = useMemo(
    () => profiles.find((p) => p.id === activeId),
    [profiles, activeId]
  );
  /** 本轮优先用快照里的档案；没有快照（旧数据）才退回当前档案 */
  const activeProfile = useMemo(() => snap?.profile ?? profile, [snap, profile]);

  /* ---------- 开始 / 恢复 / 结束 ---------- */
  const start = useCallback(
    async (m: SessionMode) => {
      if (!activeId) return null;
      const confirmed = cards.filter((c) => c.status === 'confirmed');
      const current = profiles.find((p) => p.id === activeId);
      const savedResearch = await db
        .kvGet<CompanyResearch>(`research:${activeId}`)
        .catch(() => undefined);
      const research =
        savedResearch &&
        (!current?.company?.trim() || savedResearch.company === current.company.trim())
          ? savedResearch
          : undefined;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const label = `${now.getMonth() + 1}月${now.getDate()}日 ${hh}:${mm} · ${qas.length} 题 · ${
        docs.length
      } 份文档${research ? ' · 已注入公司调研' : ''}`;
      const docIds = docs.map((d) => d.id);
      const snapshot: Snapshot = {
        id: db.uid('sn'),
        profileId: activeId,
        cardIds: confirmed.map((c) => c.id),
        cards: confirmed,
        docIds,
        docs,
        chunks: chunks
          .filter((c) => docIds.includes(c.docId))
          .map((c) => ({ ...c, tokens: [] })),
        qaIds: qas.map((q) => q.id),
        qas,
        research,
        // 和 AskCc 一样：开始面试时冻结档案与自定义指令，中途改档案不影响本轮
        profile: current
          ? {
              name: current.name,
              targetRole: current.targetRole,
              company: current.company,
              round: current.round,
              lang: current.lang,
              instructions: current.instructions ?? '',
            }
          : undefined,
        label,
        createdAt: Date.now(),
      };
      await db.putSnapshot(snapshot);

      const profile = current;
      const s: Session = {
        id: db.uid('se'),
        profileId: activeId,
        snapshotId: snapshot.id,
        mode: m,
        title: `${profile?.company || '未填公司'} · ${profile?.round || '一面'} · ${
          m === 'practice' ? '练习' : '实战'
        }`,
        startedAt: Date.now(),
        snapshotLabel: label,
      };
      await db.putSession(s);
      setSnap(snapshot);
      setSession(s);
      setTurns([]);
      setPending(null);
      await refreshSessions();
      return s;
    },
    [activeId, cards, qas, docs, chunks, profiles, refreshSessions]
  );

  const resume = useCallback(async (s: Session) => {
    const snapshot = await db.getSnapshot(s.snapshotId);
    const list = await db.listTurns(s.id);
    setSession(s);
    setSnap(snapshot ?? null);
    setTurns(list.slice().reverse());
  }, []);

  const end = useCallback(async () => {    if (!session) return null;
    abortRef.current?.abort();
    const next = { ...session, endedAt: Date.now() };
    await db.putSession(next);
    setSession(next);
    await refreshSessions();
    return next;
  }, [session, refreshSessions]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSession(null);
    setSnap(null);
    setTurns([]);
    setPending(null);
  }, []);

  /* ---------- 生成答稿 ---------- */
  /** 当前答案结束后，从队列里取下一题；保证一题显示完整再答下一题 */
  const drainQueue = useCallback(() => {
    if (busy.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    void runRef.current?.(next.question, next.source, next.opts);
  }, []);

  const run = useCallback(
    async (
      question: string,
      source: TurnSource,
      opts?: RunOpts
    ) => {
      const q = question.trim();
      if (!q) return;

      // 同一题重复触发（ASR final + 自动/手动）不重复排队
      const key = normQuestion(q);
      if (key && key === normQuestion(activeQuestionRef.current)) return;
      if (key && queueRef.current.some((item) => normQuestion(item.question) === key)) return;

      // 上一题还在生成：先排队，等它完整显示完再答，绝不用新题覆盖旧答案
      if (busy.current) {
        queueRef.current.push({ question: q, source, opts });
        return;
      }

      const t0 = Date.now();

      const useStyle = opts?.style ?? style;
      // 「详细」明确要长答案，就别用极速模型硬压长度
      const useFast = Boolean(fastModel) && useStyle !== 'detailed';
      // 给输出封顶：中文 1 字约 1 token，留一点余量即可；不封顶时模型会越写越长
      const maxTokens = useStyle === 'concise' ? 220 : useStyle === 'detailed' ? 520 : 360;
      const docName = (id: string) => snapDocs.find((d) => d.id === id)?.name ?? '知识库';
      const analysis = analyzeQuestion(q);

      // 标准问答优先：命中后原样显示你准备好的答案，完全不走模型。
      // 只有当前没有答案在生成时才会走到这里；上一题没结束的题已经在上面排队。
      const qaHit = opts?.imageUrl || opts?.forceLLM ? null : matchQA(q, snapQas);
      if (qaHit && qaHit.entry.answer.trim()) {
        busy.current = true;
        activeQuestionRef.current = q;
        const id = db.uid('tn');
        const answer = qaHit.entry.answer.trim();
        const latencyMs = Math.max(0, Date.now() - t0);
        const qaCitations: Citation[] = [
          {
            type: 'qa',
            id: qaHit.entry.id,
            label: qaHit.entry.question,
            text: answer,
            score: Math.round(qaHit.score * 100) / 100,
          },
        ];
        const turn: Turn = {
          id,
          sessionId: session?.id ?? '',
          question: q,
          source,
          answerMd: answer,
          citations: qaCitations,
          latencyMs,
          createdAt: Date.now(),
          style: useStyle,
          degraded: false,
          demo: false,
          qtype: analysis.kind,
          basis: 'qa',
          qaId: qaHit.entry.id,
          qaVariant: qaHit.variant,
          qaScore: qaHit.score,
        };
        await db.putTurn(turn);
        setTurns((ts) => [turn, ...ts.filter((t) => t.id !== turn.id && t.id !== opts?.replaceId)]);
        // 题库答案也要停留 1.2 秒再答下一题，避免刚显示就被下一题顶掉
        setTimeout(() => {
          busy.current = false;
          activeQuestionRef.current = '';
          drainQueue();
        }, 1200);
        return turn;
      }

      // 未命中题库：进入模型生成；新题会排队，不抢占当前答案
      const seq = ++runSeq.current;
      busy.current = true;
      activeQuestionRef.current = q;

      const citations: Citation[] = [];
      let messages: { role: 'system' | 'user'; content: unknown }[];
      let demoText = '';
      let degraded = false;
      let basis: AnswerBasis = 'general';
      let qtype: QuestionKind = analysis.kind;
      let tip = analysis.tip;
      let used = { cards: 0, resume: false, jd: false, chunks: 0 };

      if (opts?.imageUrl) {
        citations.push({
          type: 'chunk',
          id: 'image',
          label: '屏幕截图',
          text: '截图解题：题目理解 / 解题思路 / 参考解答 / 坑与追问',
          score: 1,
        });
        messages = [
          { role: 'system', content: SCREENSHOT_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请按四段式解答这张截图里的题目。' },
              { type: 'image_url', image_url: { url: opts.imageUrl } },
            ],
          },
        ];
        demoText = [
          '**演示模式读不了图片**，这里只能给你解题的通用动作。',
          '',
          '先判断题型，算法、系统设计、案例的考点完全不同。算法题先说复杂度再写代码，边界条件单独列；不确定的题面要主动说这块没看清，别硬猜。',
        ].join('\n');
        qtype = 'general';
        tip = '截图解题：先说题眼，再给步骤';
        used = { cards: 0, resume: false, jd: false, chunks: 1 };
      } else {
        const plan = planAnswer({
          question: q,
          analysis,
          mode: answerMode,
          fast: useFast,
          cards: snapCards,
          chunks: snapChunks,
          index,
          docs: snapDocs,
          docName,
        });

        for (const c of plan.cards)
          citations.push({
            type: 'card',
            id: c.id,
            label: c.project,
            text: [c.background, c.actions[0]].filter(Boolean).join(' · '),
            score: 1,
          });
        for (const h of plan.hits)
          citations.push({
            type: 'chunk',
            id: h.id,
            label: h.label,
            text: snippet(h.text, [], 200),
            score: h.score,
          });

        messages = buildAnswerMessages({
          question: q,
          style: useStyle,
          analysis,
          mode: answerMode,
          profile: activeProfile,
          instructions: activeProfile?.instructions ?? '',
          cards: plan.cards,
          resumeBrief: plan.resumeBrief,
          jdBrief: plan.jdBrief,
          research: snap?.research,
          hits: plan.hits.map((h) => ({ label: h.label, text: h.text })),
          history: turns
            .slice(0, 3)
            .reverse()
            .map((t) => ({ q: t.question, a: spokenText(t.answerMd) })),
          fast: useFast,
        });
        demoText = demoAnswer(
          q,
          plan.cards,
          plan.hits.map((h) => ({ label: h.label, text: h.text })),
          useStyle,
          analysis
        );
        degraded = plan.degraded;
        basis = plan.basis;
        used = {
          cards: plan.cards.length,
          resume: Boolean(plan.resumeBrief),
          jd: Boolean(plan.jdBrief),
          chunks: plan.hits.length,
        };
      }

      const id = opts?.replaceId ?? db.uid('t');
      const startedAt = performance.now();
      setPending({
        id,
        question: q,
        source,
        text: '',
        citations,
        degraded,
        demo: isDemoMode(settings),
        latencyMs: 0,
        qtype,
        tip,
        basis,
        used,
      });

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let acc = '';
      let first = 0;
      let lastFlush = 0;
      let timeoutKind: 'first' | 'total' | null = null;
      let finishedOk = false;
      const firstTimer = setTimeout(() => {
        if (!first) {
          timeoutKind = 'first';
          ctrl.abort();
        }
      }, 8000);
      const totalTimer = setTimeout(() => {
        if (!timeoutKind) timeoutKind = 'total';
        ctrl.abort();
      }, 30000);

      try {
        for await (const d of chatStream({
          settings,
          model: useFast ? fastModel : undefined,
          temperature: useFast ? Math.min(settings.temperature, 0.35) : settings.temperature,
          signal: ctrl.signal,
          messages: messages as any,
          maxTokens,
          noThink: settings.noThink,
          demo: () => demoText,
        })) {
          if (!first) {
            first = Math.round(performance.now() - startedAt);
            clearTimeout(firstTimer);
          }
          acc += d;
          const now = performance.now();
          if (now - lastFlush > 70) {
            lastFlush = now;
            setPending((p) => (p && seq === runSeq.current ? { ...p, text: acc, latencyMs: first } : p));
          }
        }

        const finalText = spokenText(acc);
        if (finalText !== acc && seq === runSeq.current) {
          setPending((p) => (p ? { ...p, text: finalText } : p));
        }

        const turn: Turn = {
          id,
          sessionId: session?.id ?? '',
          question: q,
          source,
          answerMd: finalText,
          citations,
          latencyMs: first,
          createdAt: Date.now(),
          style: useStyle,
          degraded,
          demo: isDemoMode(settings),
          qtype,
          basis,
        };
        if (session) {
          await db.putTurn(turn);
          setTurns((list) => [turn, ...list.filter((t) => t.id !== turn.id)]);
          if (mode === 'practice' && settings.tts) speak(readableText(finalText), settings.lang);
        }
        if (seq === runSeq.current) {
          setPending(null);
          finishedOk = true;
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          if (seq === runSeq.current) {
            if (timeoutKind) {
              setPending((p) =>
                p
                  ? {
                      ...p,
                      error:
                        timeoutKind === 'first'
                          ? '模型 8 秒没出字，已中止。请点「重答」或手动输入这一题。'
                          : '模型 30 秒没完成，已中止。请点「重答」。',
                    }
                  : p
              );
            } else {
              setPending(null);
            }
          }
        } else if (seq === runSeq.current) {
          setPending((p) =>
            p
              ? { ...p, error: String(e?.message ?? e).slice(0, 180), text: spokenText(acc) || p.text }
              : p
          );
        }
      } finally {
        clearTimeout(firstTimer);
        clearTimeout(totalTimer);
        if (seq === runSeq.current) {
          // 先让这一题的答案完整显示 1.2 秒，再释放 busy 去答队列里的下一题
          setTimeout(() => {
            busy.current = false;
            activeQuestionRef.current = '';
            drainQueue();
          }, finishedOk ? 1200 : 1500);
        }
      }
    },
    [activeProfile, answerMode, drainQueue, fastModel, index, mode, session, settings, snap, snapCards, snapChunks, snapDocs, snapQas, style, turns]
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const ask = useCallback(
    (q: string, source: TurnSource = 'manual') => run(q, source),
    [run]
  );

  const askImage = useCallback(
    (dataUrl: string) =>
      run(`截图解题 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`, 'image', {
        imageUrl: dataUrl,
      }),
    [run]
  );

  const regenerate = useCallback(
    (turn: Turn, nextStyle: AnswerStyle) =>
      run(turn.question, turn.source, {
        style: nextStyle,
        replaceId: turn.id,
        forceLLM: Boolean(turn.qaId),
      }),
    [run]
  );

  useEffect(() => {
    setStyle(settings.style);
  }, [settings.style]);

  return {
    session,
    snap,
    turns,
    pending,
    mode,
    setMode,
    style,
    setStyle,
    answerMode,
    setAnswerMode,
    start,
    resume,
    end,
    reset,
    ask,
    askImage,
    regenerate,
    snapCards,
    snapChunks,
    snapQas,
    fastModel,
  };
}
