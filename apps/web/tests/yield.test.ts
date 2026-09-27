import { describe, it, expect } from 'vitest';
import { estimateYield } from '@/lib/yield';

describe('estimateYield', () => {
  it('produces a coherent band around the expected value', () => {
    const e = estimateYield({ cropName: 'Rice', areaHa: 2, irrigation: 'irrigated' });
    expect(e.lowTPerHa).toBeLessThan(e.expectedTPerHa);
    expect(e.highTPerHa).toBeGreaterThan(e.expectedTPerHa);
    expect(e.totalExpectedT).toBeCloseTo(e.expectedTPerHa * 2, 1);
    expect(e.confidence).toBeGreaterThanOrEqual(0.3);
    expect(e.confidence).toBeLessThanOrEqual(0.85);
  });

  it('rewards better irrigation', () => {
    const drip = estimateYield({ cropName: 'Tomato', areaHa: 1, irrigation: 'drip' });
    const rainfed = estimateYield({ cropName: 'Tomato', areaHa: 1, irrigation: 'rainfed' });
    expect(drip.expectedTPerHa).toBeGreaterThan(rainfed.expectedTPerHa);
  });

  it('flags heat stress from live weather as a risk', () => {
    const e = estimateYield({ cropName: 'Maize', areaHa: 1, irrigation: 'irrigated', weather: { tempMax: 42 } });
    expect(e.risks.join(' ')).toMatch(/heat stress/i);
  });

  it('lowers confidence for an unknown crop', () => {
    const known = estimateYield({ cropName: 'Wheat', areaHa: 1, irrigation: 'irrigated' });
    const unknown = estimateYield({ cropName: 'Dragonfruit', areaHa: 1, irrigation: 'irrigated' });
    expect(unknown.confidence).toBeLessThan(known.confidence);
  });

  it('clamps a nonsensical area to zero total', () => {
    const e = estimateYield({ cropName: 'Rice', areaHa: -5, irrigation: 'irrigated' });
    expect(e.areaHa).toBe(0);
    expect(e.totalExpectedT).toBe(0);
  });
});
