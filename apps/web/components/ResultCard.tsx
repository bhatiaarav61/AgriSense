'use client';

// Rich detection result: localized name, confidence, severity, symptoms,
// treatment, prevention, candidate breakdown, and a one-click AI advisory.
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, Stethoscope, MessageSquare, Volume2, Eye, Pill, ShieldCheck } from 'lucide-react';
import type { DetectionResult } from '@/lib/types';
import { Markdown } from './Markdown';
import { speak } from '@/lib/speech';
import { useSettings } from '@/lib/store';
import { useT, type Dict } from '@/lib/i18n';
import { clsx } from 'clsx';

const SOURCE_LABEL: Record<string, string> = { demo: 'Demo heuristic', model: 'On-device model', cloud: 'AI vision' };
const SEV: Record<string, { key: keyof Dict; cls: string }> = {
  low: { key: 'sev_low', cls: 'border-brand/40 bg-brand/10 text-brand' },
  medium: { key: 'sev_medium', cls: 'border-warn/40 bg-warn/10 text-warn' },
  high: { key: 'sev_high', cls: 'border-danger/40 bg-danger/10 text-danger' },
};

export function ResultCard({ result, regionId }: { result: DetectionResult; regionId: string }) {
  const language = useSettings((s) => s.language);
  const apiKey = useSettings((s) => s.apiKey);
  const provider = useSettings((s) => s.provider);
  const t = useT();
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const localized = result.localNames?.[language];
  const pct = Math.round(result.confidence * 100);
  const sev = SEV[result.severity] ?? SEV.low;
  const treatable = result.diseaseId !== 'healthy' && result.diseaseId !== 'unknown';

  async function getAdvisory() {
    setLoading(true);
    try {
      const res = await fetch('/api/advisory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey, 'x-provider': provider } : {}),
        },
        body: JSON.stringify({ regionId, diseaseId: result.diseaseId, cropId: result.cropId, language }),
      });
      const json = await res.json();
      setAdvisory(json.elaboration || json.base?.treatment || 'No advisory available.');
    } catch {
      setAdvisory('Could not reach the advisory service. The treatment above still applies.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-fade-up space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold">{result.name}</h3>
          {localized && localized !== result.name && <p className="text-sm text-muted">{localized}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip">
            <Sparkles className="h-3 w-3" /> {SOURCE_LABEL[result.source] ?? result.source}
          </span>
          <span className={clsx('chip border', sev.cls)}>{t(sev.key)}</span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{t('confidence')}</span>
          <span className="font-semibold text-fg">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {result.symptoms.length > 0 && (
        <div>
          <p className="label flex items-center gap-1.5"><Eye className="h-4 w-4 text-brand" /> {t('symptoms')}</p>
          <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">
            {result.symptoms.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-surface-2/70 p-3">
        <div className="flex items-center justify-between">
          <p className="label mb-0 flex items-center gap-1.5"><Pill className="h-4 w-4 text-brand" /> {t('treatment')}</p>
          <button className="btn-ghost h-7 px-2 text-xs" onClick={() => speak(result.treatment, language)} aria-label={t('treatment')}>
            <Volume2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <Markdown className="mt-1 text-muted">{result.treatment}</Markdown>
      </div>

      {result.preventiveMeasures.length > 0 && (
        <div>
          <p className="label flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand" /> {t('prevention')}</p>
          <ul className="ml-5 list-disc space-y-0.5 text-sm text-muted">
            {result.preventiveMeasures.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.note && <p className="rounded-xl bg-surface-2 p-2 text-xs text-muted">{result.note}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {treatable && (
          <button className="btn-brand" onClick={getAdvisory} disabled={loading}>
            <Stethoscope className="h-4 w-4" /> {loading ? t('preparing') : t('get_plan')}
          </button>
        )}
        <Link className="btn-ghost" href={`/assistant?q=${encodeURIComponent(`How do I manage ${result.name}?`)}`}>
          <MessageSquare className="h-4 w-4" /> {t('ask_assistant')}
        </Link>
      </div>

      {advisory && (
        <div className="animate-fade-in rounded-xl border border-brand/25 bg-brand/5 p-3">
          <Markdown>{advisory}</Markdown>
        </div>
      )}
    </div>
  );
}
