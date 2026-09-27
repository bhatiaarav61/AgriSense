'use client';

// Client-side detection pipeline. Chooses the best available strategy:
//   on-device model  >  cloud vision (if a key is set)  >  offline demo heuristic
// All three return a normalised DetectionResult built from the region's real
// crop/disease data.
import type { DetectionResult, DetectionSource, Severity } from './types';
import { demoClassify, type ImageFeatures, type ClassScore } from './demo';
import { getDisease, getDiseasesForCrop, getCrop, getRegion, renderTreatment } from './regions';
import type { LoadedModel } from './models';
import { classifyWithModel } from './models';

export interface DetectOptions {
  regionId: string;
  cropId?: string;
  model?: LoadedModel | null;
  creds?: { provider: string; apiKey: string } | null;
  allowCloud?: boolean;
}

const WORK = 96; // downscale size for feature extraction

export function drawToCanvas(source: CanvasImageSource, size = WORK): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, size, size);
  return canvas;
}

export function extractFeatures(source: CanvasImageSource): ImageFeatures {
  const canvas = drawToCanvas(source, WORK);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, WORK, WORK);
  let green = 0,
    brown = 0,
    yellow = 0,
    lumSum = 0;
  const lums: number[] = [];
  const n = WORK * WORK;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lums.push(lum);
    lumSum += lum;
    if (g > r && g > b && g > 55) green++;
    else if (r > 150 && g > 130 && b < 120) yellow++;
    else if (r > 70 && r >= g && g >= b && r - b > 25 && lum < 0.7) brown++;
  }
  const mean = lumSum / n;
  const variance = lums.reduce((s, l) => s + (l - mean) * (l - mean), 0) / n;
  return {
    brightness: clamp01(mean),
    greenRatio: clamp01(green / n),
    brownRatio: clamp01(brown / n),
    yellowRatio: clamp01(yellow / n),
    spotiness: clamp01(Math.sqrt(variance) * 2.4),
  };
}

export function canvasToBase64(source: CanvasImageSource, size = 512): string {
  const canvas = drawToCanvas(source, size);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/** Main entry: analyse an image/video frame and return a DetectionResult. */
export async function detect(source: CanvasImageSource, opts: DetectOptions): Promise<DetectionResult> {
  // 1) On-device model, if one is active.
  if (opts.model) {
    try {
      const candidates = await classifyWithModel(opts.model, drawToCanvas(source, opts.model.inputSize));
      return buildResult(candidates, 'model', opts, opts.model.labelMap);
    } catch {
      /* fall through to demo */
    }
  }

  // 2) Cloud vision, if allowed (single-shot only). Works even without a key:
  // the server falls back to the free keyless provider. A BYO key, when set,
  // is forwarded for higher quality/limits.
  if (opts.allowCloud) {
    try {
      const b64 = canvasToBase64(source, 640);
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(opts.creds?.apiKey ? { 'x-api-key': opts.creds.apiKey, 'x-provider': opts.creds.provider } : {}),
        },
        body: JSON.stringify({ image: b64, regionId: opts.regionId, cropId: opts.cropId }),
      });
      if (res.ok) {
        const json = (await res.json()) as { candidates?: ClassScore[]; fallback?: boolean };
        if (!json?.fallback && json?.candidates?.length) return buildResult(json.candidates, 'cloud', opts);
      }
    } catch {
      /* fall through to demo */
    }
  }

  // 3) Offline demo heuristic (always works).
  const features = extractFeatures(source);
  const diseases = opts.cropId ? getDiseasesForCrop(opts.regionId, opts.cropId) : getRegion(opts.regionId)?.diseases ?? [];
  const candidates = demoClassify(diseases, features);
  return buildResult(candidates, 'demo', opts);
}

function severityFromScore(score: number, allowed?: string[]): Severity {
  let s: Severity = score > 0.75 ? 'high' : score > 0.5 ? 'medium' : 'low';
  if (allowed?.length && !allowed.includes(s)) s = (allowed[allowed.length - 1] as Severity) ?? s;
  return s;
}

/**
 * Turn ranked class scores into a full DetectionResult. `labelMap` (from custom
 * models) maps model labels to region diseaseIds; without it labels are assumed
 * to already be diseaseIds (or 'healthy').
 */
function buildResult(
  candidates: ClassScore[],
  source: DetectionSource,
  opts: DetectOptions,
  labelMap?: Record<string, string>,
): DetectionResult {
  const region = getRegion(opts.regionId);
  const top = candidates[0] ?? { label: 'healthy', score: 0.5 };
  const mappedId = labelMap?.[top.label] ?? top.label;
  const crop = opts.cropId ? getCrop(opts.regionId, opts.cropId) : undefined;

  if (mappedId === 'healthy' || /health/i.test(top.label)) {
    return {
      diseaseId: 'healthy',
      name: 'Healthy — no disease detected',
      confidence: top.score,
      source,
      severity: 'low',
      symptoms: [],
      treatment: 'No treatment needed. Keep monitoring and maintain good field hygiene, balanced nutrition and irrigation.',
      preventiveMeasures: ['Scout fields regularly', 'Rotate crops', 'Use certified seed'],
      localNames: {},
      cropId: opts.cropId,
      candidates: candidates.slice(0, 5),
      note: source === 'demo' ? 'Offline demo heuristic — not a trained diagnosis.' : undefined,
      createdAt: Date.now(),
    };
  }

  const disease = getDisease(opts.regionId, mappedId);
  if (!disease) {
    return {
      diseaseId: mappedId || 'unknown',
      name: prettyLabel(top.label),
      confidence: top.score,
      source,
      severity: severityFromScore(top.score),
      symptoms: [],
      treatment: 'Unrecognised class for this region. Consult a local agricultural extension officer for confirmation.',
      preventiveMeasures: [],
      localNames: {},
      cropId: opts.cropId,
      candidates: candidates.slice(0, 5),
      note: 'Model label did not match a known disease in this region.',
      createdAt: Date.now(),
    };
  }

  return {
    diseaseId: disease.id,
    name: disease.name,
    confidence: top.score,
    source,
    severity: severityFromScore(top.score, disease.severityLevels),
    symptoms: disease.symptoms ?? [],
    treatment: renderTreatment(disease, { cropName: crop?.name, regionName: region?.name }),
    preventiveMeasures: disease.preventiveMeasures ?? [],
    localNames: disease.localNames ?? {},
    cropId: opts.cropId,
    candidates: candidates.slice(0, 5),
    note: source === 'demo' ? 'Offline demo heuristic — add a model or AI key for higher accuracy.' : undefined,
    createdAt: Date.now(),
  };
}

function prettyLabel(label: string): string {
  return label.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
