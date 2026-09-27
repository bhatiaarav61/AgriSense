import { rateLimit, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Live weather via Open-Meteo — genuinely free, no API key. Two modes:
//   GET ?q=<place>            → geocoding search (list of matches)
//   GET ?lat=<n>&lon=<n>      → current conditions + 7-day agri forecast
async function omFetch(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  const rl = rateLimit(`weather:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  try {
    if (q) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
      const data = await omFetch(url);
      const results = (data?.results ?? []).map((r: Record<string, unknown>) => ({
        name: r.name,
        admin1: r.admin1,
        country: r.country,
        countryCode: r.country_code,
        latitude: r.latitude,
        longitude: r.longitude,
      }));
      return Response.json({ results });
    }

    const lat = parseFloat(searchParams.get('lat') || '');
    const lon = parseFloat(searchParams.get('lon') || '');
    if (!isFinite(lat) || !isFinite(lon)) {
      return Response.json({ error: 'Provide ?q=<place> or ?lat=&lon=' }, { status: 400 });
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,relative_humidity_2m_mean' +
      '&timezone=auto&forecast_days=7';
    const data = await omFetch(url);

    const daily = data?.daily ?? {};
    const days = (daily.time ?? []).map((date: string, i: number) => ({
      date,
      code: daily.weather_code?.[i],
      tMax: daily.temperature_2m_max?.[i],
      tMin: daily.temperature_2m_min?.[i],
      rain: daily.precipitation_sum?.[i],
      rainProb: daily.precipitation_probability_max?.[i],
      wind: daily.wind_speed_10m_max?.[i],
      humidity: daily.relative_humidity_2m_mean?.[i],
    }));

    return Response.json({
      location: { latitude: lat, longitude: lon, timezone: data?.timezone },
      current: {
        temp: data?.current?.temperature_2m,
        feelsLike: data?.current?.apparent_temperature,
        humidity: data?.current?.relative_humidity_2m,
        precipitation: data?.current?.precipitation,
        code: data?.current?.weather_code,
        wind: data?.current?.wind_speed_10m,
        time: data?.current?.time,
      },
      daily: days,
    });
  } catch (err) {
    return Response.json({ error: `Weather lookup failed: ${(err as Error).message}` }, { status: 502 });
  }
}
