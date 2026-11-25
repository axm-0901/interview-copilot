/* 系统音频采集 → VAD 分段 → 16k 单声道 WAV
   只抓「电脑里放出来的声音」，不含麦克风，所以不会有回声和自激。 */

const TARGET_RATE = 16000;
// 本地 tiny 分片一轮约 200ms，partial 调到 700ms 才能接近「边说边出字」；
// 云端分片如果扛不住，可以在 useSystemAudio 里按模型自动拉长。
const SILENCE_MS = 600;
const PARTIAL_MS = 500;
const MIN_PARTIAL_MS = 800;
const MAX_UTTERANCE_MS = 30000;
const MIN_FINAL_MS = 350;
const NEW_AUDIO_SAMPLES = 6400;
const THRESHOLD = 0.006;

export interface SegmentPayload {
  wav: Blob;
  durationMs: number;
  final: boolean;
}

interface Options {
  onLevel?: (rms: number) => void;
  onSegment: (s: SegmentPayload) => void;
  onError?: (msg: string) => void;
  /** true 时不走 VAD 分段，持续输出 16k/16bit PCM，交给 8761 流式桥 */
  streaming?: boolean;
  onPcm?: (pcm: Int16Array, rms: number) => void;
}

function rmsOf(frame: Float32Array) {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

function rmsPcm(pcm: Int16Array) {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / pcm.length);
}

function downsample(input: Float32Array, inRate: number) {
  if (inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate = TARGET_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** 任意采样率 Float32 → 16k Int16（腾讯云/桥要求 16k、16bit、单声道） */
function toInt16(input: Float32Array, inRate: number) {
  const pcm = downsample(input, inRate);
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function testToneWav(ms = 900) {
  const n = Math.floor((TARGET_RATE * ms) / 1000);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pcm[i] = Math.sin((2 * Math.PI * 440 * i) / TARGET_RATE) * 0.2;
  }
  return encodeWav(pcm);
}

export class SystemAudioRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private streaming: boolean;
  private chunks: Float32Array[] = [];
  private total = 0;
  /** 流式模式下的 16k PCM 累积（约 100ms 发一帧） */
  private pcmParts: Int16Array[] = [];
  private pcmSamples = 0;
  private speaking = false;
  private lastVoiceAt = 0;
  private lastPartialAt = 0;
  private partialAtSamples = 0;
  private levelAt = 0;
  private stopped = false;

  constructor(private opts: Options) {
    this.streaming = Boolean(opts.streaming);
  }

  get running() {
    return Boolean(this.stream) && !this.stopped;
  }

  /**
   * 实时流断线后原地切到分片模式：保留已经拿到的 MediaStream，
   * 不用再次弹「共享屏幕」选择框。
   */
  setStreaming(on: boolean) {
    if (this.streaming === on) return;
    this.streaming = on;
    if (!on) {
      // 流式残留的 PCM 直接丢掉，VAD 从下一帧重新起
      this.pcmParts = [];
      this.pcmSamples = 0;
    }
    this.reset();
  }

  async start() {
    if (this.stream || this.ctx) this.teardown();
    this.stopped = false;

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audio = stream.getAudioTracks();
      if (!audio.length) {
        throw new Error('这次共享没有带音频轨，请重新开始并勾选「分享系统音频 / 标签页音频」');
      }
      // 只要声音，视频轨立刻停掉，不留任何画面采集
      stream.getVideoTracks().forEach((t) => t.stop());

      this.stream = stream;
      this.ctx = new AudioContext();
      await this.ctx.resume();
      if (this.stopped) throw new Error('音频采集已取消');

      const source = this.ctx.createMediaStreamSource(new MediaStream(audio));
      this.source = source;
      const node = this.ctx.createScriptProcessor(4096, 1, 1);
      this.node = node;
      node.onaudioprocess = (e) => this.handle(e.inputBuffer.getChannelData(0));
      source.connect(node);
      // 必须挂到 destination 才会被驱动；用 0 增益避免把系统声音再放出来一遍
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute);
      mute.connect(this.ctx.destination);

      this.reset();
    } catch (e) {
      // 启动中途失败（无音频轨 / AudioContext 被拒 / 用户取消）也要把已拿到的资源关掉
      this.teardown();
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  private reset() {
    this.chunks = [];
    this.total = 0;
    this.pcmParts = [];
    this.pcmSamples = 0;
    this.speaking = false;
    this.lastVoiceAt = 0;
    this.lastPartialAt = 0;
    this.partialAtSamples = 0;
  }

  private handle(frame: Float32Array) {
    if (this.stopped || !this.ctx) return;
    const now = performance.now();
    const copy = new Float32Array(frame);
    const rms = rmsOf(copy);
    if (now - this.levelAt > 90) {
      this.opts.onLevel?.(rms);
      this.levelAt = now;
    }

    // 流式模式：不切句，持续把 PCM 送给 8761，由桥做 VAD 和断句
    if (this.streaming && this.opts.onPcm) {
      this.pushPcm(copy);
      return;
    }

    this.chunks.push(copy);
    this.total += copy.length;
    if (rms > THRESHOLD) {
      this.speaking = true;
      this.lastVoiceAt = now;
    }
    if (!this.speaking) {
      // 没在说话时只保留最近 0.4 秒，避免静音堆内存
      this.trimIdle();
      return;
    }

    const ms = (this.total / this.ctx.sampleRate) * 1000;
    if (now - this.lastVoiceAt > SILENCE_MS) {
      this.finalize(ms);
      return;
    }
    if (
      ms >= MIN_PARTIAL_MS &&
      now - this.lastPartialAt > PARTIAL_MS &&
      this.total - this.partialAtSamples > NEW_AUDIO_SAMPLES
    ) {
      this.lastPartialAt = now;
      this.partialAtSamples = this.total;
      this.emit(false, ms);
    }
    if (ms > MAX_UTTERANCE_MS) this.finalize(ms);
  }

  private pushPcm(frame: Float32Array) {
    if (!this.ctx) return;
    const pcm = toInt16(frame, this.ctx.sampleRate);
    if (!pcm.length) return;
    this.pcmParts.push(pcm);
    this.pcmSamples += pcm.length;
    // 1600 samples = 100ms @16k；比 200ms 更早把声音送到云端，首 partial 更靠前
    if (this.pcmSamples >= 1600) this.flushPcm();
  }

  private flushPcm() {
    if (!this.pcmParts.length) return;
    const merged = new Int16Array(this.pcmSamples);
    let offset = 0;
    for (const p of this.pcmParts) {
      merged.set(p, offset);
      offset += p.length;
    }
    this.pcmParts = [];
    this.pcmSamples = 0;
    this.opts.onPcm?.(merged, rmsPcm(merged));
  }

  private trimIdle() {
    if (!this.ctx) return;
    const keep = Math.floor(this.ctx.sampleRate * 0.5);
    if (this.total <= keep) return;
    while (this.total - (this.chunks[0]?.length ?? 0) > keep && this.chunks.length > 1) {
      this.total -= this.chunks.shift()!.length;
    }
  }

  private emit(final: boolean, ms: number) {
    if (!this.ctx) return;
    const merged = new Float32Array(this.total);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    const pcm = downsample(merged, this.ctx.sampleRate);
    this.opts.onSegment({ wav: encodeWav(pcm), durationMs: Math.round(ms), final });
  }

  private finalize(ms: number) {
    if (ms >= MIN_FINAL_MS) this.emit(true, ms);
    this.reset();
  }

  private teardown() {
    this.stopped = true;
    if (this.node) {
      try {
        this.node.onaudioprocess = null;
      } catch {
        /* ignore */
      }
      try {
        this.node.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.node = null;
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.source = null;
    try {
      this.stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    this.stream = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        void ctx.close().catch(() => {});
      } catch {
        /* ignore */
      }
    }
    this.reset();
  }

  stop() {
    if (this.streaming) this.flushPcm();
    this.teardown();
  }
}
