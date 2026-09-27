'use client';

// 7-day agri forecast chart (temperature range + rainfall) built on Recharts.
import { ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export interface ForecastDay {
  date: string;
  tMax: number;
  tMin: number;
  rain: number;
  rainProb: number;
}

export function ForecastChart({ days }: { days: ForecastDay[] }) {
  const data = days.map((d) => ({
    day: new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }),
    High: Math.round(d.tMax),
    Low: Math.round(d.tMin),
    Rain: Math.round(d.rain * 10) / 10,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} />
          <YAxis yAxisId="temp" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} unit="°" />
          <YAxis yAxisId="rain" orientation="right" tick={{ fontSize: 12, fill: 'rgb(var(--muted))' }} unit="mm" />
          <Tooltip
            contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12, color: 'rgb(var(--fg))' }}
            labelStyle={{ color: 'rgb(var(--fg))' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="rain" dataKey="Rain" fill="rgb(var(--brand))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
          <Area yAxisId="temp" type="monotone" dataKey="High" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
          <Area yAxisId="temp" type="monotone" dataKey="Low" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.1} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
