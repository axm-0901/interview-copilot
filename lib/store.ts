'use client';

import { create } from 'zustand';
import * as db from './db';
import type { AppSettings, Chunk, Doc, Profile, QAEntry, Session, SkillCard } from './types';
import { DEFAULT_SETTINGS } from './types';

const LS_KEY = 'copilot.settings.v1';

/**
 * 档案切换代次。每次 setActive / boot 提交 activeId 时自增；
 * 异步读取结果只有在代次与 activeId 都未变化时才允许提交。
 */
let activeEpoch = 0;

function readSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

interface AppState {
  ready: boolean;
  settings: AppSettings;
  profiles: Profile[];
  activeId: string | null;
  docs: Doc[];
  chunks: Chunk[];
  cards: SkillCard[];
  qas: QAEntry[];
  sessions: Session[];

  boot: () => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => void;
  setActive: (id: string) => Promise<void>;
  createProfile: (input: Pick<Profile, 'name' | 'targetRole' | 'company' | 'round' | 'lang'>) => Promise<Profile>;
  refreshActive: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  profiles: [],
  activeId: null,
  docs: [],
  chunks: [],
  cards: [],
  qas: [],
  sessions: [],

  async boot() {
    const settings = readSettings();
    set({ settings });
    const profiles = await db.listProfiles();
    const saved = await db.kvGet<string>('activeProfile').catch(() => undefined);
    const activeId =
      (saved && profiles.some((p) => p.id === saved) ? saved : profiles[0]?.id) ?? null;
    activeEpoch += 1;
    set({ profiles, activeId, ready: true });
    if (activeId) await get().refreshActive();
  },

  saveSettings(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  },

  async setActive(id) {
    activeEpoch += 1;
    const epoch = activeEpoch;
    set({ activeId: id, docs: [], chunks: [], cards: [], qas: [], sessions: [] });
    await db.kvSet('activeProfile', id);
    // 期间又切到了别的档案：交给最新一次 setActive 负责加载，避免旧档案回填。
    if (epoch !== activeEpoch) return;
    await get().refreshActive();
  },

  async createProfile(input) {
    const profile: Profile = {
      id: db.uid('pf'),
      ...input,
      createdAt: Date.now(),
    };
    await db.putProfile(profile);
    const profiles = await db.listProfiles();
    set({ profiles });
    await get().setActive(profile.id);
    return profile;
  },

  async refreshActive() {
    const id = get().activeId;
    const epoch = activeEpoch;
    if (!id) {
      if (epoch === activeEpoch) set({ docs: [], chunks: [], cards: [], qas: [], sessions: [] });
      return;
    }
    const [docs, chunks, cards, qas, sessions] = await Promise.all([
      db.listDocs(id),
      db.listChunks(id),
      db.listCards(id),
      db.listQAs(id),
      db.listSessions(id),
    ]);
    // 读取期间档案已切换 / 已重新加载：丢弃这批属于旧档案的结果。
    if (epoch !== activeEpoch || get().activeId !== id) return;
    set({ docs, chunks, cards, qas, sessions });
  },

  async refreshSessions() {
    const id = get().activeId;
    const epoch = activeEpoch;
    const sessions = id ? await db.listSessions(id) : await db.listSessions();
    if (epoch !== activeEpoch || get().activeId !== id) return;
    set({ sessions });
  },

  async refreshProfiles() {
    const profiles = await db.listProfiles();
    set({ profiles });
  },
}));
