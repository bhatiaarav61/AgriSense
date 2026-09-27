'use client';

// Voice output in two tiers:
//   1. HD neural voice (default) — keyless Pollinations "openai-audio" model,
//      free with no API key. Long answers are split into sentence-sized chunks
//      and played back-to-back so treatments and action plans get the natural
//      voice too (not just short lines). Each chunk is cached in memory.
//   2. Browser Web Speech API fallback — used when HD is disabled, unavailable,
//      or the network fails, so speech always works.
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

export const HD_VOICES = ['nova', 'shimmer', 'coral', 'alloy', 'echo', 'onyx'] as const;
const HD_CHUNK_CHARS = 420;
const HD_TIMEOUT_MS = 15_000;

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let playbackToken = 0;

/** Clean prose so any voice sounds natural: no markdown, emojis, URLs, pipes. */
function cleanForSpeech(text: string): string {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>|]/g, ' ')
    // Emoji & symbol blocks get read aloud as "smiling face" etc. — drop them.
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
    .replace(/\s*---\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split into sentence-ish chunks small enough for the audio model. */
function chunkText(clean: string): string[] {
  const sentences = clean.split(/(?<=[.!?।؛。！？])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (!s.trim()) continue;
    // A single over-long sentence is hard-split at word boundaries.
    if (s.length > HD_CHUNK_CHARS) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      const words = s.split(' ');
      let part = '';
      for (const w of words) {
        if ((part + ' ' + w).trim().length > HD_CHUNK_CHARS) {
          chunks.push(part.trim());
          part = w;
        } else {
          part = (part + ' ' + w).trim();
        }
      }
      if (part.trim()) current = part;
      continue;
    }
    if ((current + ' ' + s).trim().length > HD_CHUNK_CHARS) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

async function fetchHdUrl(clean: string, voice: string): Promise<string | null> {
  const key = `${voice}:${clean}`;
  try {
    let url = audioCache.get(key);
    if (!url) {
      const endpoint = `https://text.pollinations.ai/${encodeURIComponent(clean)}?model=openai-audio&voice=${voice}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(HD_TIMEOUT_MS) });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('audio')) return null;
      url = URL.createObjectURL(blob);
      audioCache.set(key, url);
    }
    return url;
  } catch {
    return null;
  }
}

/** Play text through the keyless HD neural voice in chunks; false if it fails. */
async function speakHd(clean: string, voice: string): Promise<boolean> {
  const chunks = chunkText(clean);
  if (!chunks.length) return false;
  const token = ++playbackToken;
  for (const chunk of chunks) {
    if (token !== playbackToken) return true; // superseded by a newer speak()
    const url = await fetchHdUrl(chunk, voice);
    if (!url) return false;
    if (token !== playbackToken) return true;
    const audio = new Audio(url);
    audio.volume = 1;
    currentAudio = audio;
    try {
      await audio.play();
    } catch {
      if (token === playbackToken) return false; // real failure → browser fallback
      return true; // superseded mid-play by a newer request
    }
    // Wait for this chunk to finish before starting the next one.
    await new Promise<void>((resolve) => {
      const done = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', done);
        resolve();
      };
      audio.addEventListener('ended', done);
      audio.addEventListener('error', done);
    });
  }
  return true;
}

export function speak(text: string, lang: string) {
  if (typeof window === 'undefined') return;
  cancelSpeech();
  const clean = cleanForSpeech(text);
  if (!clean) return;

  const settings = useSettings.getState();
  const hd = settings.hdVoice !== false;
  const voice = settings.voice || 'nova';
  if (hd) {
    speakHd(clean, voice).then((ok) => {
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
  playbackToken++; // stop any queued HD chunks
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
    fr: 'fr-FR',
    de: 'de-DE',
    id: 'id-ID',
    vi: 'vi-VN',
    ne: 'ne-NP',
    si: 'si-LK',
  };
  return map[lang] || lang;
}
