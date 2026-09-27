import { describe, it, expect } from 'vitest';
import { demoClassify, demoChat, type ImageFeatures } from '@/lib/demo';
import { getRegion } from '@/lib/regions';
import type { Disease, Region } from '@/lib/types';

const DISEASES: Disease[] = [
  { id: 'late_blight', name: 'Late blight', cropIds: ['potato'], symptoms: ['brown lesions', 'rot', 'dead tissue'] } as Disease,
  { id: 'leaf_rust', name: 'Leaf rust', cropIds: ['wheat'], symptoms: ['yellow orange pustules', 'stripe'] } as Disease,
];

function features(over: Partial<ImageFeatures>): ImageFeatures {
  return { brightness: 0.5, greenRatio: 0.5, brownRatio: 0.1, yellowRatio: 0.1, spotiness: 0.1, ...over };
}

describe('demoClassify (offline detector)', () => {
  it('always returns valid, sorted labels that sum-normalise', () => {
    const out = demoClassify(DISEASES, features({}));
    expect(out.length).toBe(DISEASES.length + 1); // + healthy
    const labels = out.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['healthy', 'late_blight', 'leaf_rust']));
    // sorted descending by score
    for (let i = 1; i < out.length; i++) expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
    // every label is 'healthy' or a real disease id
    for (const c of out) expect(c.label === 'healthy' || DISEASES.some((d) => d.id === c.label)).toBe(true);
  });

  it('is deterministic for identical features', () => {
    const a = demoClassify(DISEASES, features({ brownRatio: 0.6, spotiness: 0.5 }));
    const b = demoClassify(DISEASES, features({ brownRatio: 0.6, spotiness: 0.5 }));
    expect(a).toEqual(b);
  });

  it('leans healthy for a lush green leaf and diseased for brown/spotty', () => {
    const healthy = demoClassify(DISEASES, features({ greenRatio: 0.95, brownRatio: 0.02, yellowRatio: 0.02, spotiness: 0.02 }));
    expect(healthy[0].label).toBe('healthy');
    const sick = demoClassify(DISEASES, features({ greenRatio: 0.2, brownRatio: 0.7, spotiness: 0.7 }));
    expect(sick[0].label).not.toBe('healthy');
  });
});

describe('demoChat (offline assistant)', () => {
  const region = getRegion('india') as Region;

  it('greets on a greeting', () => {
    expect(demoChat('hello', region)).toMatch(/AgriSense assistant/i);
  });

  it('answers with disease details when a disease is named', () => {
    const disease = region.diseases[0];
    const reply = demoChat(`how do I treat ${disease.name}`, region);
    expect(reply).toContain(disease.name);
  });

  it('routes weather/yield/scan intents', () => {
    expect(demoChat('what is the weather forecast', region)).toMatch(/Weather/);
    expect(demoChat('estimate my yield', region)).toMatch(/Yield/);
    expect(demoChat('scan a photo', region)).toMatch(/Detect/);
  });
});
