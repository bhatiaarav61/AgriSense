'use client';

// Live weather + 7-day agri forecast via Open-Meteo (free, no API key).
import { useEffect, useState } from 'react';
import { Search, MapPin, Loader2, Droplets, Wind, Thermometer, CloudRain } from 'lucide-react';
import { ForecastChart, type ForecastDay } from '@/components/charts/ForecastChart';

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

export default function WeatherPage() {
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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Weather</h1>
        <p className="text-sm text-muted">Live conditions and a 7-day agri forecast. Free, no API key (Open-Meteo).</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <form onSubmit={search} className="flex flex-1 gap-2">
          <input className="input" placeholder="Search a city or village…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-brand shrink-0" type="submit" disabled={loading}><Search className="h-4 w-4" /> Search</button>
        </form>
        <button className="btn-ghost" onClick={locate} disabled={loading}><MapPin className="h-4 w-4" /> My location</button>
      </div>

      {results.length > 0 && (
        <div className="card divide-y divide-border">
          {results.map((r, i) => (
            <button key={i} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-surface-2" onClick={() => loadForecast(r.latitude, r.longitude, [r.name, r.admin1, r.country].filter(Boolean).join(', '))}>
              <MapPin className="h-4 w-4 text-muted" /> {[r.name, r.admin1, r.country].filter(Boolean).join(', ')}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading weather…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          <div className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{place}</p>
                <p className="text-3xl font-bold">{Math.round(data.current.temp)}°C</p>
                <p className="text-sm text-muted">{label(data.current.code)} · feels {Math.round(data.current.feelsLike)}°</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div><Droplets className="mx-auto h-5 w-5 text-accent" /><p className="mt-1 font-medium">{data.current.humidity}%</p><p className="text-xs text-muted">Humidity</p></div>
                <div><Wind className="mx-auto h-5 w-5 text-accent" /><p className="mt-1 font-medium">{Math.round(data.current.wind)}</p><p className="text-xs text-muted">km/h</p></div>
                <div><CloudRain className="mx-auto h-5 w-5 text-accent" /><p className="mt-1 font-medium">{data.current.precipitation ?? 0}</p><p className="text-xs text-muted">mm now</p></div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <p className="label flex items-center gap-1"><Thermometer className="h-4 w-4" /> 7-day forecast</p>
            <ForecastChart days={data.daily} />
          </div>
        </>
      )}
    </div>
  );
}
