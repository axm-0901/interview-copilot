/**
 * 本地实时转写桥（stream_bridge.py）的浏览器客户端。
 *
 * 桥在 ws://127.0.0.1:8761，负责：
 * - 把 16k/16bit/单声道 PCM 转发给腾讯云实时识别（16k_zh）
 * - 或回落到本地 large-v3
 * - 自己按 RMS + 静音窗口断句，发出 partial / final
 *
 * 密钥只在桥那一侧，渲染进程拿不到。
 */

export interface StreamASRHandlers {
  onReady?: (mode: string) => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  /** unexpected=true 表示不是用户主动停止，调用方可以回退分片识别 */
  onClose?: (unexpected: boolean) => void;
}

export interface StreamASRConfig {
  url: string;
  lang: '中文' | '英文';
  /** 桥的静音断句窗口，毫秒；建议 600~1000，越短出字越快但更容易在句中停顿处断开 */
  silenceMs?: number;
  handlers: StreamASRHandlers;
}

interface BridgeMessage {
  type?: string;
  mode?: string;
  text?: string;
  message?: string;
}

export class StreamASRClient {
  private ws: WebSocket | null = null;
  private config: StreamASRConfig;
  private ready = false;
  private userStopped = false;
  /** destroy 之后不再回调任何 handler，避免旧连接的 final 串进新会话 */
  private disposed = false;
  private mode = '';
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: StreamASRConfig) {
    this.config = config;
  }

  get connected() {
    return this.ready;
  }

  get activeMode() {
    return this.mode;
  }

  get closed() {
    return this.disposed;
  }

  /** 连接并等到桥返回 ready；超时/失败直接 reject，让调用方决定是否回退分片 */
  connect(timeoutMs = 1800): Promise<string> {
    const { url, lang, silenceMs, handlers } = this.config;
    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let ws: WebSocket | null = null;

      const cleanupTimer = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        cleanupTimer();
        this.ready = false;
        this.disposed = true;
        if (ws) {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        }
        if (this.ws === ws) this.ws = null;
        reject(new Error(message));
      };

      try {
        ws = new WebSocket(url);
      } catch (e: any) {
        fail(`实时转写地址无效：${e?.message ?? url}`);
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      timer = setTimeout(() => fail('实时转写连接超时（8761 没启动？）'), timeoutMs);

      ws.onopen = () => {
        try {
          ws!.send(
            JSON.stringify({
              type: 'start',
              lang: lang === '英文' ? 'en' : 'zh',
              sample_rate: 16000,
              silence_ms: silenceMs ?? 700,
            })
          );
        } catch {
          fail('实时转写启动失败');
        }
      };

      ws.onmessage = (ev) => {
        if (this.disposed || typeof ev.data !== 'string') return;
        let msg: BridgeMessage;
        try {
          msg = JSON.parse(ev.data) as BridgeMessage;
        } catch {
          return;
        }

        if (msg.type === 'ready') {
          this.ready = true;
          this.mode = msg.mode ?? 'stream';
          if (!settled) {
            settled = true;
            cleanupTimer();
            handlers.onReady?.(this.mode);
            resolve(this.mode);
          }
          return;
        }

        if (msg.type === 'partial') {
          if (msg.text) handlers.onPartial?.(msg.text);
          return;
        }

        if (msg.type === 'final') {
          if (msg.text) handlers.onFinal?.(msg.text);
          return;
        }

        if (msg.type === 'error') {
          const text = msg.message || '实时转写上游报错';
          if (!settled) fail(text);
          else handlers.onError?.(text);
        }
      };

      ws.onerror = () => {
        if (!settled) fail('连不上实时转写桥（ws://127.0.0.1:8761）');
        else if (!this.disposed) handlers.onError?.('实时转写连接异常');
      };

      ws.onclose = () => {
        cleanupTimer();
        this.ready = false;
        if (this.ws === ws) this.ws = null;
        if (!settled) {
          fail('实时转写桥已断开');
          return;
        }
        if (this.disposed) return;
        this.disposed = true;
        handlers.onClose?.(!this.userStopped);
      };
    });
  }

  /** 发送一帧 16k / 16bit / 单声道 PCM */
  sendPcm(pcm: Int16Array) {
    const ws = this.ws;
    if (this.disposed || !ws || ws.readyState !== WebSocket.OPEN || !this.ready) return;
    // 网络跟不上时宁可丢帧，也不要让缓冲区无限涨
    if (ws.bufferedAmount > 512 * 1024) return;
    const buf = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
    try {
      ws.send(buf);
    } catch {
      /* 下一帧再试 */
    }
  }

  /** 让桥先把最后一句 final 发出来，再断开 */
  stop(graceMs = 260) {
    this.userStopped = true;
    const ws = this.ws;
    if (!ws || this.disposed) return;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }));
    } catch {
      /* ignore */
    }
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }, graceMs);
  }

  /** 立即断开并静音回调；用户停止或会话切换时必须用它 */
  destroy() {
    this.userStopped = true;
    this.disposed = true;
    this.ready = false;
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }
}
