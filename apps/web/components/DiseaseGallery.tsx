'use client';

// AI visual guide: generates disease illustrations with the free, keyless
// Pollinations image API (no sign-up, no API key). Users pick a crop and a
// disease to see what it typically looks like, or type any description.
// Fails gracefully (with a note) when offline — detection itself never
// depends on this.
import { useMemo, useState } from 'react';
import { ImageIcon, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { getCrops, getDiseasesForCrop, localName } from '@/lib/regions';
import { useSettings } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { clsx } from 'clsx';

interface Visual {
  title: string;
  prompt: string;
  seed: number;
}

export function DiseaseGallery({ regionId }: { regionId: string }) {
  const language = useSettings((s) => s.language);
  const t = useT();
  const crops = useMemo(() => getCrops(regionId), [regionId]);
  const [cropId, setCropId] = useState('');
  const [custom, setCustom] = useState('');
  const [visual, setVisual] = useState<Visual | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const diseases = useMemo(() => (cropId ? getDiseasesForCrop(regionId, cropId) : []), [regionId, cropId]);
  const crop = crops.find((c) => c.id === cropId);

  function showDisease(diseaseId: string) {
    const d = diseases.find((x) => x.id === diseaseId);
    if (!d) return;
    const symptoms = d.symptoms.slice(0, 2).join(', ').toLowerCase();
    setVisual({
      title: localName(d, language),
      prompt: `Photorealistic macro reference photo of ${d.name} (${d.scientificName}) affecting ${crop?.name ?? 'crop'} leaves in the field, showing ${symptoms}, plant pathology textbook photo, natural daylight, high detail`,
      seed: 7,
    });
    setFailed(false);
    setLoading(true);
  }

  function showCustom() {
    const text = custom.trim();
    if (!text) return;
    setVisual({
      title: text,
      prompt: `Photorealistic agricultural field photo: ${text}, natural daylight, high detail`,
      seed: 7,
    });
    setFailed(false);
    setLoading(true);
  }

  const src = visual
    ? `https://image.pollinations.ai/prompt/${encodeURIComponent(visual.prompt)}?width=768&height=512&nologo=true&seed=${visual.seed}&model=flux`
    : null;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="icon-tile"><ImageIcon className="h-5 w-5" /></span>
        <div>
          <h2 className="font-display font-bold">{t('g_title')}</h2>
          <p className="text-xs text-muted">{t('g_sub')}</p>
        </div>
      </div>

      {crops.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {crops.map((c) => (
            <button
              key={c.id}
              className={clsx('chip transition-colors', cropId === c.id ? 'border-brand/40 bg-brand/10 text-brand' : 'hover:text-fg')}
              onClick={() => {
                setCropId(c.id);
                setVisual(null);
                setFailed(false);
              }}
            >
              <span aria-hidden>{c.icon}</span> {c.name}
            </button>
          ))}
        </div>
      )}

      {diseases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {diseases.map((d) => (
            <button key={d.id} className="chip whitespace-nowrap transition-colors hover:border-brand/50 hover:text-brand" onClick={() => showDisease(d.id)}>
              {localName(d, language)}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          showCustom();
        }}
      >
        <input
          className="input"
          placeholder="Or describe any scene… e.g. &quot;healthy vs diseased tomato leaves side by side&quot;"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <button type="submit" className="btn-soft shrink-0" disabled={!custom.trim()}>
          <Sparkles className="h-4 w-4" /> {t('g_generate')}
        </button>
      </form>

      {visual && src && (
        <figure className="animate-fade-up space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`AI illustration of ${visual.title}`}
              className="aspect-video w-full object-cover"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setFailed(true);
              }}
            />
            {loading && (
              <div className="absolute inset-0 grid place-items-center bg-surface/70">
                <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Generating image…</p>
              </div>
            )}
          </div>
          <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate"><Sparkles className="mr-1 inline h-3 w-3 text-brand" />AI illustration — indicative only, not a diagnosis: {visual.title}</span>
            <button
              type="button"
              className="btn-ghost h-7 px-2 text-xs"
              onClick={() => {
                setVisual({ ...visual, seed: Math.floor(Math.random() * 100000) });
                setLoading(true);
                setFailed(false);
              }}
            >
              <RefreshCcw className="h-3 w-3" /> {t('g_regenerate')}
            </button>
          </figcaption>
          {failed && <p className="text-xs text-danger">The free image service couldn&apos;t be reached. Detection and advisory features still work — try again when back online.</p>}
        </figure>
      )}
    </section>
  );
}
