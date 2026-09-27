'use client';

// Upload / manage on-device TensorFlow.js models. Everything runs and is stored
// in the browser (IndexedDB) — models never touch a server. The active model
// powers /detect and the Live View scanner.
import { useEffect, useRef, useState } from 'react';
import { UploadCloud, Link2, Trash2, CheckCircle2, Circle, Cpu, Loader2 } from 'lucide-react';
import { listModels, importFromFiles, importFromUrl, deleteModel, type ModelMeta } from '@/lib/models';
import { useSettings } from '@/lib/store';
import { clsx } from 'clsx';

export function ModelManager() {
  const regionId = useSettings((s) => s.regionId);
  const activeModelId = useSettings((s) => s.activeModelId);
  const setActiveModel = useSettings((s) => s.setActiveModel);
  const [models, setModels] = useState<ModelMeta[]>([]);
  const [name, setName] = useState('');
  const [inputSize, setInputSize] = useState(224);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const refresh = () => listModels().then(setModels);
  useEffect(() => {
    refresh();
  }, []);

  async function run(fn: () => Promise<ModelMeta>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const meta = await fn();
      await refresh();
      setActiveModel(meta.id);
      setMsg({ kind: 'ok', text: `${okText} "${meta.name}" is now active (${Object.keys(meta.labelMap).length}/${meta.labels.length} labels matched to region diseases).` });
      setName('');
      setUrl('');
      if (filesRef.current) filesRef.current.value = '';
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Import failed.' });
    } finally {
      setBusy(false);
    }
  }

  function onUploadFiles() {
    const files = Array.from(filesRef.current?.files ?? []);
    if (!files.length) return setMsg({ kind: 'err', text: 'Select model.json plus its .bin weight shards (and optionally labels.json).' });
    run(() => importFromFiles(files, { name: name || 'Uploaded model', inputSize, regionId }), 'Uploaded model');
  }

  function onImportUrl() {
    if (!/^https?:\/\//.test(url)) return setMsg({ kind: 'err', text: 'Enter a valid https URL to a model.json.' });
    run(() => importFromUrl(url, { name: name || 'Model from URL', inputSize, regionId }), 'Model from');
  }

  async function remove(id: string) {
    await deleteModel(id);
    if (activeModelId === id) setActiveModel(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="icon-tile"><Cpu className="h-5 w-5" /></span>
          <h2 className="font-display text-lg font-bold">Add a model</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input className="input" placeholder="e.g. PlantVillage MobileNet" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Input size (px)</span>
            <input className="input" type="number" min={32} max={1024} value={inputSize} onChange={(e) => setInputSize(Math.max(32, Math.min(1024, +e.target.value || 224)))} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <p className="label flex items-center gap-1"><UploadCloud className="h-4 w-4" /> From files</p>
            <input ref={filesRef} type="file" multiple accept=".json,.bin" className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-fg" />
            <p className="mt-1 text-xs text-muted">Select <code>model.json</code>, its <code>*.bin</code> shards, and optional <code>labels.json</code>.</p>
            <button className="btn-brand mt-2 w-full" onClick={onUploadFiles} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload
            </button>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="label flex items-center gap-1"><Link2 className="h-4 w-4" /> From URL</p>
            <input className="input mt-1" placeholder="https://.../model.json" value={url} onChange={(e) => setUrl(e.target.value)} />
            <p className="mt-1 text-xs text-muted">A TF.js Layers or Graph model hosted with CORS enabled.</p>
            <button className="btn-brand mt-2 w-full" onClick={onImportUrl} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Import
            </button>
          </div>
        </div>

        {msg && <p className={clsx('text-sm', msg.kind === 'ok' ? 'text-brand' : 'text-danger')}>{msg.text}</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Your models</h2>
        {models.length === 0 && <p className="text-sm text-muted">No models yet. Detection uses the free offline demo heuristic until you add one (or set an AI key in Settings).</p>}
        {models.map((m) => {
          const isActive = m.id === activeModelId;
          return (
            <div key={m.id} className={clsx('card card-hover flex items-center justify-between gap-3 p-3', isActive && 'border-brand ring-1 ring-brand/30')}>
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-xs text-muted">{m.kind} · {m.inputSize}px · {m.labels.length} labels · region {m.regionId}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button className={clsx('btn-ghost h-8 px-2 text-xs', isActive && 'text-brand')} onClick={() => setActiveModel(isActive ? null : m.id)}>
                  {isActive ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />} {isActive ? 'Active' : 'Activate'}
                </button>
                <button className="btn-ghost h-8 w-8 p-0 text-danger" onClick={() => remove(m.id)} aria-label="Delete model">
                  <Trash2 className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
