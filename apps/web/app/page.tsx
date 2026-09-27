'use client';

// Dashboard home: hero with brand visual, live KPIs for the selected region,
// feature cards, and a preview of recent scans (from IndexedDB).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  MessageSquare,
  CloudSun,
  Sprout,
  Cpu,
  ScanLine,
  Sparkles,
  KeyRound,
  ShieldCheck,
  MapPin,
  Stethoscope,
  Languages,
  ArrowRight,
} from 'lucide-react';
import { getRegion } from '@/lib/regions';
import { getHistory, type HistoryItem } from '@/lib/storage';
import { useSettings } from '@/lib/store';
import { HeroMedia } from '@/components/HeroMedia';
import { CountUp } from '@/components/CountUp';
import { useT, type Dict } from '@/lib/i18n';

const FEATURES: { href: string; icon: React.ComponentType<{ className?: string }>; tk: keyof Dict; dk: keyof Dict }[] = [
  { href: '/detect', icon: Camera, tk: 'f_detect_t', dk: 'f_detect_d' },
  { href: '/detect', icon: ScanLine, tk: 'f_live_t', dk: 'f_live_d' },
  { href: '/assistant', icon: MessageSquare, tk: 'f_voice_t', dk: 'f_voice_d' },
  { href: '/weather', icon: CloudSun, tk: 'f_weather_t', dk: 'f_weather_d' },
  { href: '/yield', icon: Sprout, tk: 'f_yield_t', dk: 'f_yield_d' },
  { href: '/models', icon: Cpu, tk: 'f_models_t', dk: 'f_models_d' },
];

export default function HomePage() {
  const { regionId, apiKey } = useSettings();
  const t = useT();
  const region = useMemo(() => getRegion(regionId), [regionId]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  useEffect(() => {
    getHistory().then((h) => setHistory(h.slice(0, 4)));
  }, []);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="mesh relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="animate-fade-up space-y-4">
            <span className="chip-brand"><Sparkles className="h-3 w-3" /> {t('hero_badge')}</span>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
              {(() => {
                const regionName = region?.name ?? 'your farm';
                const [before, after] = t('hero_title_pre').split('{region}');
                return (
                  <>
                    {before}
                    <span className="text-gradient">{regionName}</span>
                    {after}
                  </>
                );
              })()}
            </h1>
            <p className="max-w-xl text-muted sm:text-lg">{t('hero_sub')}</p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Link href="/detect" className="btn-brand"><Camera className="h-4 w-4" /> {t('hero_cta1')}</Link>
              <Link href="/assistant" className="btn-ghost"><MessageSquare className="h-4 w-4" /> {t('hero_cta2')}</Link>
            </div>
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted">
              {apiKey ? (
                <><KeyRound className="h-3.5 w-3.5 text-brand" /> {t('hero_note_key')}</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 text-brand" /> {t('hero_note_free')}</>
              )}
            </p>
          </div>
          <HeroMedia />
        </div>
      </section>

      {/* Region KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={MapPin} label={t('kpi_region')} value={region?.name ?? '—'} />
        <Kpi icon={Sprout} label={t('kpi_crops')} value={String(region?.crops.length ?? 0)} />
        <Kpi icon={Stethoscope} label={t('kpi_diseases')} value={String(region?.diseases.length ?? 0)} />
        <Kpi icon={Languages} label={t('kpi_langs')} value={String(region?.languages?.length ?? 1)} />
      </section>

      {/* Features */}
      <section>
        <h2 className="mb-4 font-display text-xl font-bold">{t('features_title')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.tk} href={f.href} className="card card-hover group animate-fade-up p-5">
              <div className="flex items-start justify-between">
                <span className="icon-tile"><f.icon className="h-5 w-5" /></span>
                <ArrowRight className="h-4 w-4 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:text-brand group-hover:opacity-100" />
              </div>
              <p className="mt-3 font-semibold">{t(f.tk)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(f.dk)}</p>
            </Link>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-bold">{t('recent_scans')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {history.map((h) => (
              <div key={h.historyId} className="card card-hover flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {h.thumbnail ? (
                  <img src={h.thumbnail} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <span className="icon-tile"><ScanLine className="h-5 w-5" /></span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{h.name}</p>
                  <p className="text-xs text-muted">{Math.round(h.confidence * 100)}% · {h.source}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card flex items-start gap-3 p-4 text-sm text-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <p>{t('disclaimer')}</p>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  const numeric = /^\d+$/.test(value);
  return (
    <div className="card card-hover p-4">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4 text-brand" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1.5 truncate font-display text-xl font-bold">
        {numeric ? <CountUp value={Number(value)} /> : value}
      </p>
    </div>
  );
}
