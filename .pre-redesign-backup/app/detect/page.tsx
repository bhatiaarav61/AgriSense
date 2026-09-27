'use client';

// Disease detection: upload a photo or use the live camera. Runs the three-tier
// pipeline (on-device model > cloud vision > offline demo) and shows a rich
// result card. Everything works with no key; a key/model just improves accuracy.
import { useEffect, useMemo, useState } from 'react';
import { Upload, ScanLine, Loader2 } from 'lucide-react';
import { ImageDropzone } from '@/components/ImageDropzone';
import { ResultCard } from '@/components/ResultCard';
import { LiveDetect } from '@/components/LiveDetect';
import { detect, drawToCanvas } from '@/lib/inference';
import { loadModel, type LoadedModel } from '@/lib/models';
import { getCrops } from '@/lib/regions';
import { addHistory } from '@/lib/storage';
import { useSettings } from '@/lib/store';
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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Detect crop disease</h1>
        <p className="text-sm text-muted">Upload a leaf photo or scan live. {model ? 'Using your on-device model.' : apiKey ? 'Using AI vision.' : 'Using free AI vision with an offline fallback.'}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-border p-1">
          <button className={clsx('btn h-9', mode === 'upload' ? 'bg-brand text-brand-fg' : '')} onClick={() => setMode('upload')}>
            <Upload className="h-4 w-4" /> Upload
          </button>
          <button className={clsx('btn h-9', mode === 'live' ? 'bg-brand text-brand-fg' : '')} onClick={() => setMode('live')}>
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
          {result ? (
            <ResultCard result={result} regionId={regionId} />
          ) : (
            <div className="card grid min-h-[200px] place-items-center p-6 text-center text-sm text-muted">
              Your diagnosis will appear here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
