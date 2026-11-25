'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import * as db from '@/lib/db';
import { createWebSpeechASR, speechSupported, type ASRProvider } from '@/lib/asr';
import { generateReviews } from '@/lib/review';
import { selfEchoRatio, ECHO_THRESHOLD } from '@/lib/echo';
import { toast } from '@/lib/toast';
import { LiveConsole, type TranscriptLine } from '@/components/live/LiveConsole';
import { ContextRail } from '@/components/live/ContextRail';
import { usePreview } from '@/components/live/usePreview';
import { ScreenshotDialog } from '@/components/live/ScreenshotDialog';
import { StartPanel } from '@/components/live/StartPanel';
import { LiveHeader } from '@/components/live/LiveHeader';
import { AnswerFeed } from '@/components/live/AnswerFeed';
import { EndSessionDialog } from '@/components/live/EndSessionDialog';
import { FocusView } from '@/components/live/FocusView';
import { useLiveSession } from '@/components/live/useLiveSession';
import { usePractice } from '@/components/live/usePractice';
import { useSystemAudio } from '@/components/live/useSystemAudio';
import type { TurnSource } from '@/lib/types';

export default function LivePage() {
  const router = useRouter();
  const { activeId, profiles, settings, refreshSessions, refreshActive, saveSettings, setActive } = useApp();
  const active = profiles.find((p) => p.id === activeId);
  const live = useLiveSession();
  const practice = usePractice(live.session, settings);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [input, setInput] = useState('');
  const inputRef = useRef('');
  const [shotOpen, setShotOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [focus, setFocus] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState(false);

  const asrRef = useRef<ASRProvider | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRef = useRef<(q: string, s: TurnSource) => void>(() => {});
  const scheduleRef = useRef<(fuse?: number) => void>(() => {});
  const resumedRef = useRef(false);

  /* 防自激用的运行时状态：推按窗口 / 答稿冷却 / 念稿检测 */
  const pendingRef = useRef(false);
  const micModeRef = useRef(settings.micMode);
  const lastEndRef = useRef(0);
  const lastAnswerRef = useRef('');
  const pttHeldRef = useRef(false);
  const pttReleaseRef = useRef(0);
  const prevPending = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pttActive, setPttActive] = useState(false);
  const [hint, setHint] = useState('');

  pendingRef.current = Boolean(live.pending);
  micModeRef.current = settings.micMode;

  const flash = useCallback((msg: string) => {
    setHint(msg);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(''), 4500);
  }, []);

  const updateInput = useCallback((v: string) => {
    inputRef.current = v;
    setInput(v);
  }, []);

  const send = useCallback(
    async (raw: string, source: TurnSource) => {
      const text = raw.trim();
      if (!text || !live.session) return;
      if (live.pending) {
        flash('上一条还在生成，等它出完再接这句');
        return;
      }
      if (live.mode === 'practice') {
        updateInput('');
        setTranscript([]);
        setInterim('');
        await practice.submit(text, source);
        return;
      }
      updateInput('');
      setTranscript([]);
      setInterim('');
      void live.ask(text, source);
    },
    [live, practice, updateInput, flash]
  );
  sendRef.current = (q, s) => void send(q, s);

  /* ---------- 系统音频（电脑里放出来的声音）---------- */
  const queuedRef = useRef('');
  const acceptSystemText = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      setTranscript((prev) => [...prev, { id: db.uid('ln'), text: t, final: true }]);
      const next = (inputRef.current ? inputRef.current + ' ' : '') + t;
      updateInput(next);
      if (pendingRef.current) {
        queuedRef.current = next;
        return;
      }
      // 系统音频已经由 VAD 判定过停顿，定稿就发；80ms 只用于让 React 把输入刷进去
      scheduleRef.current(80);
    },
    [updateInput]
  );

  const sys = useSystemAudio(settings, acceptSystemText);

  // 一条答稿生成期间进来的问题，等它结束再接着答，不丢
  useEffect(() => {
    if (live.pending || !queuedRef.current) return;
    const q = queuedRef.current;
    queuedRef.current = '';
    updateInput(q);
    scheduleRef.current(80);
  }, [live.pending, updateInput]);

  const scheduleAnswer = useCallback(
    (fuse?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!settings.autoAnswer || live.mode === 'practice') return;
      timerRef.current = setTimeout(() => {
        const q = inputRef.current.trim();
        if (q) sendRef.current(q, 'asr');
      }, fuse ?? settings.silenceMs);
    },
    [settings.autoAnswer, settings.silenceMs, live.mode]
  );
  scheduleRef.current = scheduleAnswer;

  const toggleMic = useCallback(() => {
    if (!speechSupported()) {
      toast('当前浏览器不支持语音识别', 'err', '请用 Chrome / Edge，或直接用下方输入框');
      return;
    }
    if (listening) {
      asrRef.current?.stop();
      return;
    }
    if (!asrRef.current) {
      asrRef.current = createWebSpeechASR(active?.lang ?? '中文', {
        onPartial: setInterim,
        onFinal: (t) => {
          setInterim('');
          const now = Date.now();

          // 推按模式下，只在按住空格（或松开后 1.2s 内）采纳结果
          const inWindow =
            micModeRef.current !== 'ptt' ||
            pttHeldRef.current ||
            now - pttReleaseRef.current < 1200;
          if (!inWindow) return;

          // 念答稿检测：识别结果与上一份答稿高度重合，判定为自激
          if (selfEchoRatio(t, lastAnswerRef.current) >= ECHO_THRESHOLD) {
            flash('疑似你在念答稿，这句已忽略；如果是面试官在复述，请手动输入');
            return;
          }

          setTranscript((prev) => [...prev, { id: db.uid('ln'), text: t, final: true }]);
          const next = (inputRef.current ? inputRef.current + ' ' : '') + t;
          updateInput(next);

          // 答稿生成中 / 刚结束 3 秒内：只记录，不自动作答
          if (pendingRef.current || now - lastEndRef.current < 3000) {
            flash('答稿刚生成，这一句只记录，不自动作答');
            return;
          }
          scheduleRef.current();
        },
        onError: (m) => toast('语音识别出错', 'err', m),
        onState: setListening,
      });
    }
    asrRef.current?.start();
    toast(
      '已开始监听',
      'ok',
      settings.micMode === 'ptt'
        ? '按住空格说话，松开后自动作答'
        : settings.autoAnswer
        ? `静默 ${(settings.silenceMs / 1000).toFixed(1)}s 后自动作答`
        : '按 ⌘/Ctrl + Enter 作答'
    );
  }, [active?.lang, listening, settings.autoAnswer, settings.micMode, settings.silenceMs, updateInput, flash]);

  /* ---------- 答稿结束后进入冷却 ---------- */
  useEffect(() => {
    const running = Boolean(live.pending);
    if (prevPending.current && !running) {
      lastEndRef.current = Date.now();
      lastAnswerRef.current = live.turns[0]?.answerMd ?? '';
    }
    prevPending.current = running;
  }, [live.pending, live.turns]);

  /* ---------- 推按说话（Space）---------- */
  useEffect(() => {
    if (settings.micMode !== 'ptt') {
      pttHeldRef.current = false;
      setPttActive(false);
      return;
    }
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      if (pttHeldRef.current) return;
      if (!listening) toggleMic();
      pttHeldRef.current = true;
      setPttActive(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !pttHeldRef.current) return;
      e.preventDefault();
      pttHeldRef.current = false;
      setPttActive(false);
      pttReleaseRef.current = Date.now();
      scheduleRef.current();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [settings.micMode, listening, toggleMic]);

  /* ---------- 快捷键 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleMic();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setShotOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        void send(inputRef.current, 'manual');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMic, send]);

  /* ---------- 恢复未结束会话 ---------- */
  useEffect(() => {
    if (!activeId || resumedRef.current) return;
    resumedRef.current = true;
    void (async () => {
      const list = await db.listSessions(activeId);
      const last = list[0];
      if (last && !last.endedAt && last.mode === 'assist' && Date.now() - last.startedAt < 6 * 3600 * 1000) {
        await live.resume(last);
        toast('已恢复上一轮未结束的会话', 'info', last.snapshotLabel);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const preview = usePreview(
    input || live.turns[0]?.question || '',
    live.snapCards,
    live.snapChunks,
    live.snapQas,
    Boolean(live.session)
  );

  /* ---------- 动作 ---------- */
  const switchProfile = async (id: string) => {
    if (!id || id === activeId || switchingProfile) return;
    setSwitchingProfile(true);
    try {
      await setActive(id);
    } finally {
      setSwitchingProfile(false);
    }
  };

  const handleStart = async () => {
    if (switchingProfile) return;
    setStarting(true);
    try {
      const s = await live.start(live.mode);
      if (s) {
        setTranscript([]);
        updateInput('');
        practice.setItems([]);
        practice.setQuestion('');
        // 正式面试（辅助模式）默认进入专注视图：只留问题、答稿和必要状态。
        if (live.mode === 'assist') setFocus(true);
        toast('本轮已开始', 'ok', s.snapshotLabel);
      }
    } finally {
      setStarting(false);
    }
  };

  const finish = async (withReview: boolean) => {
    setEnding(true);
    setFocus(false);
    try {
      const s = await live.end();
      if (!s) return;
      sys.stop();
      if (!withReview) {
        await refreshSessions();
        live.reset();
        practice.setItems([]);
        practice.setQuestion('');
        setTranscript([]);
        updateInput('');
        setEndOpen(false);
        toast('本轮已结束', 'ok', '记录已保存，随时可以回来复盘');
        return;
      }
      const res = await generateReviews({ ...s, endedAt: s.endedAt ?? Date.now() }, settings);
      await refreshActive();
      await refreshSessions();
      setEndOpen(false);
      toast(
        `复盘已生成 · 平均分 ${res.summary.avg}`,
        'ok',
        res.local ? '未配置 Key，使用本地规则点评' : '逐条点评已落库'
      );
      router.push(`/review?session=${s.id}`);
    } catch (e: any) {
      toast('生成复盘失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setEnding(false);
    }
  };

  if (!live.session) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-6 sm:px-5">
        <StartPanel
          qas={live.snapQas}
          docCount={new Set(live.snapChunks.map((c) => c.docId)).size}
          instructions={live.snap?.profile?.instructions ?? active?.instructions ?? ''}
          mode={live.mode}
          setMode={live.setMode}
          onStart={handleStart}
          starting={starting}
          demo={!settings.apiKey.trim()}
          hasProfile={Boolean(activeId)}
          profiles={profiles}
          activeId={activeId}
          switching={switchingProfile}
          onSelectProfile={(id) => void switchProfile(id)}
          onNewProfile={() => router.push('/profile?new=1')}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col px-4 py-4 sm:px-5 xl:h-full">
      <LiveHeader
        mode={live.mode}
        listening={listening}
        snap={live.snap}
        startedAt={live.session.startedAt}
        lastLatency={live.turns[0]?.latencyMs}
        fastModel={live.fastModel}
        onScreenshot={() => setShotOpen(true)}
        onFocus={() => setFocus(true)}
        onEnd={() => setEndOpen(true)}
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[300px_minmax(0,1fr)_286px] xl:overflow-hidden">
        <LiveConsole
          mode={live.mode}
          setMode={live.setMode}
          listening={listening}
          onToggleMic={toggleMic}
          micSupported={speechSupported()}
          transcript={transcript}
          interim={interim}
          input={input}
          setInput={updateInput}
          onSend={() => void send(input, 'manual')}
          sending={Boolean(live.pending)}
          onScreenshot={() => setShotOpen(true)}
          onPracticeAsk={() => void practice.generate(live.snapCards)}
          generatingQ={practice.generating}
          autoAnswer={settings.autoAnswer}
          silenceMs={settings.silenceMs}
          micMode={settings.micMode}
          pttActive={pttActive}
          hint={hint}
          onToggleAuto={() => saveSettings({ autoAnswer: !settings.autoAnswer })}
          systemOn={sys.listening}
          systemLevel={sys.level}
          systemBusy={sys.busy}
          asrReady={sys.ready}
          systemError={sys.error}
          systemLatency={sys.latency}
          systemModel={sys.activeModel}
          systemInterim={sys.interim}
          onToggleSystem={() => {
            if (sys.listening) sys.stop();
            else void sys.start();
          }}
          onClear={() => {
            setTranscript([]);
            setInterim('');
            updateInput('');
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
        />

        <AnswerFeed
          mode={live.mode}
          pending={live.pending}
          turns={live.turns}
          practice={practice.items}
          practiceQ={practice.question}
          cardCount={live.snap?.cardIds.length ?? 0}
          onRetryPending={() => {
            const q = live.pending?.question;
            if (q) void live.ask(q, live.pending?.source ?? 'manual');
          }}
          onRegenerate={(t, s) => void live.regenerate(t, s)}
          onAddToCard={(r, t) => void practice.addToCard(r, t)}
        />

        <ContextRail
          snap={live.snap}
          hits={preview}
          style={live.style}
          setStyle={live.setStyle}
          answerMode={live.answerMode}
          setAnswerMode={live.setAnswerMode}
          demo={!settings.apiKey.trim()}
          lastLatency={live.turns[0]?.latencyMs}
        />
      </div>

      {focus ? (
        <FocusView
          sessionLabel={live.session.title}
          startedAt={live.session.startedAt}
          listening={listening}
          systemOn={sys.listening}
          systemBusy={sys.busy}
          systemError={sys.error}
          systemModel={sys.activeModel}
          systemInterim={sys.interim}
          interim={interim}
          transcript={transcript}
          turns={live.turns}
          pending={live.pending}
          autoAnswer={settings.autoAnswer}
          input={input}
          setInput={updateInput}
          onSend={() => void send(input, 'manual')}
          sending={Boolean(live.pending)}
          onToggleAuto={() => saveSettings({ autoAnswer: !settings.autoAnswer })}
          onToggleSystem={() => {
            if (sys.listening) sys.stop();
            else void sys.start();
          }}
          onExit={() => setFocus(false)}
          lastLatency={live.turns[0]?.latencyMs}
        />
      ) : null}

      <ScreenshotDialog
        open={shotOpen}
        onClose={() => setShotOpen(false)}
        onCaptured={(url) => void live.askImage(url)}
      />

      <EndSessionDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        count={live.mode === 'practice' ? practice.items.length : live.turns.length}
        ending={ending}
        onFinish={(v) => void finish(v)}
      />
    </div>
  );
}
