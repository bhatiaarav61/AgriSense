'use client';

// Settings: region, language, AI provider + key (BYO), theme, voice, live-scan
// interval, and data controls. Keys are stored only in this browser.
import { useEffect, useState } from 'react';
import { KeyRound, Trash2, Info, Check, Globe, SlidersHorizontal } from 'lucide-react';
import { getRegions } from '@/lib/regions';
import { ALL_LANGUAGES, useT } from '@/lib/i18n';
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
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [cleared, setCleared] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="card h-96 skeleton" />;

  const activeProvider = KEYED_PROVIDERS.includes(s.provider as never) ? s.provider : 'gemini';

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <header className="flex items-center gap-3">
        <span className="icon-tile"><SlidersHorizontal className="h-5 w-5" /></span>
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('settings_title')}</h1>
          <p className="text-sm text-muted">{t('settings_sub')}</p>
        </div>
      </header>

      <section className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-display font-bold"><Globe className="h-4 w-4 text-brand" /> {t('region')} &amp; {t('language')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t('region')}</span>
            <select className="input" value={s.regionId} onChange={(e) => s.setRegion(e.target.value)}>
              {getRegions().map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">{t('language')}</span>
            <select className="input" value={s.language} onChange={(e) => s.setLanguage(e.target.value)}>
              {ALL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nativeName} ({l.name})</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">UI text, AI answers and voice all follow this language.</span>
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="flex items-center gap-2 font-display font-bold"><KeyRound className="h-4 w-4 text-brand" /> AI provider</h2>
        <div className="flex items-start gap-2 rounded-xl border border-brand/20 bg-brand/5 p-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p>
            AI works <strong className="text-fg">free with no key</strong> (via Pollinations) and an offline fallback.
            Add your own free key below for higher accuracy and rate limits.
          </p>
        </div>
        <label className="block">
          <span className="label">Provider (when using your own key)</span>
          <select className="input" value={activeProvider} onChange={(e) => s.setProvider(e.target.value as never)}>
            {KEYED_PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_HELP[p].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">API key {s.apiKey ? '(saved)' : '(optional)'}</span>
          <input className="input" type="password" placeholder="Paste your key — leave blank to use the free keyless AI" value={s.apiKey} onChange={(e) => s.setApiKey(e.target.value.trim())} autoComplete="off" />
          <a className="mt-1 inline-block text-xs font-medium text-brand hover:underline" href={PROVIDER_HELP[activeProvider].url} target="_blank" rel="noreferrer">
            Get a free {activeProvider} key →
          </a>
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display font-bold">Interface &amp; voice</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <div className="segment">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} className={`segment-item px-3 py-1.5 capitalize ${s.theme === t ? 'segment-item-active' : ''}`} onClick={() => s.setTheme(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Read answers aloud (TTS)</span>
          <button className={`btn h-8 px-3 ${s.ttsEnabled ? 'btn-soft' : 'btn-ghost'}`} onClick={() => s.setTts(!s.ttsEnabled)}>{s.ttsEnabled ? 'On' : 'Off'}</button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm">HD AI voice</span>
            <p className="text-xs text-muted">Clearer neural speech via the free keyless service. Falls back to the browser voice offline.</p>
          </div>
          <button className={`btn h-8 px-3 ${s.hdVoice !== false ? 'btn-soft' : 'btn-ghost'}`} onClick={() => s.setHdVoice(!(s.hdVoice !== false))}>{s.hdVoice !== false ? 'On' : 'Off'}</button>
        </div>
        <label className="block">
          <span className="label">Live scan interval: {s.liveIntervalMs} ms</span>
          <input type="range" min={800} max={4000} step={100} value={s.liveIntervalMs} onChange={(e) => s.setLiveInterval(+e.target.value)} className="w-full accent-[rgb(var(--brand))]" />
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display font-bold">Data</h2>
        <button className="btn-ghost text-danger" onClick={async () => { await clearHistory(); setCleared(true); setTimeout(() => setCleared(false), 2000); }}>
          {cleared ? <><Check className="h-4 w-4" /> Cleared</> : <><Trash2 className="h-4 w-4" /> Clear scan history</>}
        </button>
      </section>
    </div>
  );
}
