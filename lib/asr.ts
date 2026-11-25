export interface ASRHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onState: (listening: boolean) => void;
}

export interface ASRProvider {
  start: () => void;
  stop: () => void;
  listening: () => boolean;
  destroy: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

const ERR_TEXT: Record<string, string> = {
  'not-allowed': '麦克风权限被拒绝，请在浏览器地址栏允许后重试；也可以改用下方手动输入。',
  'service-not-allowed': '浏览器不允许语音服务，请改用手动输入。',
  'audio-capture': '没有检测到麦克风设备。',
  network: '语音识别需要联网，当前网络不可用。',
  'language-not-supported': '当前浏览器不支持该语言。',
};

/**
 * Web Speech API 实现。接口抽象成 ASRProvider，
 * 后续接云端流式 ASR（阿里云 / 腾讯云 / 讯飞）只需另写一个实现。
 */
export function createWebSpeechASR(lang: '中文' | '英文', handlers: ASRHandlers): ASRProvider | null {
  if (!speechSupported()) return null;
  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;

  let rec: any = null;
  let want = false;

  const build = () => {
    const r = new SR();
    r.lang = lang === '英文' ? 'en-US' : 'zh-CN';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => handlers.onState(true);

    r.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript ?? '';
        if (res.isFinal) {
          const t = txt.trim();
          if (t) handlers.onFinal(t);
        } else {
          interim += txt;
        }
      }
      handlers.onPartial(interim.trim());
    };

    r.onerror = (e: any) => {
      const code = e?.error ?? 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed') want = false;
      handlers.onError(ERR_TEXT[code] ?? `语音识别出错（${code}）`);
    };

    r.onend = () => {
      if (want) {
        try {
          r.start();
        } catch {
          /* 已在运行 */
        }
      } else {
        handlers.onState(false);
      }
    };
    return r;
  };

  return {
    start() {
      if (want) return;
      want = true;
      rec = build();
      try {
        rec.start();
      } catch {
        /* ignore */
      }
    },
    stop() {
      want = false;
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
      handlers.onState(false);
    },
    listening: () => want,
    destroy() {
      want = false;
      try {
        rec?.abort?.();
      } catch {
        /* ignore */
      }
      rec = null;
    },
  };
}

export function speak(text: string, lang: '中文' | '英文', onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*#>`]/g, ''));
  u.lang = lang === '英文' ? 'en-US' : 'zh-CN';
  u.rate = 1.02;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export function stopSpeak() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}
