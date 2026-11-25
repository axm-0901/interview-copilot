'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, MonitorPlay, Send } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { toast } from '@/lib/toast';

export function ScreenshotDialog({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean;
  onClose: () => void;
  onCaptured: (dataUrl: string) => void;
}) {
  const [shot, setShot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) setShot(null);
  }, [open]);

  async function capture() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('当前浏览器不支持屏幕捕获', 'err', '请用 Chrome / Edge，或直接手动描述题目');
      return;
    }
    setCapturing(true);
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 } as any,
        audio: false,
      });
      const video = videoRef.current ?? document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // 等第一帧可用
      if (!video.videoWidth) {
        await new Promise<void>((resolve) => {
          const onLoaded = () => resolve();
          video.addEventListener('loadeddata', onLoaded, { once: true });
          setTimeout(resolve, 1200);
        });
      }
      await new Promise((r) => setTimeout(r, 220));

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('画布不可用');
      ctx.drawImage(video, 0, 0, w, h);
      const url = canvas.toDataURL('image/jpeg', 0.9);
      setShot(url);
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        toast('你取消了共享', 'warn', '需要选择要共享的窗口或屏幕，才能抓取一帧');
      } else {
        toast('截图失败', 'err', String(e?.message ?? e).slice(0, 120));
      }
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setCapturing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="截图解题"
      desc="用 getDisplayMedia 抓取当前屏幕的一帧，只把这一帧发给模型，不录屏。"
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="outline" onClick={() => void capture()} loading={capturing}>
            <Camera size={12} />
            {shot ? '重新抓取' : '抓取屏幕'}
          </Button>
          <Button
            variant="primary"
            disabled={!shot}
            onClick={() => {
              if (shot) {
                onCaptured(shot);
                onClose();
              }
            }}
          >
            <Send size={12} />
            发送解题
          </Button>
        </>
      }
    >
      <video ref={videoRef} className="hidden" playsInline muted />

      {shot ? (
        <div className="overflow-hidden rounded-card border border-ink-line bg-[#0a0e14]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="截图预览" className="max-h-[380px] w-full object-contain" />
        </div>
      ) : (
        <div className="grid place-items-center rounded-card border border-dashed border-ink-line bg-[#0e131a]/50 py-12 text-center">
          <MonitorPlay size={22} className="text-txt-mute" />
          <div className="mt-2 text-[12.5px] text-txt-dim">
            {capturing ? '正在等待你选择共享的窗口…' : '点「抓取屏幕」，选择题目所在的窗口'}
          </div>
          <div className="mt-1 max-w-[360px] text-[10.5px] leading-relaxed text-txt-mute">
            浏览器会要求你授权一次。抓完立刻停止共享，视频流不会保留。
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-txt-mute">
        <ImageIcon size={10} className="mt-[3px] shrink-0" />
        有些浏览器会把共享窗口标签页一起截进来；识别不清的部分模型会明确写「截图此处不清」。
      </div>

      {capturing ? (
        <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#9cc0ff]">
          <Loader2 size={10} className="animate-spin" />
          抓取中…
        </div>
      ) : null}
    </Dialog>
  );
}
