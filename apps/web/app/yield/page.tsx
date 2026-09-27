'use client';

// Yield estimator. Deterministic agronomic heuristic (lib/yield.ts) computed
// server-side, optionally interpreted by a free AI narrative.
import { useMemo, useState } from 'react';
import { Sprout, Loader2, TrendingUp, AlertTriangle, CheckCircle2, CloudSun } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { getCrops } from '@/lib/regions';
import { useSettings } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { YieldEstimate, Irrigation, YieldWeather } from '@/lib/yield';

export default function YieldPage() {
  const { regionId, apiKey, provider } = useSettings();
  const t = useT();
  const crops = useMemo(() => getCrops(regionId), [regionId]);
  const [cropId, setCropId] = useState('');
  const [area, setArea] = useState(1);
  const [planting, setPlanting] = useState('');
  const [irrigation, setIrrigation] = useState<Irrigation>('irrigated');
  const [weather, setWeather] = useState<YieldWeather | null>(null);
  const [wxNote, setWxNote] = useState('');
  const [estimate, setEstimate] = useState<YieldEstimate | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addWeather() {
    if (!navigator.geolocation) return setWxNote('Geolocation unavailable.');
    setWxNote('Fetching live weather…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
        const j = await res.json();
        const days = j.daily ?? [];
        const rainSum7d = days.reduce((s: number, d: { rain?: number }) => s + (d.rain || 0), 0);
        const tempMax = Math.max(...days.map((d: { tMax?: number }) => d.tMax ?? -99));
        const tempAvg = days.reduce((s: number, d: { tMax?: number; tMin?: number }) => s + ((d.tMax ?? 0) + (d.tMin ?? 0)) / 2, 0) / (days.length || 1);
        setWeather({ rainSum7d, tempMax, tempAvg, humidity: j.current?.humidity });
        setWxNote(`Live weather added: ~${Math.round(rainSum7d)}mm rain / 7d, max ${Math.round(tempMax)}°C.`);
      } catch {
        setWxNote('Could not fetch weather.');
      }
    }, () => setWxNote('Location denied.'), { timeout: 10_000 });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNarrative(null);
    try {
      const res = await fetch('/api/yield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey, 'x-provider': provider } : {}) },
        body: JSON.stringify({ regionId, cropId: cropId || undefined, cropName: crops.find((c) => c.id === cropId)?.name, areaHa: area, plantingDate: planting || undefined, irrigation, weather: weather || undefined }),
      });
      const j = await res.json();
      setEstimate(j.estimate);
      setNarrative(j.narrative);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('yield_title')}</h1>
        <p className="text-sm text-muted">{t('yield_sub')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block">
            <span className="label">{t('y_crop')}</span>
            <select className="input" value={cropId} onChange={(e) => setCropId(e.target.value)}>
              <option value="">Select a crop…</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">{t('y_area')}</span>
              <input className="input" type="number" min={0.1} step={0.1} value={area} onChange={(e) => setArea(Math.max(0, +e.target.value))} />
            </label>
            <label className="block">
              <span className="label">{t('y_planting')}</span>
              <input className="input" type="date" value={planting} onChange={(e) => setPlanting(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t('y_irrigation')}</span>
            <select className="input" value={irrigation} onChange={(e) => setIrrigation(e.target.value as Irrigation)}>
              <option value="drip">Drip</option>
              <option value="irrigated">Irrigated</option>
              <option value="rainfed">Rainfed</option>
              <option value="unknown">Not sure</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost" onClick={addWeather}><CloudSun className="h-4 w-4" /> {t('y_add_wx')}</button>
            {wxNote && <span className="text-xs text-muted">{wxNote}</span>}
          </div>
          <button className="btn-brand w-full" type="submit" disabled={loading || area <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />} {t('y_estimate')}
          </button>
        </form>

        <div className="space-y-4">
          {estimate ? (
            <>
              <div className="card animate-fade-up space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm capitalize text-muted">{estimate.crop} · {estimate.areaHa} ha</p>
                    <p className="font-display text-4xl font-bold leading-tight">{estimate.totalExpectedT} t</p>
                    <p className="text-sm text-muted">{t('y_expected')} ({estimate.totalLowT}–{estimate.totalHighT} t)</p>
                  </div>
                  <span className="chip-brand"><TrendingUp className="h-3.5 w-3.5" /> {estimate.expectedTPerHa} t/ha</span>
                </div>

                <ConfidenceBand estimate={estimate} />

                {estimate.risks.length > 0 && (
                  <div className="rounded-xl border border-warn/30 bg-warn/5 p-3">
                    <p className="label flex items-center gap-1.5 text-warn"><AlertTriangle className="h-4 w-4" /> {t('y_risks')}</p>
                    <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">{estimate.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}
                <div className="rounded-xl border border-brand/25 bg-brand/5 p-3">
                  <p className="label flex items-center gap-1.5 text-brand"><CheckCircle2 className="h-4 w-4" /> {t('y_recs')}</p>
                  <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">{estimate.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer select-none font-medium">Assumptions</summary>
                  <ul className="ml-5 mt-1 list-disc space-y-0.5">{estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </details>
              </div>
              {narrative && <div className="card animate-fade-up p-4"><Markdown>{narrative}</Markdown></div>}
            </>
          ) : (
            <div className="card grid min-h-[220px] place-items-center p-6 text-center text-sm text-muted">
              <div className="flex max-w-[240px] flex-col items-center gap-2">
                <span className="icon-tile opacity-60"><Sprout className="h-5 w-5" /></span>
                <p className="font-medium text-fg">Fill the form to see an estimate</p>
                <p>Add live weather for a sharper, location-aware range.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfidenceBand({ estimate }: { estimate: YieldEstimate }) {
  const span = Math.max(estimate.totalHighT - estimate.totalLowT, 0.0001);
  const pos = Math.min(1, Math.max(0, (estimate.totalExpectedT - estimate.totalLowT) / span));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted">
        <span>{estimate.totalLowT} t</span>
        <span className="font-semibold text-brand">{Math.round(estimate.confidence * 100)}% confidence</span>
        <span>{estimate.totalHighT} t</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-warn/40 via-brand/30 to-brand/60">
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow-glow"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
    </div>
  );
}
