'use client';

// Live weather + 7-day agri forecast via Open-Meteo (free, no API key).
import { useEffect, useState } from 'react';
import {
  Search,
  MapPin,
  Loader2,
  Droplets,
  Wind,
  CloudRain,
  Thermometer,
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudSnow,
  CloudLightning,
  type LucideIcon,
} from 'lucide-react';
import { ForecastChart, type ForecastDay } from '@/components/charts/ForecastChart';
import { useT } from '@/lib/i18n';

interface Current { temp: number; feelsLike: number; humidity: number; precipitation: number; code: number; wind: number }
interface Forecast { location: { latitude: number; longitude: number; timezone?: string }; current: Current; daily: (ForecastDay & { wind: number; humidity: number; code: number })[] }
interface Place { name: string; admin1?: string; country?: string; latitude: number; longitude: number }

const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Storm w/ hail', 99: 'Severe storm',
};
const label = (c: number) => WMO[c] ?? '—';

const WMO_ICON: [number[], LucideIcon][] = [
  [[0], Sun],
  [[1, 2], CloudSun],
  [[3], Cloud],
  [[45, 48], CloudFog],
  [[51, 53, 55, 80, 81, 82], CloudDrizzle],
  [[61, 63, 65], CloudRain],
  [[71, 73, 75], CloudSnow],
  [[95, 96, 99], CloudLightning],
];
function weatherIcon(code: number): LucideIcon {
  for (const [codes, icon] of WMO_ICON) if (codes.includes(code)) return icon;
  return Cloud;
}

export default function WeatherPage() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [place, setPlace] = useState<string>('');
  const [data, setData] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadForecast(lat: number, lon: number, name: string) {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setData(json);
      setPlace(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Weather lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults(json.results ?? []);
      if (!json.results?.length) setError('No places found.');
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) return setError('Geolocation not available.');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => loadForecast(pos.coords.latitude, pos.coords.longitude, 'My location'),
      () => {
        setLoading(false);
        setError('Location permission denied — search for a place instead.');
      },
      { timeout: 10_000 },
    );
  }

  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const CurrentIcon = data ? weatherIcon(data.current.code) : CloudSun;

  return (
    <div className="animate-fade-up space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('weather_title')}</h1>
        <p className="text-sm text-muted">{t('weather_sub')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <form onSubmit={search} className="flex flex-1 gap-2">
          <input className="input" placeholder={`${t('search')}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-brand shrink-0" type="submit" disabled={loading}><Search className="h-4 w-4" /> {t('search')}</button>
        </form>
        <button className="btn-ghost" onClick={locate} disabled={loading}><MapPin className="h-4 w-4" /> {t('my_location')}</button>
      </div>

      {results.length > 0 && (
        <div className="card animate-fade-in divide-y divide-border overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              onClick={() => loadForecast(r.latitude, r.longitude, [r.name, r.admin1, r.country].filter(Boolean).join(', '))}
            >
              <MapPin className="h-4 w-4 text-brand" /> {[r.name, r.admin1, r.country].filter(Boolean).join(', ')}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading weather…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <div className="animate-fade-up space-y-4">
          <div className="mesh card overflow-hidden p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-accent text-white shadow-glow">
                  <CurrentIcon className="h-8 w-8" />
                </span>
                <div>
                  <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {place}</p>
                  <p className="font-display text-4xl font-bold leading-none">{Math.round(data.current.temp)}°C</p>
                  <p className="text-sm text-muted">{label(data.current.code)} · feels {Math.round(data.current.feelsLike)}°</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Metric icon={Droplets} value={`${data.current.humidity}%`} label={t('humidity')} />
                <Metric icon={Wind} value={`${Math.round(data.current.wind)}`} label={t('wind_kmh')} />
                <Metric icon={CloudRain} value={`${data.current.precipitation ?? 0}`} label={t('mm_now')} />
              </div>
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <p className="label flex items-center gap-1.5"><Thermometer className="h-4 w-4 text-brand" /> {t('forecast7')}</p>
            <ForecastChart days={data.daily} />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 text-center shadow-card">
      <Icon className="mx-auto h-5 w-5 text-brand" />
      <p className="mt-1 text-sm font-bold">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
