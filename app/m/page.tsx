'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
  Mic,
  RefreshCw,
  Send,
  Shuffle,
  Square,
  Volume2,
} from 'lucide-react';
import { matchQA } from '@/lib/qaMatch';
import { speak } from '@/lib/asr';
import type { QAEntry } from '@/lib/types';

type MobileProfile = {
  name?: string;
  company?: string;
  targetRole?: string;
  round?: string;
  lang?: string;
  instructions?: string;
};

type MobileSettings = {
  apiBase?: string;
  apiKey?: string;
  model?: string;
  fastModel?: string;
  noThink?: boolean;
  temperature?: number;
  asrBase?: string;
  asrKey?: string;
  asrModel?: string;
  asrFinalModel?: string;
};

type MobileData = {
  syncedAt?: number;
  profile?: MobileProfile;
  qas: QAEntry[];
  settings?: MobileSettings;
};

const STORE_KEY = 'copilot-mobile-practice-v1';

const fmtTime = (t?: number) =>
  t ? new Date(t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未同步';

export default function MobilePracticePage() {
  const [data, setData] = useState<MobileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'practice' | 'bank'>('practice');
  const [current, setCurrent] = useState<QAEntry | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manual, setManual] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [answer, setAnswer] = useState('');
  const [answerFrom, setAnswerFrom] = useState<'qa' | 'model' | ''>('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const partialSeq = useRef(0);
  const partialBusy = useRef(false);

  const qas = data?.qas ?? [];
  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return qas;
    return qas.filter((x) => (x.question + ' ' + x.aliases.join(' ') + ' ' + x.answer).includes(q));
  }, [qas, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mobile/data', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? '还没有同步数据');
      }
      const fresh = (await res.json()) as MobileData;
      setData(fresh);
      localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    } catch (e: any) {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        try {
          setData(JSON.parse(saved));
          setError('当前用的是上次同步的离线题库');
        } catch {
          setError(String(e?.message ?? e));
        }
      } else {
        setError(String(e?.message ?? e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      try {
        setData(JSON.parse(saved));
        setLoading(false);
      } catch {
        /* ignore */
      }
    }
    void load();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, [load]);

  const pickRandom = useCallback(() => {
    if (!qas.length) return;
    let next = qas[Math.floor(Math.random() * qas.length)];
    if (qas.length > 1 && current && next.id === current.id) {
      next = qas[(qas.indexOf(next) + 1) % qas.length];
    }
    setCurrent(next);
    setRevealed(false);
    setAnswer('');
    setAnswerFrom('');
    setTranscript('');
    setManual('');
    setError('');
  }, [current, qas]);

  const showAnswer = useCallback(() => {
    if (!current) return;
    setAnswer(current.answer);
    setAnswerFrom('qa');
    setRevealed(true);
  }, [current]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const askModel = useCallback(
    async (question: string) => {
      const s = data?.settings ?? {};
      if (!s.apiBase) {
        setError('没有同步模型配置，先在电脑端设置好模型再同步');
        return;
      }
      setAnswering(true);
      setAnswer('');
      setAnswerFrom('model');
      setError('');
      const profileText = [
        data?.profile?.name ? `姓名：${data.profile.name}` : '',
        data?.profile?.targetRole ? `目标岗位：${data.profile.targetRole}` : '',
        data?.profile?.company ? `公司：${data.profile.company}` : '',
        data?.profile?.instructions ? `表达偏好：${data.profile.instructions}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiBase: s.apiBase,
            apiKey: s.apiKey ?? '',
            model: s.fastModel || (s.apiBase?.includes('8760') ? 'glm-5.3-flash' : s.model) || 'gpt-4o-mini',
            temperature: Math.min(s.temperature ?? 0.4, 0.5),
            maxTokens: 300,
            noThink: s.noThink !== false,
            messages: [
              {
                role: 'system',
                content:
                  '你是面试练习助手。用第一人称、口语化回答，150~250字：第一句给结论，中间2~3条依据，最后一句收口。' +
                  '不要编造简历之外的公司、项目、数字；不知道的事实用“这块我还在补”带过。' +
                  (profileText ? `\n候选人信息：\n${profileText}` : ''),
              },
              { role: 'user', content: question },
            ],
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `模型返回 ${res.status}`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let full = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).replace(/\r$/, '');
            buf = buf.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              const delta = j?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta) {
                full += delta;
                setAnswer(full);
              }
            } catch {
              /* 忽略心跳/非 JSON 行 */
            }
          }
        }
        if (!full) throw new Error('模型没有返回内容');
      } catch (e: any) {
        setError(String(e?.message ?? e).slice(0, 180));
      } finally {
        setAnswering(false);
      }
    },
    [data]
  );

  const answerQuestion = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setTranscript(q);
      const hit = matchQA(q, qas);
      if (hit && hit.entry.answer.trim()) {
        setCurrent({ ...hit.entry, question: q });
        setAnswer(hit.entry.answer.trim());
        setAnswerFrom('qa');
        setRevealed(true);
        setError('');
      } else {
        setCurrent(null);
        void askModel(q);
      }
    },
    [askModel, qas]
  );

  const requestAsr = useCallback(
    async (blob: Blob, ext: string) => {
      const s = data?.settings ?? {};
      const base = s.asrBase || s.apiBase;
      if (!base) throw new Error('没有同步语音识别配置，先用下面的输入框打字提问');
      const fd = new FormData();
      fd.append('file', blob, `question.${ext}`);
      fd.append('apiBase', base);
      fd.append('apiKey', s.asrKey || s.apiKey || '');
      fd.append('model', s.asrFinalModel || s.asrModel || 'whisper-1');
      fd.append('lang', 'zh');
      if (s.asrFinalModel) {
        fd.append('local', '1');
        fd.append('beamSize', '1');
        fd.append('vadFilter', 'true');
      }
      const res = await fetch('/api/asr', { method: 'POST', body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? `转写失败（${res.status}）`);
      const text = String(j?.text ?? '').trim();
      if (!text) throw new Error('没有听清，再说一次或直接打字');
      return text;
    },
    [data]
  );

  const transcribeFinal = useCallback(
    async (blob: Blob, ext: string) => {
      setTranscribing(true);
      setError('');
      try {
        const text = await requestAsr(blob, ext);
        answerQuestion(text);
      } catch (e: any) {
        setError(String(e?.message ?? e).slice(0, 180));
      } finally {
        setTranscribing(false);
      }
    },
    [answerQuestion, requestAsr]
  );

  /** 录音过程中每 1.6 秒送一次“到目前为止”的音频，先把文字显示出来，别让用户干等 */
  const sendPartial = useCallback(
    async (type: string, ext: string) => {
      if (partialBusy.current || !chunksRef.current.length) return;
      partialBusy.current = true;
      const seq = ++partialSeq.current;
      try {
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 6000) return;
        const text = await requestAsr(blob, ext);
        if (seq === partialSeq.current && text) setTranscript(text);
      } catch {
        /* partial 失败不打扰，final 会兜底 */
      } finally {
        partialBusy.current = false;
      }
    },
    [requestAsr]
  );

  const startRec = useCallback(async () => {
    if (recording || transcribing) return;
    setError('');
    setAnswer('');
    setAnswerFrom('');
    setCurrent(null);
    setRevealed(false);
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) =>
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
      );
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      partialSeq.current += 1;
      const type = rec.mimeType || mime || 'audio/mp4';
      const ext = type.includes('mp4') ? 'm4a' : 'webm';
      rec.ondataavailable = (e) => {
        if (e.data.size) {
          chunksRef.current.push(e.data);
          if (rec.state === 'recording') void sendPartial(type, ext);
        }
      };
      rec.onstop = () => {
        partialSeq.current += 1;
        const blob = new Blob(chunksRef.current, { type });
        stopStream();
        setRecording(false);
        if (blob.size < 2000) {
          setError('录音太短，再说一次');
          return;
        }
        void transcribeFinal(blob, ext);
      };
      rec.start(1600);
      setRecording(true);
      setTranscript('正在听…');
    } catch (e: any) {
      setError(`麦克风打不开：${String(e?.message ?? e)}。检查是否用 HTTPS 打开、是否允许了麦克风。`);
      setRecording(false);
      stopStream();
    }
  }, [recording, sendPartial, stopStream, transcribeFinal, transcribing]);

  const stopRec = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      setRecording(false);
    }
  }, []);

  const headerTitle = tab === 'practice' ? '练习' : '题库';

  return (
    <div className="min-h-screen bg-[#07080c] text-txt">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between px-4 pb-2 pt-3">
          <div>
            <div className="text-[11px] font-medium tracking-wide text-brand">面试练习 · 手机版</div>
            <h1 className="text-[19px] font-semibold">{headerTitle}</h1>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1 rounded-full border border-ink-line px-3 py-1.5 text-[11px] text-txt-mute"
          >
            <RefreshCw size={12} /> 同步
          </button>
        </header>

        <div className="mx-4 mb-3 flex rounded-full bg-[#12161d] p-1 text-[12px]">
          <button
            onClick={() => setTab('practice')}
            className={`flex-1 rounded-full py-2 ${tab === 'practice' ? 'bg-[#1b2433] text-txt' : 'text-txt-mute'}`}
          >
            抽题练习
          </button>
          <button
            onClick={() => setTab('bank')}
            className={`flex-1 rounded-full py-2 ${tab === 'bank' ? 'bg-[#1b2433] text-txt' : 'text-txt-mute'}`}
          >
            题库 {qas.length ? `· ${qas.length}` : ''}
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-txt-mute">
            <Loader2 size={16} className="mr-2 animate-spin" /> 正在读取题库…
          </div>
        ) : !qas.length ? (
          <div className="mx-4 rounded-[14px] border border-ink-line bg-[#12161d] p-5 text-[13px] leading-relaxed text-txt-dim">
            <p className="mb-2 font-medium text-txt">还没有同步题库</p>
            <p>在电脑上打开「标准问答」页面，点右上角「同步到手机」，然后回到这里点「同步」。</p>
            <p className="mt-2 text-txt-mute">同步地址必须和电脑同一个 Tailscale 网络，并且用 HTTPS 打开。</p>
          </div>
        ) : tab === 'bank' ? (
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索题目或答案…"
              className="mb-3 w-full rounded-[10px] border border-ink-line bg-[#12161d] px-3 py-3 text-[14px] outline-none placeholder:text-txt-mute"
            />
            <div className="space-y-2">
              {filtered.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="w-full rounded-[12px] border border-ink-line bg-[#12161d] p-4 text-left"
                >
                  <div className="text-[14px] font-medium leading-relaxed">{q.question}</div>
                  {expanded === q.id ? (
                    <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-[1.8] text-txt-dim">{q.answer}</div>
                  ) : (
                    <div className="mt-1 text-[11px] text-txt-mute">点开看答案</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-40">
            {current ? (
              <div className="rounded-[14px] border border-ink-line bg-[#12161d] p-4">
                <div className="mb-2 flex items-center justify-between text-[11px] text-txt-mute">
                  <span>当前题目</span>
                  {answerFrom === 'qa' ? <span className="text-ok">题库原答案</span> : answerFrom === 'model' ? <span>模型生成</span> : null}
                </div>
                <div className="whitespace-pre-wrap text-[16px] font-medium leading-relaxed">{current.question}</div>
              </div>
            ) : (
              <div className="rounded-[14px] border border-dashed border-ink-line bg-[#0f131a] p-6 text-center">
                <div className="text-[15px] font-medium">点下面麦克风，自己提问</div>
                <div className="mt-1 text-[12px] text-txt-mute">也可以点「随机抽题」，看题后自己先答一遍，再显示答案</div>
              </div>
            )}

            {transcript ? (
              <div className="mt-3 rounded-[12px] border border-ink-line bg-[#0f131a] p-3 text-[13px] leading-relaxed text-txt-dim">
                <span className="text-[11px] text-txt-mute">听到：</span> {transcript}
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 rounded-[12px] border border-danger/30 bg-danger/[.06] p-3 text-[12.5px] leading-relaxed text-danger">
                {error}
              </div>
            ) : null}

            {answer ? (
              <div className="mt-3 rounded-[14px] border border-ink-line bg-[#12161d] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] text-txt-mute">参考答案</span>
                  <button
                    onClick={() => speak(answer, '中文')}
                    className="flex items-center gap-1 rounded-full border border-ink-line px-2.5 py-1 text-[11px] text-txt-mute"
                  >
                    <Volume2 size={12} /> 朗读
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-[15px] leading-[1.85] text-txt">{answer}</div>
              </div>
            ) : answering ? (
              <div className="mt-4 flex items-center gap-2 text-[13px] text-txt-mute">
                <Loader2 size={14} className="animate-spin" /> 正在生成参考答案…
              </div>
            ) : null}

            {current && !revealed && !answer && !answering ? (
              <button
                onClick={showAnswer}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] border border-ink-line bg-[#12161d] py-3.5 text-[14px] text-txt-dim"
              >
                <Eye size={16} /> 显示答案
              </button>
            ) : null}
          </div>
        )}

        {tab === 'practice' && qas.length ? (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-line/80 bg-[#07080c]/95 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-[520px] items-center gap-3 px-4">
              <button
                onClick={pickRandom}
                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-ink-line text-txt-dim"
                title="随机抽题"
              >
                <Shuffle size={18} />
              </button>
              <button
                onClick={recording ? stopRec : startRec}
                disabled={transcribing}
                className={`flex h-[58px] flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-medium ${
                  recording ? 'bg-danger text-white' : 'bg-[linear-gradient(135deg,#4d8dff,#7b5cff)] text-white'
                } disabled:opacity-60`}
              >
                {transcribing ? <Loader2 size={18} className="animate-spin" /> : recording ? <Square size={16} /> : <Mic size={18} />}
                {transcribing ? '正在转写…' : recording ? '停止并解析' : '点一下开始说话'}
              </button>
              <button
                onClick={() => {
                  if (answer) setRevealed(!revealed);
                }}
                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-ink-line text-txt-dim"
                title={revealed ? '隐藏答案' : '显示答案'}
              >
                {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="mx-auto mt-2 flex max-w-[520px] items-center gap-2 px-4">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    answerQuestion(manual);
                    setManual('');
                  }
                }}
                placeholder="识别不准？直接打字提问"
                className="min-w-0 flex-1 rounded-full border border-ink-line bg-[#12161d] px-4 py-2.5 text-[13px] outline-none placeholder:text-txt-mute"
              />
              <button
                onClick={() => {
                  answerQuestion(manual);
                  setManual('');
                }}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#1b2433] text-txt-dim"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
