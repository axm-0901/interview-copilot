import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '面试练习 · 手机版',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '面试练习',
  },
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
