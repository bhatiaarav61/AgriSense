'use client';

// Dashboard home: hero, live KPIs for the selected region, feature cards, and a
// preview of recent scans (from IndexedDB).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Camera, MessageSquare, CloudSun, Sprout, Cpu, ScanLine, Sparkles, KeyRound, Leaf, ShieldCheck } from 'lucide-react';
import { getRegion } from '@/lib/regions';
import { getHistory, type HistoryItem } from '@/lib/storage';
import { useSettings } from '@/lib/store';

const FEATURES = [
  { href: '/detect', icon: Camera, title: 'Detect disease', desc: 'Upload a leaf photo for an instant diagnosis, treatment and prevention plan.' },
  { href: '/detect', icon: ScanLine, title: 'Live View scan', desc: 'Point your camera at a plant and get real-time, on-device detection.' },
  { href: '/assistant', icon: MessageSquare, title: 'Voice assistant', desc: 'Ask agronomy questions by voice or text and hear answers read aloud.' },
  { href: '/weather', icon: CloudSun, title: 'Weather', desc: 'Live conditions and a 7-day agri forecast — free, no key needed.' },
  { href: '/yield', icon: Sprout, title: 'Yield estimator', desc: 'Transparent yield range from crop, area, planting and live weather.' },
  { href: '/models', icon: Cpu, title: 'Your models', desc: 'Upload a TensorFlow.js model to diagnose fully offline, on-device.' },
];

export default function HomePage() {
  const { regionId, apiKey } = useSettings();
  const region = useMemo(() => getRegion(regionId), [regionId]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    getHistory().then((h) => setHistory(h.slice(0, 4)));
  }, []);

  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="chip"><Sparkles className="h-3 w-3" /> Free &amp; open · works offline</span>
          <h1 className="text-3xl font-bold sm:text-4xl">AI crop assistant for <span className="text-brand">{region?.name ?? 'your farm'}</span></h1>
          <p className="text-muted">Detect diseases from a photo or live camera, chat by voice, check the weather and estimate yield — all in your browser. No sign-up, and it works with no API key.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/detect" className="btn-brand"><Camera className="h-4 w-4" /> Scan a leaf</Link>
            <Link href="/assistant" className="btn-ghost"><MessageSquare className="h-4 w-4" /> Ask the assistant</Link>
          </div>
          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted">
            {apiKey ? <><KeyRound className="h-3.5 w-3.5 text-brand" /> Using your AI key.</> : <><Sparkles className="h-3.5 w-3.5 text-brand" /> Using free keyless AI — add your own key in Settings for best accuracy.</>}
          </p>
        </div>
        <Leaf className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 text-brand/10" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Region" value={region?.name ?? '—'} />
        <Kpi label="Crops covered" value={String(region?.crops.length ?? 0)} />
        <Kpi label="Diseases" value={String(region?.diseases.length ?? 0)} />
        <Kpi label="Languages" value={String(region?.languages?.length ?? 1)} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Everything you can do</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.title} href={f.href} className="card group p-4 transition-colors hover:border-brand">
              <f.icon className="h-6 w-6 text-brand" />
              <p className="mt-2 font-medium">{f.title}</p>
              <p className="text-sm text-muted">{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent scans</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {history.map((h) => (
              <div key={h.historyId} className="card flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.thumbnail ? <img src={h.thumbnail} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <Leaf className="h-12 w-12 rounded-lg bg-surface-2 p-2 text-brand" />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted">{Math.round(h.confidence * 100)}% · {h.source}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card flex items-start gap-3 p-4 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p>AgriSense is a decision-support tool, not a substitute for professional agronomic advice. Always confirm chemical treatments and dosages with a local agricultural extension officer.</p>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-xl font-bold">{value}</p>
    </div>
  );
}
