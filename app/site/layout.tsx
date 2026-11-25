import type { Metadata, Viewport } from 'next';
import './site.css';

export const metadata: Metadata = {
  title: '面试副驾 · Copilot — 把你的经历练到能说出口',
  description:
    '面试副驾把你的简历、项目和高频问题整理成能命中、能复用、能复盘的答案。标准问答命中即答，桌面端系统音频实时听题，复盘逐条给到致命伤与改写。',
  keywords: ['AI 面试', '面试副驾', '面试辅助', '标准问答', '面试复盘', '系统音频'],
  openGraph: {
    title: '面试副驾 · Copilot',
    description: '把你的经历提前练到能说出口。命中即答、系统音频听题、逐条复盘，一条闭环。',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '面试副驾 · Copilot',
    description: '把你的经历提前练到能说出口。命中即答、系统音频听题、逐条复盘，一条闭环。',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07080c',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
