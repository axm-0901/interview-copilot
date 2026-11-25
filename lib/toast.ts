'use client';

import { create } from 'zustand';

export type ToastKind = 'ok' | 'err' | 'info' | 'warn';

export interface ToastItem {
  id: string;
  title: string;
  desc?: string;
  kind: ToastKind;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  items: [],
  push(t) {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ items: [...s.items.slice(-3), { ...t, id }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
    }, t.kind === 'err' ? 5600 : 3200);
  },
  dismiss(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));

export const toast = (title: string, kind: ToastKind = 'info', desc?: string) =>
  useToast.getState().push({ title, kind, desc });
