'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SystemAudioRecorder, testToneWav } from '@/lib/audio';
import { StreamASRClient } from '@/lib/asrStream';
import { resolveUpstream } from '@/lib/upstreamUrl';
import { toast } from '@/lib/toast';
import type { AppSettings } from '@/lib/types';

/**
 * 系统音频（对方的声音）→ 文本。
 *
 * 两种模式（settings.asrMode）：
 * - auto（默认）：先连 8761 实时流；连不上 / 中途断线才回退分片
 * - stream：只用实时流，连不上就报错，绝不偷偷回退
 * - chunk：只用分片
 *
 * 分片链路：VAD 切句 → /api/asr → 本地 8765 / 云端 OpenAI 兼容
 * /audio/transcriptions。
 */

const PARTIAL_TIMEOUT_MS = 12_000;
const FINAL_TIMEOUT_MS = 30_000;
const PREWARM_TIMEOUT_MS = 20_000;
/** 流式断线后，最多每隔这么久试一次 8761；成功就切回流式 */
const STREAM_RECONNECT_MS = 6_000;
const STREAM_RECONNECT_TIMEOUT_MS = 1_800;

type Lane = 'stream' | 'chunk';

function streamModelLabel(mode: string) {
  return mode === 'tencent' ? '腾讯云实时 16k_zh' : mode === 'local' ? '本地流式 large-v3' : mode;
}

/** 分片链路是否可用：公网需要 Key，本机 8760/8765 允许不带 Key */
function chunkReady(s: AppSettings) {
  const key = (s.asrKey || s.apiKey || '').trim();
  if (key) return true;
  const check = resolveUpstream(s.asrBase || s.apiBase || '');
  return check.ok && check.loopback;
}

export function useSystemAudio(settings: AppSettings, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(0);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const [latency, setLatency] = useState(0);
  const [activeModel, setActiveModel] = useState('');

  const recRef = useRef<SystemAudioRecorder | null>(null);
  const streamRef = useRef<StreamASRClient | null>(null);
  const finalChain = useRef<Promise<void>>(Promise.resolve());
  const partialInFlight = useRef(false);
  const pendingPartial = useRef<Blob | null>(null);
  /** 会话代际：start / stop / 断线都会 +1，旧回调一律丢弃 */
  const generation = useRef(0);
  /** 当前实际在用的链路；分片在途结果靠它判断是否已经切回流式 */
  const laneRef = useRef<Lane>('chunk');
  /** 断句代际：final 一到，在途的 partial 结果就作废 */
  const utterance = useRef(0);
  /** 流式重连定时器；同一时刻只允许一个 */
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterim = useRef('');
  const warmed = useRef(false);
  const activeRef = useRef(false);
  const startingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const cfgRef = useRef(settings);
  cfgRef.current = settings;

  const ready = Boolean(
    (settings.asrStreamUrl || '').trim() ||
      (settings.asrKey || settings.apiKey).trim() ||
      chunkReady(settings)
  );

  const transcribe = useCallback(
    async (blob: Blob, final: boolean, signal?: AbortSignal, timeoutMs?: number) => {
      const s = cfgRef.current;
      const model = final ? s.asrFinalModel || s.asrModel : s.asrPartialModel || s.asrModel;
      const local = Boolean(s.asrPartialModel || s.asrFinalModel);

      const fd = new FormData();
      fd.append('file', blob);
      fd.append('apiBase', s.asrBase || s.apiBase);
      fd.append('apiKey', s.asrKey || s.apiKey);
      fd.append('model', model || 'whisper-1');
      fd.append('lang', s.lang === '英文' ? 'en' : 'zh');
      if (local) {
        fd.append('local', '1');
        fd.append('beamSize', '1');
        fd.append('vadFilter', final ? 'true' : 'false');
      }

      const limit = timeoutMs ?? (final ? FINAL_TIMEOUT_MS : PARTIAL_TIMEOUT_MS);
      const ctrl = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, limit);
      const onAbort = () => ctrl.abort();
      if (signal) {
        if (signal.aborted) ctrl.abort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }

      const t0 = performance.now();
      try {
        const res = await fetch('/api/asr', {
          method: 'POST',
          body: fd,
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `转写失败（${res.status}）`);
        // 已经切回流式后，迟到的分片结果不得覆盖流式的模型/延迟状态
        if (laneRef.current === 'chunk') {
          setLatency(Math.round(performance.now() - t0));
          setActiveModel(model || 'whisper-1');
        }
        return String(data?.text ?? '').trim();
      } catch (e: any) {
        if (timedOut) {
          throw new Error(final ? '定稿转写超时（30 秒）' : '实时转写超时（12 秒）');
        }
        throw e;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      }
    },
    []
  );

  /** partial 只保留最新一段，前一轮没回来就覆盖，不排队 */
  const drainPartial = useCallback(async () => {
    if (partialInFlight.current) return;
    partialInFlight.current = true;
    const gen = generation.current;
    const signal = abortRef.current?.signal;
    try {
      while (pendingPartial.current) {
        if (gen !== generation.current || !activeRef.current) {
          pendingPartial.current = null;
          break;
        }
        const blob = pendingPartial.current;
        pendingPartial.current = null;
        const utt = utterance.current;
        try {
          const text = await transcribe(blob, false, signal);
          if (!text) continue;
          if (
            gen !== generation.current ||
            utt !== utterance.current ||
            !activeRef.current ||
            laneRef.current !== 'chunk'
          )
            continue;
          lastInterim.current = text;
          setInterim(text);
        } catch (e: any) {
          if (e?.name === 'AbortError' || gen !== generation.current) continue;
          setError(String(e?.message ?? e).slice(0, 140));
        }
      }
    } finally {
      partialInFlight.current = false;
    }
  }, [transcribe]);

  const start = useCallback(async () => {
    // 防重入：连点两次不会开两个采集 / 两个 WebSocket
    if (startingRef.current) return false;
    if (activeRef.current) return true;
    if (!ready) {
      toast(
        '先配置语音识别',
        'warn',
        '设置 → 语音识别：默认连 8761 实时桥；也可以填一个支持 /audio/transcriptions 的 Key 走分片'
      );
      return false;
    }

    startingRef.current = true;
    setBusy(true);
    setError('');

    const gen = generation.current + 1;
    generation.current = gen;
    utterance.current += 1;
    pendingPartial.current = null;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // 上一次异常退出可能留下录音器和半死连接，先清干净再开
    recRef.current?.stop();
    recRef.current = null;
    streamRef.current?.destroy();
    streamRef.current = null;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    laneRef.current = 'chunk';

    let stream: StreamASRClient | null = null;
    let rec: SystemAudioRecorder | null = null;
    let reconnectBusy = false;
    /** 分片断句代际：切回流式后，在途的分片 final 一律作废，避免重复 final */
    let chunkEpoch = 0;

    function streamClient() {
      const s = cfgRef.current;
      return new StreamASRClient({
        url: (s.asrStreamUrl || '').trim(),
        lang: s.lang,
        silenceMs: s.silenceMs,
        handlers: {
          onPartial: (text) => {
            if (gen !== generation.current || !activeRef.current || laneRef.current !== 'stream') return;
            lastInterim.current = text;
            setInterim(text);
          },
          onFinal: (text) => {
            if (gen !== generation.current || !activeRef.current || laneRef.current !== 'stream') return;
            utterance.current += 1;
            setInterim('');
            lastInterim.current = '';
            finalRef.current(text);
          },
          onError: (m) => {
            if (gen !== generation.current || laneRef.current !== 'stream') return;
            setError(String(m).slice(0, 140));
          },
          onClose: (unexpected) => {
            if (gen !== generation.current || !unexpected) return;
            dropStream('实时流已断开');
          },
        },
      });
    }

    function queueReconnect() {
      if (gen !== generation.current || !activeRef.current || laneRef.current !== 'chunk') return;
      if (reconnectTimer.current) return;
      // 5~10 秒一次，避免桥刚挂时高频重连
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        void tryReconnect();
      }, STREAM_RECONNECT_MS);
    }

    async function tryReconnect() {
      if (
        gen !== generation.current ||
        !activeRef.current ||
        laneRef.current !== 'chunk' ||
        reconnectBusy
      )
        return;
      const s = cfgRef.current;
      if (s.asrMode === 'chunk') return;
      const url = (s.asrStreamUrl || '').trim();
      if (!url) return;

      reconnectBusy = true;
      setError('实时流已断开，正在用分片识别；正在重连实时流…');
      const client = streamClient();
      try {
        const mode = await client.connect(STREAM_RECONNECT_TIMEOUT_MS);
        if (!client.connected) throw new Error('实时流刚连上就断开');
        if (gen !== generation.current || !activeRef.current || laneRef.current !== 'chunk') {
          client.destroy();
          return;
        }
        // 切回流式：清掉分片残留，后续 PCM 直接送到新连接。
        stream = client;
        streamRef.current = client;
        laneRef.current = 'stream';
        chunkEpoch += 1;
        utterance.current += 1;
        pendingPartial.current = null;
        lastInterim.current = '';
        setInterim('');
        recRef.current?.setStreaming(true);
        setActiveModel(`${streamModelLabel(mode)} · 已恢复`);
        setLatency(0);
        setError('');
        toast('实时流已恢复', 'ok', `已切回${streamModelLabel(mode)}，分片结果不再重复提交`);
        // 「已恢复」提示保留 4 秒，然后恢复常规模型名
        setTimeout(() => {
          if (gen === generation.current && laneRef.current === 'stream') {
            setActiveModel(streamModelLabel(mode));
          }
        }, 4_000);
      } catch {
        if (gen === generation.current && activeRef.current && laneRef.current === 'chunk') {
          setError('实时流已断开，正在用分片识别；实时流重连失败，稍后继续重试');
          queueReconnect();
        }
      } finally {
        reconnectBusy = false;
      }
    }

    function dropStream(reason: string) {
      if (gen !== generation.current || laneRef.current !== 'stream') return;
      streamRef.current?.destroy();
      streamRef.current = null;
      stream = null;
      laneRef.current = 'chunk';
      chunkEpoch += 1;
      utterance.current += 1;
      pendingPartial.current = null;

      const s = cfgRef.current;
      const canFallback = s.asrMode === 'auto' && chunkReady(s) && Boolean(recRef.current);
      if (canFallback && recRef.current) {
        // 保留已经拿到的 MediaStream，原地切到 VAD 分片，不打断采集
        recRef.current.setStreaming(false);
        setActiveModel('分片上传');
        setError(`${reason}，正在用分片识别；6 秒后重试实时流`);
        queueReconnect();
        return;
      }

      // 不能回退：立刻停采集，别继续空转
      activeRef.current = false;
      generation.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      recRef.current?.stop();
      recRef.current = null;
      setListening(false);
      setLevel(0);
      setInterim('');
      setError(
        s.asrMode === 'stream'
          ? `${reason}；当前是「仅流式」模式，不会回退分片`
          : `${reason}，且没有可用的分片识别`
      );
    }

    try {
      const s = cfgRef.current;
      const streamUrl = (s.asrStreamUrl || '').trim();
      const wantStream = s.asrMode !== 'chunk' && Boolean(streamUrl);
      let retryAfterStart = false;

      if (s.asrMode === 'stream' && !streamUrl) {
        setError('「仅流式」模式需要填写实时转写地址（默认 ws://127.0.0.1:8761）');
        return false;
      }

      if (wantStream) {
        const client = streamClient();

        try {
          const mode = await client.connect(1800);
          if (gen !== generation.current) {
            client.destroy();
            return false;
          }
          stream = client;
          streamRef.current = client;
          laneRef.current = 'stream';
          setActiveModel(streamModelLabel(mode));
          setLatency(0);
        } catch (e: any) {
          client.destroy();
          stream = null;
          streamRef.current = null;
          const msg = String(e?.message ?? e);
          if (s.asrMode === 'stream') {
            setError(`${msg}；当前是「仅流式」模式，不会回退分片`);
            return false;
          }
          if (!chunkReady(s)) {
            setError(`${msg}；也没有配置分片识别（/audio/transcriptions）`);
            return false;
          }
          toast('实时转写没连上', 'warn', `${msg}；这次改用分片上传`);
          setActiveModel('分片上传');
          retryAfterStart = true;
        }
      }

      if (gen !== generation.current) return false;

      const useStream = Boolean(stream);

      // 只有分片链路需要预热本地 tiny，流式桥自己常驻
      if (!useStream && s.asrPartialModel && !warmed.current) {
        warmed.current = true;
        try {
          await transcribe(testToneWav(300), false, ctrl.signal, PREWARM_TIMEOUT_MS);
        } catch {
          /* 热不起来不影响后面报错 */
        }
        if (gen !== generation.current) return false;
      }

      const recInstance = new SystemAudioRecorder({
        streaming: useStream,
        // 始终注册：断线切分片、重连成功再切回流式，都不用重建录音器
        onPcm: (pcm) => {
          if (gen !== generation.current || laneRef.current !== 'stream') return;
          streamRef.current?.sendPcm(pcm);
        },
        onLevel: (rms) => {
          if (gen === generation.current) setLevel(rms);
        },
        onError: (m) => {
          if (gen === generation.current) setError(m);
        },
        onSegment: ({ wav, final }) => {
          if (gen !== generation.current || !activeRef.current || laneRef.current !== 'chunk') return;
          const epoch = chunkEpoch;
          if (!final) {
            pendingPartial.current = wav;
            void drainPartial();
            return;
          }
          utterance.current += 1;
          pendingPartial.current = null;
          finalChain.current = finalChain.current.then(async () => {
            if (
              gen !== generation.current ||
              !activeRef.current ||
              epoch !== chunkEpoch ||
              laneRef.current !== 'chunk'
            )
              return;
            try {
              const text = await transcribe(wav, true, ctrl.signal);
              if (
                gen !== generation.current ||
                !activeRef.current ||
                epoch !== chunkEpoch ||
                laneRef.current !== 'chunk'
              )
                return;
              // large-v3 偶尔把整段判成静音；这时退回最后一次 tiny 的 interim，
              // 至少不要把用户刚说的话整段丢掉
              const committed = text || lastInterim.current;
              setInterim('');
              lastInterim.current = '';
              if (committed) finalRef.current(committed);
            } catch (e: any) {
              if (e?.name === 'AbortError') return;
              if (gen !== generation.current || epoch !== chunkEpoch) return;
              setError(String(e?.message ?? e).slice(0, 140));
            }
          });
        },
      });

      await recInstance.start();
      if (gen !== generation.current) {
        recInstance.stop();
        return false;
      }
      rec = recInstance;
      recRef.current = recInstance;
      activeRef.current = true;
      setListening(true);
      if (!useStream) setActiveModel('分片上传');

      if (retryAfterStart) {
        setError('实时流没连上，正在用分片识别；6 秒后重试实时流');
        queueReconnect();
      }
      return true;
    } catch (e: any) {
      stream?.destroy();
      streamRef.current = null;
      laneRef.current = 'chunk';
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      rec?.stop();
      recRef.current = null;
      if (gen === generation.current) generation.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      activeRef.current = false;
      const name = e?.name ?? '';
      const msg =
        name === 'NotAllowedError'
          ? '你取消了共享'
          : name === 'NotSupportedError'
          ? '这个环境不支持屏幕/系统音频采集'
          : String(e?.message ?? e);
      setError(msg);
      return false;
    } finally {
      startingRef.current = false;
      setBusy(false);
    }
  }, [ready, transcribe, drainPartial]);

  const stop = useCallback(() => {
    activeRef.current = false;
    generation.current += 1;
    utterance.current += 1;
    laneRef.current = 'chunk';
    pendingPartial.current = null;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    recRef.current?.stop();
    recRef.current = null;
    // 直接 destroy 而不是 stop：用户已停止，不需要再接最后一句 final
    streamRef.current?.destroy();
    streamRef.current = null;
    finalChain.current = Promise.resolve();
    lastInterim.current = '';
    setListening(false);
    setLevel(0);
    setInterim('');
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      generation.current += 1;
      laneRef.current = 'chunk';
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      recRef.current?.stop();
      recRef.current = null;
      streamRef.current?.destroy();
      streamRef.current = null;
    },
    []
  );

  return {
    ready,
    listening,
    busy,
    level,
    interim,
    error,
    latency,
    activeModel,
    start,
    stop,
    setError,
  };
}
