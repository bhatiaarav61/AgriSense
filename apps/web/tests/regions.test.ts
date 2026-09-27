import { describe, it, expect } from 'vitest';
import { getRegions, getRegion, getCrops, getDiseases, localName, renderTreatment } from '@/lib/regions';

describe('regions data', () => {
  it('loads all generated regions', () => {
    const regions = getRegions();
    expect(regions.length).toBeGreaterThanOrEqual(5);
    expect(regions.map((r) => r.id)).toEqual(expect.arrayContaining(['india', 'bangladesh', 'brazil', 'kenya', 'nigeria']));
  });

  it('exposes crops and diseases for a region', () => {
    const india = getRegion('india');
    expect(india).toBeDefined();
    expect(getCrops('india').length).toBeGreaterThan(0);
    expect(getDiseases('india').length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown region', () => {
    expect(getRegion('atlantis')).toBeUndefined();
    expect(getCrops('atlantis')).toEqual([]);
  });

  it('localName falls back to English then base name', () => {
    expect(localName({ name: 'Rice', localNames: { hi: 'चावल', en: 'Rice' } }, 'hi')).toBe('चावल');
    expect(localName({ name: 'Rice', localNames: { en: 'Rice' } }, 'ta')).toBe('Rice');
    expect(localName({ name: 'Rice' }, 'ta')).toBe('Rice');
    expect(localName(undefined, 'en')).toBe('');
  });

  it('renderTreatment fills placeholders', () => {
    const out = renderTreatment(
      { id: 'x', name: 'Late blight', cropIds: [], treatmentTemplate: 'Spray for {disease} on {crop} in {region}.' } as never,
      { cropName: 'Potato', regionName: 'India' },
    );
    expect(out).toBe('Spray for Late blight on Potato in India.');
  });
});
