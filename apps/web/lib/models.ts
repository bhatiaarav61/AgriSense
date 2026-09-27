'use client';

// Custom model upload + on-device inference (TensorFlow.js). Models are stored
// in the browser (IndexedDB) so they work offline and never touch a server.
import { get, set, del } from 'idb-keyval';
import type { ClassScore } from './demo';
import { getRegion } from './regions';

const META_KEY = 'agrisense-models';

export interface ModelMeta {
  id: string;
  name: string;
  kind: 'layers' | 'graph';
  inputSize: number;
  labels: string[];
  /** label -> region diseaseId (or 'healthy'); empty labels pass through. */
  labelMap: Record<string, string>;
  regionId: string;
  createdAt: number;
  source: 'files' | 'url';
}

export interface LoadedModel extends ModelMeta {
  model: any; // tf.LayersModel | tf.GraphModel (loaded lazily)
}

async function tf() {
  return import('@tensorflow/tfjs');
}

export async function listModels(): Promise<ModelMeta[]> {
  return (await get<ModelMeta[]>(META_KEY)) ?? [];
}

async function saveMeta(list: ModelMeta[]) {
  await set(META_KEY, list);
}

function idbKey(id: string) {
  return `indexeddb://agrisense-model-${id}`;
}

/** Fuzzy-map raw model labels (e.g. "Tomato___Late_blight") to region diseaseIds. */
export function buildLabelMap(labels: string[], regionId: string): Record<string, string> {
  const region = getRegion(regionId);
  const map: Record<string, string> = {};
  if (!region) return map;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  for (const label of labels) {
    const nl = norm(label);
    if (/health/.test(nl)) {
      map[label] = 'healthy';
      continue;
    }
    const hit = region.diseases.find((d) => {
      const nd = norm(d.id) + norm(d.name);
      return nl.includes(norm(d.id)) || nd.includes(nl) || norm(d.name).split(' ').every((w) => nl.includes(norm(w)));
    });
    if (hit) map[label] = hit.id;
  }
  return map;
}

function parseLabels(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.labels)) return (obj.labels as unknown[]).map(String);
    // {"0":"a","1":"b"} style
    const keys = Object.keys(obj);
    if (keys.every((k) => /^\d+$/.test(k))) return keys.sort((a, b) => +a - +b).map((k) => String(obj[k]));
  }
  return [];
}

async function persist(
  loaded: unknown,
  kind: 'layers' | 'graph',
  opts: { name: string; labels: string[]; inputSize: number; regionId: string; source: 'files' | 'url' },
): Promise<ModelMeta> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await (loaded as any).save(idbKey(id));
  const meta: ModelMeta = {
    id,
    name: opts.name,
    kind,
    inputSize: opts.inputSize,
    labels: opts.labels,
    labelMap: buildLabelMap(opts.labels, opts.regionId),
    regionId: opts.regionId,
    createdAt: Date.now(),
    source: opts.source,
  };
  await saveMeta([meta, ...(await listModels())]);
  return meta;
}

export async function importFromFiles(
  files: File[],
  opts: { name: string; inputSize: number; regionId: string },
): Promise<ModelMeta> {
  const t = await tf();
  const jsonFile = files.find((f) => f.name.endsWith('.json') && !/label/i.test(f.name));
  if (!jsonFile) throw new Error('Select the model.json file (and its .bin weight shards).');
  const weightFiles = files.filter((f) => /\.bin$/i.test(f.name) || (f.name.endsWith('.json') && /shard/i.test(f.name)));

  const labelFile = files.find((f) => /label/i.test(f.name) && f.name.endsWith('.json'));
  let labels: string[] = [];
  if (labelFile) labels = parseLabels(JSON.parse(await labelFile.text()));

  const spec = JSON.parse(await jsonFile.text());
  const kind: 'layers' | 'graph' = spec?.format === 'graph-model' || spec?.modelTopology?.node ? 'graph' : 'layers';
  const handler = t.io.browserFiles([jsonFile, ...weightFiles]);
  const loaded = kind === 'graph' ? await t.loadGraphModel(handler) : await t.loadLayersModel(handler);
  return persist(loaded, kind, { ...opts, labels, source: 'files' });
}

export async function importFromUrl(
  url: string,
  opts: { name: string; inputSize: number; regionId: string; labels?: string[] },
): Promise<ModelMeta> {
  const t = await tf();
  let kind: 'layers' | 'graph' = 'layers';
  let loaded;
  try {
    loaded = await t.loadLayersModel(url);
  } catch {
    loaded = await t.loadGraphModel(url);
    kind = 'graph';
  }
  return persist(loaded, kind, { ...opts, labels: opts.labels ?? [], source: 'url' });
}

export async function loadModel(id: string): Promise<LoadedModel | null> {
  const meta = (await listModels()).find((m) => m.id === id);
  if (!meta) return null;
  const t = await tf();
  const model = meta.kind === 'graph' ? await t.loadGraphModel(idbKey(id)) : await t.loadLayersModel(idbKey(id));
  return { ...meta, model };
}

export async function deleteModel(id: string): Promise<void> {
  await saveMeta((await listModels()).filter((m) => m.id !== id));
  try {
    const t = await tf();
    await t.io.removeModel(idbKey(id));
  } catch {
    /* already gone */
  }
  await del(`agrisense-model-cache-${id}`);
}

/** Run classification on a canvas already scaled to the model's input size. */
export async function classifyWithModel(model: LoadedModel, canvas: HTMLCanvasElement): Promise<ClassScore[]> {
  const t = await tf();
  const probs: number[] = t.tidy(() => {
    let x = t.browser.fromPixels(canvas).toFloat().div(255).expandDims(0);
    let out = model.model.predict(x) as any;
    if (Array.isArray(out)) out = out[0];
    const arr = Array.from(out.dataSync() as Float32Array);
    const sum = arr.reduce((s, v) => s + v, 0);
    const looksLikeProbs = arr.every((v) => v >= 0 && v <= 1) && Math.abs(sum - 1) < 0.15;
    if (looksLikeProbs) return arr;
    const softmaxed = t.softmax(t.tensor1d(arr)).dataSync() as Float32Array;
    return Array.from(softmaxed);
  });

  const labels = model.labels.length ? model.labels : probs.map((_, i) => `class_${i}`);
  return probs
    .map((score, i) => ({ label: labels[i] ?? `class_${i}`, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
