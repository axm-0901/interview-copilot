'use client';

import { useEffect, useState } from 'react';
import {
  Download,
  FolderOpen,
  Info,
  KeyRound,
  Loader2,
  Mic,
  RefreshCw,
  Save,
  Server,
} from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch, Slider } from '@/components/ui/Switch';
import { Segmented } from '@/components/ui/Tabs';
import { useApp } from '@/lib/store';
import {
  STYLE_LABEL,
  type AnswerStyle,
  type AppSettings,
  type DesktopUpdateCheck,
  type DesktopUpdateInfo,
} from '@/lib/types';
import { testToneWav } from '@/lib/audio';
import { StreamASRClient } from '@/lib/asrStream';
import { chatStream } from '@/lib/llm';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ASR_PRESETS: { name: string; patch: Partial<AppSettings> }[] = [
  {
    name: '腾讯云实时 · 8761',
    patch: {
      asrMode: 'stream',
      asrStreamUrl: 'ws://127.0.0.1:8761',
      silenceMs: 900,
    },
  },
  {
    name: '本地低延迟 · 8765',
    patch: {
      asrMode: 'chunk',
      asrBase: 'http://127.0.0.1:8765/v1',
      asrKey: '',
      asrModel: 'whisper-1',
      asrPartialModel: 'tiny',
      asrFinalModel: 'large-v3',
      silenceMs: 600,
    },
  },
  {
    name: '经 8760 转发',
    patch: {
      asrMode: 'chunk',
      asrBase: 'http://127.0.0.1:8760/v1',
      asrKey: '',
      asrModel: 'whisper-1',
      asrPartialModel: '',
      asrFinalModel: '',
    },
  },
];

const PRESETS: { name: string; base: string; model: string }[] = [
  { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '月之暗面', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '本地 Ollama', base: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
  { name: '本机 GLM 5.3 Flash', base: 'http://127.0.0.1:8760/v1', model: 'cn:glm-5.3-flash' },
  { name: '本机 DeepSeek V4 Flash', base: 'http://127.0.0.1:8760/v1', model: 'cn:deepseek-v4-flash' },
  { name: '本机 7863 DeepSeek V4.1', base: 'http://127.0.0.1:7863/v1', model: 'deepseek-v4.1-flash' },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, saveSettings } = useApp();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [testing, setTesting] = useState(false);
  const [testingAsr, setTestingAsr] = useState(false);
  const [testingStream, setTestingStream] = useState(false);
  const [desktopReady, setDesktopReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<DesktopUpdateInfo | null>(null);
  const [updateCheck, setUpdateCheck] = useState<DesktopUpdateCheck | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);

  const asrBase = (draft.asrBase || draft.apiBase).trim().replace(/\/+$/, '');
  const asrUrl =
    draft.asrMode !== 'chunk'
      ? `实时流式 ${draft.asrStreamUrl || '（未填地址）'}`
      : asrBase
      ? asrBase.endsWith('/audio/transcriptions')
        ? asrBase
        : `${asrBase}/audio/transcriptions`
      : '（未填写）';

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    setDesktopReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const api = window.copilotDesktop?.update;
    if (!api) {
      setUpdateInfo(null);
      setUpdateCheck(null);
      return;
    }
    let cancelled = false;
    api
      .info()
      .then((info) => {
        if (!cancelled) {
          setUpdateInfo(info);
          setUpdateCheck(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUpdateInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const patch = (p: Partial<AppSettings>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    saveSettings(draft);
    toast('设置已保存', 'ok', 'Key 只存在这台设备的 localStorage 里');
    onClose();
  };

  const test = async () => {
    if (!draft.apiKey.trim()) {
      toast('先填 API Key', 'warn', '没有 Key 时应用会以演示模式运行');
      return;
    }
    setTesting(true);
    try {
      let out = '';
      let firstAt = 0;
      const t0 = performance.now();
      for await (const d of chatStream({
        settings: draft,
        temperature: 0,
        maxTokens: 16,
        messages: [
          { role: 'system', content: '你只回复 OK 两个字母。' },
          { role: 'user', content: 'ping' },
        ],
      })) {
        if (!firstAt) firstAt = Math.round(performance.now() - t0);
        out += d;
        if (out.length > 40) break;
      }
      toast(
        '连接成功',
        'ok',
        `首字 ${firstAt || '—'}ms · 返回：${out.trim().slice(0, 40) || '（空）'}`
      );
    } catch (e: any) {
      toast('连接失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setTesting(false);
    }
  };

  const testAsr = async () => {
    const key = (draft.asrKey || draft.apiKey).trim();
    if (!key) {
      toast('先填 ASR Key', 'warn', '留空会复用上面的模型 Key');
      return;
    }
    setTestingAsr(true);
    try {
      const t0 = performance.now();
      const local = Boolean(draft.asrPartialModel || draft.asrFinalModel);
      const fd = new FormData();
      fd.append('file', testToneWav());
      fd.append('apiBase', draft.asrBase || draft.apiBase);
      fd.append('apiKey', key);
      fd.append('model', draft.asrFinalModel || draft.asrModel || 'whisper-1');
      fd.append('lang', 'zh');
      if (local) {
        fd.append('local', '1');
        fd.append('beamSize', '1');
        fd.append('vadFilter', 'true');
      }
      const res = await fetch('/api/asr', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      const ms = Math.round(performance.now() - t0);
      if (!res.ok) {
        toast('转写接口不通', 'err', String(data?.error ?? `HTTP ${res.status}`).slice(0, 190));
      } else {
        toast(
          `转写接口通了 · ${ms}ms`,
          'ok',
          `返回：${data?.text || '（空，正常——测试音里没有人声）'}`
        );
      }
    } catch (e: any) {
      toast('测试失败', 'err', String(e?.message ?? e).slice(0, 140));
    } finally {
      setTestingAsr(false);
    }
  };

  const testStream = async () => {
    const url = (draft.asrStreamUrl || '').trim();
    if (!url) {
      toast('先填实时转写地址', 'warn', '默认是 ws://127.0.0.1:8761');
      return;
    }
    setTestingStream(true);
    const t0 = performance.now();
    const client = new StreamASRClient({
      url,
      lang: draft.lang,
      silenceMs: draft.silenceMs,
      handlers: { onError: () => undefined },
    });
    try {
      const mode = await client.connect(1800);
      const label =
        mode === 'tencent' ? '腾讯云实时 16k_zh' : mode === 'local' ? '本地流式 large-v3' : mode;
      toast('实时转写桥已连接', 'ok', `${label} · ${Math.round(performance.now() - t0)}ms`);
    } catch (e: any) {
      toast(
        '实时转写桥连不上',
        'err',
        `${String(e?.message ?? e).slice(0, 120)}。先运行 asr 目录里的 start_stream.bat`
      );
    } finally {
      client.stop(80);
      setTestingStream(false);
    }
  };

  const updateApi = desktopReady ? window.copilotDesktop?.update : undefined;

  const checkUpdate = async () => {
    if (!updateApi) {
      toast('当前不是桌面版', 'warn', '网页版随服务器更新，不需要应用内更新');
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await updateApi.check();
      setUpdateCheck(result);
      if (!result.ok) {
        toast('检查更新失败', 'err', result.error || '请确认更新目录里有 latest.json');
      } else if (result.available) {
        toast(`发现新版本 v${result.latest}`, 'ok', result.notes || '可以安装更新');
      } else {
        toast('已是最新版本', 'ok', `当前 v${result.current}`);
      }
    } catch (e: any) {
      toast('检查更新失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!updateApi || !updateCheck?.available) return;
    setInstallingUpdate(true);
    try {
      const result = await updateApi.install();
      if (!result.ok) {
        toast('启动安装失败', 'err', result.error || '未知错误');
      } else {
        toast(`正在安装 v${result.version}`, 'ok', '应用会退出，安装完成后自动打开新版本');
      }
    } catch (e: any) {
      toast('启动安装失败', 'err', String(e?.message ?? e).slice(0, 160));
    } finally {
      setInstallingUpdate(false);
    }
  };

  const chooseUpdateDir = async () => {
    if (!updateApi) return;
    try {
      const result = await updateApi.chooseDir();
      if (result.canceled) return;
      if (!result.ok) {
        toast('切换更新目录失败', 'err', result.error || '未知错误');
        return;
      }
      const info = await updateApi.info();
      setUpdateInfo(info);
      setUpdateCheck(null);
      toast('更新目录已切换', 'ok', result.dir || info.updateDir);
    } catch (e: any) {
      toast('切换更新目录失败', 'err', String(e?.message ?? e).slice(0, 160));
    }
  };

  const openUpdateDir = async () => {
    if (!updateApi) return;
    try {
      const result = await updateApi.openDir();
      if (!result.ok) toast('打开目录失败', 'err', result.error || '未知错误');
    } catch (e: any) {
      toast('打开目录失败', 'err', String(e?.message ?? e).slice(0, 160));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="设置"
      desc="模型走 OpenAI 兼容协议。Key 只存在本地 localStorage，请求经 /api/chat 由服务端转发，不进浏览器网络面板。"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="outline" onClick={test} loading={testing}>
            <RefreshCw size={12} />
            测试连接
          </Button>
          <Button variant="primary" onClick={save}>
            <Save size={13} />
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="label flex items-center gap-1.5">
            <Server size={11} />
            预设服务商
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const on = draft.apiBase === p.base;
              return (
                <button
                  key={p.name}
                  onClick={() => patch({ apiBase: p.base, model: p.model })}
                  className={cn(
                    'rounded-full border px-2.5 py-[4px] text-[11.5px] transition-colors',
                    on
                      ? 'border-brand/40 bg-brand/12 text-[#9cc0ff]'
                      : 'border-ink-line bg-ink-sub text-txt-mute hover:border-ink-line2 hover:text-txt-dim'
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">API Base URL</label>
            <input
              className="field font-mono text-[12px]"
              value={draft.apiBase}
              onChange={(e) => patch({ apiBase: e.target.value })}
              placeholder="https://api.openai.com/v1"
              spellCheck={false}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label flex items-center gap-1.5">
              <KeyRound size={11} />
              API Key
            </label>
            <input
              className="field font-mono text-[12px]"
              type="password"
              value={draft.apiKey}
              onChange={(e) => patch({ apiKey: e.target.value })}
              placeholder="sk-..."
              spellCheck={false}
              autoComplete="off"
            />
            <div className="mt-1 text-[11px] text-txt-mute">
              留空即进入演示模式：答稿用本地模板拼装，并明确标注「未使用个人材料」。
            </div>
          </div>
          <div>
            <label className="label">Model</label>
            <input
              className="field font-mono text-[12px]"
              value={draft.model}
              onChange={(e) => patch({ model: e.target.value })}
              placeholder="gpt-4o-mini"
              spellCheck={false}
            />
            <div className="mt-1 text-[11px] leading-relaxed text-txt-mute">
              实时面试优先用「本机 GLM 5.3 Flash」这类非推理模型；deepseek-v4.1-flash 默认会先输出思考链，首字 3~10 秒。本版在下面提供「关闭推理链」，打开后实测首字约 1.2 秒。标准问答命中时不经过模型，不受这里影响。
            </div>
          </div>

          <div className="sm:col-span-2 rounded-card border border-ink-line/70 bg-[#0e131a]/50 p-3">
            <Switch
              checked={draft.fastAnswer}
              onChange={(v) => patch({ fastAnswer: v })}
              label="未命中题库时用低延迟模型"
              desc="命中标准问答不走模型；没命中的题用下面这个模型先出稿，关掉推理链后首字约 1.2~1.6 秒，答案控制在 220 字内。"
            />
            {draft.fastAnswer ? (
              <div className="mt-2.5">
                <label className="label">低延迟模型</label>
                <input
                  className="field font-mono text-[12px]"
                  value={draft.fastModel}
                  onChange={(e) => patch({ fastModel: e.target.value })}
                  placeholder="cn:glm-5.3-flash"
                  spellCheck={false}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[
                    { name: 'GLM 5.3 Flash', model: 'cn:glm-5.3-flash' },
                    { name: 'DeepSeek V4.1 Flash', model: 'cn:deepseek-v4.1-flash' },
                  ].map((m) => (
                    <button
                      key={m.model}
                      type="button"
                      onClick={() => patch({ fastModel: m.model })}
                      className={cn(
                        'rounded-full border px-2 py-[2px] text-[10px] transition-colors',
                        draft.fastModel === m.model
                          ? 'border-brand/40 bg-brand/12 text-[#9cc0ff]'
                          : 'border-ink-line bg-ink-sub text-txt-mute hover:border-ink-line2 hover:text-txt-dim'
                      )}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <div className="mt-1 text-[10.5px] leading-relaxed text-txt-mute">
                  留空时按 Base 自动选：本机 8760 → <code className="text-[10px]">cn:glm-5.3-flash</code>，
                  本机 7863 → <code className="text-[10px]">deepseek-v4.1-flash</code>，通义 →{' '}
                  <code className="text-[10px]">qwen-flash</code>，智谱 →{' '}
                  <code className="text-[10px]">glm-4-flash</code>，DeepSeek →{' '}
                  <code className="text-[10px]">deepseek-chat</code>。实测 deepseek-v4.1-flash 关思考后
                  首字约 1.2s，GLM Flash 约 1.6s。
                </div>
              </div>
            ) : null}
            <div className="mt-2.5 border-t border-ink-line/60 pt-2.5">
              <Switch
                checked={draft.noThink}
                onChange={(v) => patch({ noThink: v })}
                label="关闭推理链（DeepSeek 等）"
                desc="给 deepseek-v4.1 / reasoner 这类模型带 reasoning_effort=none。实测首字从 3~10s 降到 1.2s 左右；普通模型会自动忽略。"
              />
            </div>
          </div>

          <div>
            <label className="label">温度 · {draft.temperature.toFixed(1)}</label>
            <Slider
              value={draft.temperature}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) => patch({ temperature: v })}
            />
          </div>
        </div>

        <div className="hairline" />

        <div>
          <div className="label">作答长度</div>
          <Segmented<AnswerStyle>
            value={draft.style}
            onChange={(v) => patch({ style: v })}
            items={[
              { value: 'concise', label: '简洁 150' },
              { value: 'standard', label: '标准 250' },
              { value: 'detailed', label: '详细 400' },
            ]}
          />
          <div className="mt-1.5 text-[11px] text-txt-mute">{STYLE_LABEL[draft.style]}</div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <div className="label mb-0">静默判定窗口</div>
            <span className="font-mono text-[11.5px] text-txt-dim">
              {(draft.silenceMs / 1000).toFixed(1)}s
            </span>
          </div>
          <Slider
            value={draft.silenceMs}
            min={500}
            max={3000}
            step={100}
            onChange={(v) => patch({ silenceMs: v })}
          />
          <div className="mt-1 text-[11px] text-txt-mute">
            收到 final 结果后，窗口内没有新识别就判定问题结束并自动作答。
          </div>
        </div>

        <div className="rounded-card border border-ink-line/70 bg-[#0e131a]/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="label mb-0 flex items-center gap-1.5">
              <Mic size={11} />
              语音识别（ASR）
            </div>
            <Badge
              tone={
                draft.asrStreamUrl.trim() || draft.asrKey.trim() || draft.apiKey.trim()
                  ? 'ok'
                  : 'warn'
              }
            >
              {draft.asrStreamUrl.trim() || draft.asrKey.trim() || draft.apiKey.trim()
                ? '已配置'
                : '未配置'}
            </Badge>
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {ASR_PRESETS.map((p) => {
              const on =
                p.patch.asrMode === 'stream'
                  ? draft.asrMode === 'stream' && draft.asrStreamUrl === p.patch.asrStreamUrl
                  : draft.asrMode !== 'stream' && draft.asrBase === p.patch.asrBase;
              return (
                <button
                  key={p.name}
                  onClick={() => patch(p.patch)}
                  className={cn(
                    'rounded-full border px-2.5 py-[3px] text-[10.5px] transition-colors',
                    on
                      ? 'border-brand/40 bg-brand/12 text-[#9cc0ff]'
                      : 'border-ink-line bg-ink-sub text-txt-mute hover:border-ink-line2 hover:text-txt-dim'
                  )}
                >
                  {p.name}
                </button>
              );
            })}
          </div>

          <div className="mb-2 rounded-[6px] border border-ink-line/60 bg-[#0a0e14] px-2 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10.5px] font-medium text-txt-dim">实时流式（推荐）</span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => void testStream()}
                loading={testingStream}
              >
                <Mic size={10} />
                测试 8761
              </Button>
            </div>
            <div className="mt-1.5">
              <Segmented<'auto' | 'stream' | 'chunk'>
                value={draft.asrMode}
                onChange={(v) => patch({ asrMode: v })}
                size="xs"
                items={[
                  { value: 'auto', label: '自动' },
                  { value: 'stream', label: '强制流式' },
                  { value: 'chunk', label: '只用分片' },
                ]}
              />
            </div>
            <input
              className="field mt-1.5 font-mono text-[12px]"
              value={draft.asrStreamUrl}
              onChange={(e) => patch({ asrStreamUrl: e.target.value })}
              placeholder="ws://127.0.0.1:8761"
              spellCheck={false}
            />
            <div className="mt-1 text-[9.5px] leading-relaxed text-txt-mute">
              8761 是本地 <code className="text-[9px]">stream_bridge.py</code>：腾讯云实时
              16k_zh 边说边出字，断线自动回退下面的分片上传。桥没启动时先运行 asr 目录的{' '}
              <code className="text-[9px]">start_stream.bat</code>。
            </div>
          </div>

          <div className="space-y-2">
            <input
              className="field font-mono text-[12px]"
              value={draft.asrBase}
              onChange={(e) => patch({ asrBase: e.target.value })}
              placeholder="Base URL，留空复用上面的模型地址"
              spellCheck={false}
            />
            <input
              className="field font-mono text-[12px]"
              type="password"
              value={draft.asrKey}
              onChange={(e) => patch({ asrKey: e.target.value })}
              placeholder="ASR Key，留空复用上面的 Key"
              spellCheck={false}
              autoComplete="off"
            />
            <input
              className="field font-mono text-[12px]"
              value={draft.asrModel}
              onChange={(e) => patch({ asrModel: e.target.value })}
              placeholder="whisper-1 / FunAudioLLM/SenseVoiceSmall"
              spellCheck={false}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field font-mono text-[12px]"
                value={draft.asrPartialModel}
                onChange={(e) => patch({ asrPartialModel: e.target.value })}
                placeholder="partial 模型：tiny（可留空）"
                spellCheck={false}
              />
              <input
                className="field font-mono text-[12px]"
                value={draft.asrFinalModel}
                onChange={(e) => patch({ asrFinalModel: e.target.value })}
                placeholder="final 模型：large-v3（可留空）"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="mt-1.5 text-[10.5px] leading-relaxed text-txt-mute">
            推荐顺序：<span className="text-txt-dim">8761 腾讯云实时</span>（首字 0.6~1.5s，带标点）
            → <span className="text-txt-dim">8765 本地 large-v3</span>（更私密，但 final 要 1.4~4s）
            → 云端 OpenAI 兼容分片。分片链路可填 partial <code className="text-[10px]">tiny</code> + final{' '}
            <code className="text-[10px]">large-v3</code>；云端服务不支持这两个字段，留空即可。
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 rounded-[6px] border border-ink-line/60 bg-[#0a0e14] px-2 py-1.5">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-wide text-txt-mute/70">实际请求地址</div>
              <code className="mt-0.5 block truncate font-mono text-[9.5px] text-txt-dim" title={asrUrl}>
                {asrUrl}
              </code>
            </div>
            <Button variant="outline" size="xs" onClick={() => void testAsr()} loading={testingAsr}>
              <Mic size={10} />
              测试
            </Button>
          </div>

          <div className="mt-1.5 text-[10.5px] leading-relaxed text-txt-mute">
            桌面端的「对方声音」靠它把系统音频转成文字。Base 填到 <code className="text-[10px]">/v1</code>{' '}
            为止，不要自己拼接口名。
          </div>
        </div>

        <div>
          <div className="label">拾音方式</div>          <Segmented<'always' | 'ptt'>
            value={draft.micMode}
            onChange={(v) => patch({ micMode: v })}
            items={[
              { value: 'always', label: '常开麦克风' },
              { value: 'ptt', label: '按住空格' },
            ]}
          />
          <div className="mt-1.5 text-[11px] leading-relaxed text-txt-mute">
            {draft.micMode === 'ptt'
              ? '只采纳「按住空格期间 + 松开后 1.2 秒」的识别结果。外放面试时用这个，等于物理上把自己说话和听题分开。'
              : '麦克风一直开着。外放时你自己的声音也会被识别，只能靠念稿检测和 3 秒冷却兜底。'}
          </div>
        </div>

        <div className="hairline" />

        <div className="space-y-3.5">
          <Switch
            checked={draft.autoAnswer}
            onChange={(v) => patch({ autoAnswer: v })}
            label="自动作答"
            desc="关闭后用 Ctrl / ⌘ + Enter 手动作答；开着时，答稿生成后 3 秒内不会再次触发"
          />
          <Switch
            checked={draft.tts}
            onChange={(v) => patch({ tts: v })}
            label="朗读答稿（练习模式）"
            desc="用浏览器 TTS 把答稿念出来，练习时可以听自己的表达节奏"
          />
        </div>

        <div className="hairline" />

        <div className="rounded-card border border-ink-line/70 bg-[#0e131a]/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="label mb-0 flex items-center gap-1.5">
              <Info size={11} />
              关于与更新
            </div>
            <Badge tone={updateInfo?.isPackaged ? 'ok' : 'warn'}>
              {updateInfo
                ? `v${updateInfo.currentVersion}`
                : desktopReady && !updateApi
                ? 'Web'
                : '读取中'}
            </Badge>
          </div>

          {!desktopReady ? (
            <div className="text-[10.5px] text-txt-mute">正在读取桌面端信息…</div>
          ) : !updateApi ? (
            <div className="text-[10.5px] leading-relaxed text-txt-mute">
              当前是网页版，随服务器部署更新；桌面安装版才支持应用内更新。
            </div>
          ) : (
            <>
              <div className="text-[10.5px] leading-relaxed text-txt-mute">
                当前版本{' '}
                <span className="font-mono text-txt-dim">v{updateInfo?.currentVersion ?? '—'}</span>
                {updateInfo && !updateInfo.isPackaged ? ' · 开发模式' : ''}
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                更新源
                <code
                  className="ml-1 break-all font-mono text-[9.5px] text-txt-dim"
                  title={updateInfo?.updateDir}
                >
                  {updateInfo?.updateDir || '—'}
                </code>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => void checkUpdate()}
                  loading={checkingUpdate}
                >
                  <RefreshCw size={10} />
                  检查更新
                </Button>
                <Button variant="ghost" size="xs" onClick={() => void chooseUpdateDir()}>
                  <FolderOpen size={10} />
                  更改目录
                </Button>
                <Button variant="ghost" size="xs" onClick={() => void openUpdateDir()}>
                  打开目录
                </Button>
              </div>
              {updateCheck ? (
                !updateCheck.ok ? (
                  <div className="mt-2 rounded-[6px] border border-danger/30 bg-danger/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-danger">
                    {updateCheck.error || '检查更新失败'}
                  </div>
                ) : updateCheck.available ? (
                  <div className="mt-2 rounded-[6px] border border-brand/30 bg-brand/10 px-2 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-[#9cc0ff]">
                        发现新版本 v{updateCheck.latest}
                      </span>
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => void installUpdate()}
                        loading={installingUpdate}
                      >
                        <Download size={10} />
                        安装并重启
                      </Button>
                    </div>
                    {updateCheck.notes ? (
                      <div className="mt-1 text-[10px] leading-relaxed text-txt-mute">
                        {updateCheck.notes}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-[10.5px] text-txt-mute">
                    已是最新版本（v{updateCheck.current}）
                  </div>
                )
              ) : updateInfo && !updateInfo.hasManifest ? (
                <div className="mt-2 text-[10px] leading-relaxed text-txt-mute">
                  {updateInfo.error ? (
                    updateInfo.error
                  ) : (
                    <>
                      更新目录里还没有 latest.json。先在项目里运行
                      <code className="mx-1 font-mono text-[9.5px] text-txt-dim">
                        npm run release:local
                      </code>
                      ，再点“检查更新”。
                    </>
                  )}
                </div>
              ) : null}
              {updateInfo && !updateInfo.isPackaged ? (
                <div className="mt-2 text-[10px] leading-relaxed text-warn">
                  开发模式只验证流程；正式使用请安装一个带更新功能的新版本，之后更新按钮才会替换已安装版本。
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
