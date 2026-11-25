import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function clamp(s: string, n: number) {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1) + '…';
}

export function fmtTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const same =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (same) return `今天 ${fmtTime(ts)}`;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${fmtTime(ts)}`;
}

export function fmtDuration(start: number, end?: number) {
  const ms = (end ?? Date.now()) - start;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  }
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function scoreColor(score: number) {
  if (score >= 4) return 'text-ok';
  if (score >= 3) return 'text-warn';
  return 'text-danger';
}

export function scoreBg(score: number) {
  if (score >= 4) return 'bg-ok/12 border-ok/30 text-ok';
  if (score >= 3) return 'bg-warn/12 border-warn/30 text-warn';
  return 'bg-danger/12 border-danger/30 text-danger';
}

export function countChars(s: string) {
  return (s ?? '').replace(/\s+/g, '').length;
}
