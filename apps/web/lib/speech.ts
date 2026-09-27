'use client';

// Voice output in two tiers:
//   1. HD neural voice (default) — keyless Pollinations "openai-audio" model,
//      free with no API key. Audio is cached per (text, voice) in memory.
//   2. Browser Web Speech API fallback — used when HD is disabled, unavailable,
//      slow, or the network fails, so speech always works.
// Voice input stays on the Web Speech API (SpeechRecognition) with graceful
// degradation when the browser lacks it.

import { useSettings } from './store';

export function speechCapabilities() {
  if (typeof window === 'undefined') return { recognition: false, synthesis: false };
  const rec = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const syn = 'speechSynthesis' in window;
  return { recognition: rec, synthesis: syn };
}

export interface RecognitionHandle {
  start: () => void;
  stop: () => void;
}

export function createRecognition(
  lang: string,
  handlers: { onResult: (text: string, isFinal: boolean) => void; onEnd?: () => void; onError?: (msg: string) => void },
): RecognitionHandle | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = toBcp47(lang);
  rec.continuous = false;
  rec.interimResults = true;

  rec.onresult = (event: any) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    if (final) handlers.onResult(final, true);
    else if (interim) handlers.onResult(interim, false);
  };
  rec.onerror = (e: any) => handlers.onError?.(e?.error || 'speech-error');
  rec.onend = () => handlers.onEnd?.();

  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

const HD_VOICES = ['alloy', 'nova', 'shimmer'] as const;
const HD_MAX_CHARS = 600;
const HD_TIMEOUT_MS = 12_000;

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

/** Strip markdown so any voice reads clean prose. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_`#>]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Play text through the keyless HD neural voice; returns false if it fails. */
async function speakHd(clean: string, voiceIndex: number): Promise<boolean> {
  if (clean.length > HD_MAX_CHARS) return false;
  const voice = HD_VOICES[voiceIndex % HD_VOICES.length];
  const key = `${voice}:${clean}`;
  try {
    let url = audioCache.get(key);
    if (!url) {
      const endpoint = `https://text.pollinations.ai/${encodeURIComponent(clean)}?model=openai-audio&voice=${voice}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(HD_TIMEOUT_MS) });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob.type.startsWith('audio')) return false;
      url = URL.createObjectURL(blob);
      audioCache.set(key, url);
    }
    const audio = new Audio(url);
    audio.volume = 1;
    currentAudio = audio;
    try {
      await audio.play();
      return true;
    } catch (e) {
      if (currentAudio === audio) currentAudio = null;
      throw e;
    }
  } catch {
    return false;
  }
}

export function speak(text: string, lang: string) {
  if (typeof window === 'undefined') return;
  cancelSpeech();
  const clean = cleanForSpeech(text);
  if (!clean) return;

  const hd = useSettings.getState().hdVoice !== false;
  if (hd) {
    speakHd(clean, 0).then((ok) => {
      if (!ok && currentAudio === null) speakBrowser(clean, lang);
    });
  } else {
    speakBrowser(clean, lang);
  }
}

function speakBrowser(clean: string, lang: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = toBcp47(lang);
  const match = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()));
  if (match) u.voice = match;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
  }
}

function toBcp47(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    bn: 'bn-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    pa: 'pa-IN',
    ur: 'ur-PK',
    sd: 'sd-PK',
    pt: 'pt-BR',
    sw: 'sw-KE',
    am: 'am-ET',
    om: 'om-ET',
    tw: 'ak-GH',
    ee: 'ee-GH',
    ha: 'ha-NG',
    yo: 'yo-NG',
    ig: 'ig-NG',
    fil: 'fil-PH',
    tl: 'tl-PH',
    ceb: 'ceb-PH',
    es: 'es-ES',
    id: 'id-ID',
    vi: 'vi-VN',
    ne: 'ne-NP',
    si: 'si-LK',
  };
  return map[lang] || lang;
}
