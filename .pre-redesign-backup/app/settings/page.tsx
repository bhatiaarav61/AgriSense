'use client';

// Settings: region, language, AI provider + key (BYO), theme, voice, live-scan
// interval, and data controls. Keys are stored only in this browser.
import { useEffect, useState } from 'react';
import { KeyRound, Trash2, Info, Check } from 'lucide-react';
import { getRegions, getLanguages } from '@/lib/regions';
import { KEYED_PROVIDERS } from '@/lib/types';
import { useSettings } from '@/lib/store';
import { clearHistory } from '@/lib/storage';

const PROVIDER_HELP: Record<string, { label: string; url: string }> = {
  gemini: { label: 'Google Gemini (free tier)', url: 'https://aistudio.google.com/app/apikey' },
  groq: { label: 'Groq (free, fast — text chat only)', url: 'https://console.groq.com/keys' },
  openrouter: { label: 'OpenRouter (free models available)', url: 'https://openrouter.ai/keys' },
};

export default function SettingsPage() {
  const s = useSettings();
  const [mounted, setMounted] = useState(false);
  const [cleared, setCleared] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="card h-96 animate-pulse" />;

  const languages = getLanguages(s.regionId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Everything here is saved in your browser only.</p>
      </header>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Region &amp; language</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Region</span>
            <select className="input" value={s.regionId} onChange={(e) => s.setRegion(e.target.value)}>
              {getRegions().map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Language</span>
            <select className="input" value={s.language} onChange={(e) => s.setLanguage(e.target.value)}>
              {languages.map((l) => <option key={l.code} value={l.code}>{l.nativeName || l.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" /> AI provider</h2>
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>AI works <strong className="text-fg">free with no key</strong> (via Pollinations) and an offline fallback. Add your own free key below for higher accuracy and rate limits.</p>
        </div>
        <label className="block">
          <span className="label">Provider (when using your own key)</span>
          <select className="input" value={KEYED_PROVIDERS.includes(s.provider as never) ? s.provider : 'gemini'} onChange={(e) => s.setProvider(e.target.value as never)}>
            {KEYED_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_HELP[p].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">API key {s.apiKey ? '(saved)' : '(optional)'}</span>
          <input className="input" type="password" placeholder="Paste your key — leave blank to use the free keyless AI" value={s.apiKey} onChange={(e) => s.setApiKey(e.target.value.trim())} autoComplete="off" />
          <a className="mt-1 inline-block text-xs text-accent hover:underline" href={PROVIDER_HELP[KEYED_PROVIDERS.includes(s.provider as never) ? s.provider : 'gemini'].url} target="_blank" rel="noreferrer">Get a free {s.provider} key →</a>
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Interface &amp; voice</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <div className="inline-flex rounded-xl border border-border p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} className={`btn h-8 px-3 capitalize ${s.theme === t ? 'bg-brand text-brand-fg' : ''}`} onClick={() => s.setTheme(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Read answers aloud (TTS)</span>
          <button className={`btn h-8 px-3 ${s.ttsEnabled ? 'bg-brand text-brand-fg' : 'btn-ghost'}`} onClick={() => s.setTts(!s.ttsEnabled)}>{s.ttsEnabled ? 'On' : 'Off'}</button>
        </div>
        <label className="block">
          <span className="label">Live scan interval: {s.liveIntervalMs} ms</span>
          <input type="range" min={800} max={4000} step={100} value={s.liveIntervalMs} onChange={(e) => s.setLiveInterval(+e.target.value)} className="w-full accent-brand" />
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Data</h2>
        <button className="btn-ghost text-danger" onClick={async () => { await clearHistory(); setCleared(true); setTimeout(() => setCleared(false), 2000); }}>
          {cleared ? <><Check className="h-4 w-4" /> Cleared</> : <><Trash2 className="h-4 w-4" /> Clear scan history</>}
        </button>
      </section>
    </div>
  );
}
