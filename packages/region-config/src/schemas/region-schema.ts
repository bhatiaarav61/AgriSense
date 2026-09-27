import { z } from 'zod';

/**
 * AgriSense Region Configuration Schema
 * Defines the complete configuration for a region including crops, diseases,
 * weather sources, languages, API keys, and prompt templates.
 */

// Base schemas
export const LanguageSchema = z.object({
  code: z.string().length(2), // ISO 639-1
  name: z.string(),
  nativeName: z.string(),
  rtl: z.boolean().default(false),
});

export const CropSchema = z.object({
  id: z.string(),
  name: z.string(),
  scientificName: z.string(),
  localNames: z.record(z.string()), // language_code -> local name
  growingSeasons: z.array(z.string()), // e.g., ["kharif", "rabi", "zaid"]
  diseaseClasses: z.array(z.string()), // references to disease IDs
  icon: z.string().optional(), // emoji or icon identifier
  color: z.string().optional(), // hex color for UI
});

export const DiseaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  scientificName: z.string(),
  cropIds: z.array(z.string()), // which crops this affects
  symptoms: z.array(z.string()),
  localNames: z.record(z.string()), // language_code -> local name
  severityLevels: z.array(z.enum(['low', 'medium', 'high'])),
  treatmentTemplate: z.string(), // advisory template with {disease}, {crop}, {region} placeholders
  preventiveMeasures: z.array(z.string()),
  imageTags: z.array(z.string()).optional(), // for training data filtering
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
});

export const WeatherSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['open-meteo', 'sentinel-hub', 'nasa-power', 'custom']),
  baseUrl: z.string().url(),
  apiKeyEnvVar: z.string().optional(), // environment variable name for API key
  rateLimit: z.object({
    requestsPerMinute: z.number().default(60),
    requestsPerDay: z.number().default(10000),
  }).optional(),
  parameters: z.record(z.string()).optional(), // provider-specific params
});

export const SatelliteSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['sentinel-2', 'landsat-8', 'modis', 'custom']),
  baseUrl: z.string().url(),
  apiKeyEnvVar: z.string().optional(),
  bands: z.array(z.string()), // e.g., ["B02", "B03", "B04", "B08"]
  resolution: z.number(), // meters per pixel
  revisitDays: z.number(),
  cloudCoverThreshold: z.number().min(0).max(100).default(30),
});

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['gemini', 'groq', 'huggingface', 'together', 'openrouter', 'custom']),
  baseUrl: z.string().url().optional(),
  apiKeyEnvVar: z.string(),
  models: z.record(z.object({
    id: z.string(),
    taskTypes: z.array(z.enum(['disease-detection', 'yield-prediction', 'advisory', 'chat'])),
    maxTokens: z.number().optional(),
    temperature: z.number().min(0).max(2).optional(),
    costPer1kTokens: z.number().optional(),
  })),
  rateLimit: z.object({
    requestsPerMinute: z.number(),
    requestsPerDay: z.number(),
    tokensPerMinute: z.number().optional(),
  }),
  regions: z.array(z.string()), // region IDs this provider serves
  priority: z.number().default(0), // higher = preferred
  enabled: z.boolean().default(true),
});

export const PromptTemplateSchema = z.object({
  id: z.string(),
  taskType: z.enum(['disease-detection', 'yield-prediction', 'advisory', 'chat']),
  language: z.string().length(2),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(), // with {variables} placeholders
  fewShotExamples: z.array(z.object({
    input: z.string(),
    output: z.string(),
  })).optional(),
  outputFormat: z.enum(['json', 'text', 'structured']).default('json'),
});

export const RegionConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.record(z.string()), // language_code -> display name
  isoCode: z.string().length(2), // ISO 3166-1 alpha-2
  timezone: z.string(), // IANA timezone
  languages: z.array(LanguageSchema),
  defaultLanguage: z.string().length(2),
  currency: z.string().length(3), // ISO 4217
  coordinates: z.object({
    latMin: z.number(),
    latMax: z.number(),
    lonMin: z.number(),
    lonMax: z.number(),
  }),
  crops: z.array(CropSchema),
  diseases: z.array(DiseaseSchema),
  weatherSources: z.array(WeatherSourceSchema),
  satelliteSources: z.array(SatelliteSourceSchema),
  providers: z.array(ProviderSchema),
  promptTemplates: z.array(PromptTemplateSchema),
  modelConfig: z.object({
    edgeModelVersion: z.string(),
    edgeModelUrl: z.string().url(), // CDN URL for TFLite/CoreML model
    edgeModelHash: z.string(), // SHA256 for integrity
    inputSize: z.number().default(224),
    confidenceThreshold: z.number().min(0).max(1).default(0.7),
    topK: z.number().default(5),
  }),
  caching: z.object({
    diseaseDetectionTtlSeconds: z.number().default(3600),
    yieldPredictionTtlSeconds: z.number().default(86400),
    weatherTtlSeconds: z.number().default(1800),
    satelliteTtlSeconds: z.number().default(43200),
  }).optional(),
  metadata: z.object({
    version: z.string(),
    lastUpdated: z.string().datetime(),
    maintainer: z.string(),
    notes: z.string().optional(),
  }),
});

// Type exports
export type Language = z.infer<typeof LanguageSchema>;
export type Crop = z.infer<typeof CropSchema>;
export type Disease = z.infer<typeof DiseaseSchema>;
export type WeatherSource = z.infer<typeof WeatherSourceSchema>;
export type SatelliteSource = z.infer<typeof SatelliteSourceSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type RegionConfig = z.infer<typeof RegionConfigSchema>;

// Validation function
export function validateRegionConfig(config: unknown): RegionConfig {
  return RegionConfigSchema.parse(config);
}

export function safeValidateRegionConfig(config: unknown): { success: boolean; data?: RegionConfig; error?: z.ZodError } {
  const result = RegionConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Utility: Get all disease IDs for a crop
export function getDiseasesForCrop(region: RegionConfig, cropId: string): Disease[] {
  return region.diseases.filter(d => d.cropIds.includes(cropId));
}

// Utility: Get crops for a region
export function getCropsForRegion(region: RegionConfig): Crop[] {
  return region.crops;
}

// Utility: Get enabled providers for a task in a region
export function getProvidersForTask(region: RegionConfig, taskType: Provider['models'][string]['taskTypes'][number]): Provider[] {
  return region.providers
    .filter(p => p.enabled)
    .filter(p => p.regions.includes(region.id))
    .filter(p => Object.values(p.models).some(m => m.taskTypes.includes(taskType)))
    .sort((a, b) => b.priority - a.priority);
}

// Utility: Get prompt template for task and language
export function getPromptTemplate(region: RegionConfig, taskType: PromptTemplate['taskType'], language: string): PromptTemplate | undefined {
  return region.promptTemplates.find(
    t => t.taskType === taskType && t.language === language
  );
}