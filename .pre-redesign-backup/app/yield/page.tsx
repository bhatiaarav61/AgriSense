'use client';

// Yield estimator. Deterministic agronomic heuristic (lib/yield.ts) computed
// server-side, optionally interpreted by a free AI narrative.
import { useMemo, useState } from 'react';
import { Sprout, Loader2, TrendingUp, AlertTriangle, CheckCircle2, CloudSun } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import { getCrops } from '@/lib/regions';
import { useSettings } from '@/lib/store';
import type { YieldEstimate, Irrigation, YieldWeather } from '@/lib/yield';

export default function YieldPage() {
  const { regionId, apiKey, provider } = useSettings();
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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Yield estimator</h1>
        <p className="text-sm text-muted">A transparent agronomic estimate with a confidence band — free, works offline.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="card space-y-4 p-5">
          <label className="block">
            <span className="label">Crop</span>
            <select className="input" value={cropId} onChange={(e) => setCropId(e.target.value)}>
              <option value="">Select a crop…</option>
              {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Area (hectares)</span>
              <input className="input" type="number" min={0.1} step={0.1} value={area} onChange={(e) => setArea(Math.max(0, +e.target.value))} />
            </label>
            <label className="block">
              <span className="label">Planting date</span>
              <input className="input" type="date" value={planting} onChange={(e) => setPlanting(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">Irrigation</span>
            <select className="input" value={irrigation} onChange={(e) => setIrrigation(e.target.value as Irrigation)}>
              <option value="drip">Drip</option>
              <option value="irrigated">Irrigated</option>
              <option value="rainfed">Rainfed</option>
              <option value="unknown">Not sure</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-ghost" onClick={addWeather}><CloudSun className="h-4 w-4" /> Add live weather</button>
            {wxNote && <span className="text-xs text-muted">{wxNote}</span>}
          </div>
          <button className="btn-brand w-full" type="submit" disabled={loading || area <= 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />} Estimate yield
          </button>
        </form>

        <div className="space-y-4">
          {estimate ? (
            <>
              <div className="card space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted capitalize">{estimate.crop} · {estimate.areaHa} ha</p>
                    <p className="text-3xl font-bold">{estimate.totalExpectedT} t</p>
                    <p className="text-sm text-muted">expected total ({estimate.totalLowT}–{estimate.totalHighT} t)</p>
                  </div>
                  <div className="text-right">
                    <p className="flex items-center gap-1 text-brand"><TrendingUp className="h-4 w-4" /> {estimate.expectedTPerHa} t/ha</p>
                    <p className="text-xs text-muted">{Math.round(estimate.confidence * 100)}% confidence</p>
                  </div>
                </div>
                {estimate.risks.length > 0 && (
                  <div>
                    <p className="label flex items-center gap-1 text-warn"><AlertTriangle className="h-4 w-4" /> Risks</p>
                    <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">{estimate.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="label flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-brand" /> Recommendations</p>
                  <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">{estimate.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer">Assumptions</summary>
                  <ul className="ml-5 mt-1 list-disc space-y-0.5">{estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </details>
              </div>
              {narrative && <div className="card p-4"><Markdown>{narrative}</Markdown></div>}
            </>
          ) : (
            <div className="card grid min-h-[200px] place-items-center p-6 text-center text-sm text-muted">Fill the form to see an estimate.</div>
          )}
        </div>
      </div>
    </div>
  );
}
