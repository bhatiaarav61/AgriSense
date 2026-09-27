'use client';

// Global user settings, persisted to localStorage. Keys entered here never
// leave the browser except as a request header to our own API routes.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiProvider } from './types';

export type ThemeMode = 'light' | 'dark';

interface SettingsState {
  theme: ThemeMode;
  regionId: string;
  language: string;
  provider: AiProvider;
  apiKey: string;
  ttsEnabled: boolean;
  hdVoice: boolean;
  voice: string;
  liveIntervalMs: number;
  activeModelId: string | null;

  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  setRegion: (id: string) => void;
  setLanguage: (l: string) => void;
  setProvider: (p: AiProvider) => void;
  setApiKey: (k: string) => void;
  setTts: (v: boolean) => void;
  setHdVoice: (v: boolean) => void;
  setVoice: (v: string) => void;
  setLiveInterval: (ms: number) => void;
  setActiveModel: (id: string | null) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      regionId: 'india',
      language: 'en',
      provider: 'gemini',
      apiKey: '',
      ttsEnabled: true,
      hdVoice: true,
      voice: 'nova',
      liveIntervalMs: 1500,
      activeModelId: null,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setRegion: (regionId) => set({ regionId }),
      setLanguage: (language) => set({ language }),
      setProvider: (provider) => set({ provider }),
      setApiKey: (apiKey) => set({ apiKey }),
      setTts: (ttsEnabled) => set({ ttsEnabled }),
      setHdVoice: (hdVoice) => set({ hdVoice }),
      setVoice: (voice) => set({ voice }),
      setLiveInterval: (liveIntervalMs) => set({ liveIntervalMs }),
      setActiveModel: (activeModelId) => set({ activeModelId }),
    }),
    { name: 'agrisense-settings' },
  ),
);

/** True once the persisted store has hydrated on the client (guards SSR mismatch). */
export function hasHydrated(): boolean {
  return useSettings.persist.hasHydrated();
}
