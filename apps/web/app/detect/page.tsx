'use client';

// Disease detection: upload a photo or use the live camera. Runs the three-tier
// pipeline (on-device model > cloud vision > offline demo) and shows a rich
// result card. Everything works with no key; a key/model just improves accuracy.
import { useEffect, useMemo, useState } from 'react';
import { Upload, ScanLine, Loader2, Cpu, Sparkles, WifiOff } from 'lucide-react';
import { ImageDropzone } from '@/components/ImageDropzone';
import { ResultCard } from '@/components/ResultCard';
import { LiveDetect } from '@/components/LiveDetect';
import { DiseaseGallery } from '@/components/DiseaseGallery';
import { detect, drawToCanvas } from '@/lib/inference';
import { loadModel, type LoadedModel } from '@/lib/models';
import { getCrops } from '@/lib/regions';
import { addHistory } from '@/lib/storage';
import { useSettings } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { DetectionResult } from '@/lib/types';
import { clsx } from 'clsx';

function makeThumb(img: HTMLImageElement): string {
  try {
    return drawToCanvas(img, 96).toDataURL('image/jpeg', 0.6);
  } catch {
    return '';
  }
}

export default function DetectPage() {
  const { regionId, apiKey, provider, activeModelId } = useSettings();
  const t = useT();
  const [mode, setMode] = useState<'upload' | 'live'>('upload');
  const [cropId, setCropId] = useState('');
  const [model, setModel] = useState<LoadedModel | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const crops = useMemo(() => getCrops(regionId), [regionId]);

  useEffect(() => {
    setCropId('');
  }, [regionId]);

  useEffect(() => {
    let alive = true;
    if (!activeModelId) {
      setModel(null);
      return;
    }
    loadModel(activeModelId).then((m) => alive && setModel(m)).catch(() => alive && setModel(null));
    return () => {
      alive = false;
    };
  }, [activeModelId]);

  async function runDetect(img: HTMLImageElement) {
    setLoading(true);
    setResult(null);
    try {
      const creds = apiKey ? { provider, apiKey } : null;
      const r = await detect(img, { regionId, cropId: cropId || undefined, model, allowCloud: true, creds });
      setResult(r);
      addHistory({ ...r, regionId, thumbnail: makeThumb(img) }).catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  function onLiveCapture(r: DetectionResult) {
    setMode('upload');
    setResult(r);
    addHistory({ ...r, regionId }).catch(() => {});
  }

  return (
    <div className="animate-fade-up space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{t('detect_title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {model ? (
            <span className="chip-brand"><Cpu className="h-3 w-3" /> On-device model</span>
          ) : apiKey ? (
            <span className="chip-brand"><Sparkles className="h-3 w-3" /> AI vision</span>
          ) : (
            <>
              <span className="chip-brand"><Sparkles className="h-3 w-3" /> Free AI vision</span>
              <span className="chip"><WifiOff className="h-3 w-3" /> Offline fallback</span>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="segment">
          <button className={clsx('segment-item', mode === 'upload' && 'segment-item-active')} onClick={() => setMode('upload')}>
            <Upload className="h-4 w-4" /> Upload
          </button>
          <button className={clsx('segment-item', mode === 'live' && 'segment-item-active')} onClick={() => setMode('live')}>
            <ScanLine className="h-4 w-4" /> Live View
          </button>
        </div>
        {crops.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Crop:</span>
            <select className="input h-9 w-auto" value={cropId} onChange={(e) => setCropId(e.target.value)}>
              <option value="">Auto / any</option>
              {crops.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {mode === 'upload' ? (
            <ImageDropzone onSelect={(img) => runDetect(img)} disabled={loading} />
          ) : (
            <LiveDetect regionId={regionId} cropId={cropId || undefined} model={model} onCapture={onLiveCapture} />
          )}
          {loading && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
            </p>
          )}
        </div>
        <div>
          {loading && !result ? (
            <div className="card space-y-3 p-5">
              <div className="skeleton h-6 w-2/3" />
              <div className="skeleton h-2 w-full" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-5/6" />
              <div className="skeleton h-3 w-4/6" />
            </div>
          ) : result ? (
            <ResultCard result={result} regionId={regionId} />
          ) : (
            <div className="card grid min-h-[220px] place-items-center p-6 text-center text-sm text-muted">
              <div className="flex max-w-[240px] flex-col items-center gap-2">
                <span className="icon-tile opacity-60"><ScanLine className="h-5 w-5" /></span>
                <p className="font-medium text-fg">Your diagnosis will appear here</p>
                <p>Upload a photo or scan live to get started.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <DiseaseGallery regionId={regionId} />
    </div>
  );
}
