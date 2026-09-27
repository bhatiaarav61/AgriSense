// Region data access. Reads the bundled JSON generated from regions/*.yaml
// (see scripts/build-region-data.mjs). Pure + isomorphic (no fs), so it works
// in both server route handlers and client components.
import type { Crop, Disease, Region } from './types';
import generated from '../data/regions.generated.json';

const REGIONS: Region[] = ((generated as unknown as { regions?: Region[] })?.regions ?? []) as Region[];

export function getRegions(): Region[] {
  return REGIONS;
}

export function getRegion(regionId: string): Region | undefined {
  return REGIONS.find((r) => r.id === regionId);
}

export function getDefaultRegion(): Region {
  return getRegion('india') ?? REGIONS[0];
}

export function getCrops(regionId: string): Crop[] {
  return getRegion(regionId)?.crops ?? [];
}

export function getCrop(regionId: string, cropId: string): Crop | undefined {
  return getCrops(regionId).find((c) => c.id === cropId);
}

export function getDiseases(regionId: string): Disease[] {
  return getRegion(regionId)?.diseases ?? [];
}

export function getDisease(regionId: string, diseaseId: string): Disease | undefined {
  return getDiseases(regionId).find((d) => d.id === diseaseId);
}

export function getDiseasesForCrop(regionId: string, cropId: string): Disease[] {
  return getDiseases(regionId).filter((d) => d.cropIds.includes(cropId));
}

export function getLanguages(regionId: string) {
  return getRegion(regionId)?.languages ?? [{ code: 'en', name: 'English', nativeName: 'English' }];
}

/** Localised crop/disease name with graceful fallback to English/base name. */
export function localName(
  entity: { name: string; localNames?: Record<string, string> } | undefined,
  lang: string,
): string {
  if (!entity) return '';
  return entity.localNames?.[lang] || entity.localNames?.en || entity.name;
}

/** Render a disease treatmentTemplate with {disease}/{crop}/{region} filled in. */
export function renderTreatment(
  disease: Disease,
  opts: { cropName?: string; regionName?: string } = {},
): string {
  const tpl =
    disease.treatmentTemplate ||
    `Consult a local agricultural extension officer for confirmed diagnosis and locally approved treatment of ${disease.name}.`;
  return tpl
    .replace(/\{disease\}/g, disease.name)
    .replace(/\{crop\}/g, opts.cropName ?? 'the crop')
    .replace(/\{region\}/g, opts.regionName ?? 'your region');
}
