import { describe, it, expect } from 'vitest';
import {
  RegionConfigSchema,
  CropSchema,
  DiseaseSchema,
  ProviderSchema,
  validateRegionConfig,
  safeValidateRegionConfig,
  getDiseasesForCrop,
  getProvidersForTask,
  getPromptTemplate,
} from './schema';

describe('Region Config Schema', () => {
  const validRegionConfig = {
    id: 'test',
    name: 'Test Region',
    displayName: { en: 'Test Region' },
    isoCode: 'TZ',
    timezone: 'UTC',
    languages: [
      { code: 'en', name: 'English', nativeName: 'English', rtl: false },
    ],
    defaultLanguage: 'en',
    currency: 'USD',
    coordinates: { latMin: -10, latMax: 10, lonMin: 30, lonMax: 40 },
    crops: [
      {
        id: 'maize',
        name: 'Maize',
        scientificName: 'Zea mays',
        localNames: { en: 'Maize' },
        growingSeasons: ['main'],
        diseaseClasses: ['fall_armyworm'],
        icon: '🌽',
        color: '#8B5CF6',
      },
    ],
    diseases: [
      {
        id: 'fall_armyworm',
        name: 'Fall Armyworm',
        scientificName: 'Spodoptera frugiperda',
        cropIds: ['maize'],
        symptoms: ['Ragged holes in leaves', 'Frass in whorl'],
        localNames: { en: 'Fall Armyworm' },
        severityLevels: ['medium', 'high'],
        treatmentTemplate: 'Apply emamectin benzoate for {disease} in {crop}',
        preventiveMeasures: ['Early planting', 'Intercrop with legumes'],
        imageTags: ['fall_armyworm'],
        confidenceThreshold: 0.8,
      },
    ],
    weatherSources: [
      {
        id: 'open-meteo',
        name: 'Open-Meteo',
        type: 'open-meteo',
        baseUrl: 'https://api.open-meteo.com/v1',
        rateLimit: { requestsPerMinute: 60, requestsPerDay: 10000 },
      },
    ],
    satelliteSources: [
      {
        id: 'sentinel-2',
        name: 'Sentinel-2',
        type: 'sentinel-2',
        baseUrl: 'https://services.sentinel-hub.com',
        bands: ['B02', 'B03', 'B04', 'B08'],
        resolution: 10,
        revisitDays: 5,
        cloudCoverThreshold: 30,
      },
    ],
    providers: [
      {
        id: 'gemini',
        name: 'Google Gemini',
        type: 'gemini',
        apiKeyEnvVar: 'GEMINI_API_KEY',
        models: {
          'gemini-1.5-flash': {
            id: 'gemini-1.5-flash',
            taskTypes: ['disease-detection', 'yield-prediction', 'advisory', 'chat'],
            maxTokens: 8192,
            temperature: 0.4,
            costPer1kTokens: 0,
          },
        },
        rateLimit: { requestsPerMinute: 60, requestsPerDay: 1500 },
        regions: ['test'],
        priority: 100,
        enabled: true,
      },
    ],
    promptTemplates: [
      {
        id: 'disease-detection-en',
        taskType: 'disease-detection',
        language: 'en',
        systemPrompt: 'You are a plant pathologist.',
        userPromptTemplate: 'Identify disease in {crop}.',
        outputFormat: 'json',
      },
    ],
    modelConfig: {
      edgeModelVersion: 'v1.0.0',
      edgeModelUrl: 'https://cdn.example.com/model.tflite',
      edgeModelHash: 'sha256:abc123',
      inputSize: 224,
      confidenceThreshold: 0.7,
      topK: 5,
    },
    caching: {
      diseaseDetectionTtlSeconds: 3600,
      yieldPredictionTtlSeconds: 86400,
      weatherTtlSeconds: 1800,
      satelliteTtlSeconds: 43200,
    },
    metadata: {
      version: '1.0.0',
      lastUpdated: '2024-01-15T10:00:00Z',
      maintainer: 'Test Team',
    },
  };

  describe('validateRegionConfig', () => {
    it('should validate a complete valid config', () => {
      const result = validateRegionConfig(validRegionConfig);
      expect(result.id).toBe('test');
      expect(result.crops).toHaveLength(1);
      expect(result.diseases).toHaveLength(1);
    });

    it('should reject config missing required fields', () => {
      const invalid = { ...validRegionConfig };
      delete (invalid as any).id;
      expect(() => validateRegionConfig(invalid)).toThrow();
    });

    it('should reject config with invalid crop structure', () => {
      const invalid = {
        ...validRegionConfig,
        crops: [{ id: 'maize' }], // missing required fields
      };
      expect(() => validateRegionConfig(invalid)).toThrow();
    });

    it('should reject config with invalid disease structure', () => {
      const invalid = {
        ...validRegionConfig,
        diseases: [{ id: 'fall_armyworm' }], // missing required fields
      };
      expect(() => validateRegionConfig(invalid)).toThrow();
    });

    it('should reject config with invalid provider structure', () => {
      const invalid = {
        ...validRegionConfig,
        providers: [{ id: 'gemini' }], // missing required fields
      };
      expect(() => validateRegionConfig(invalid)).toThrow();
    });
  });

  describe('safeValidateRegionConfig', () => {
    it('should return success for valid config', () => {
      const result = safeValidateRegionConfig(validRegionConfig);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for invalid config', () => {
      const result = safeValidateRegionConfig({ id: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('CropSchema', () => {
    it('should validate a valid crop', () => {
      const crop = validRegionConfig.crops[0];
      const result = CropSchema.safeParse(crop);
      expect(result.success).toBe(true);
    });

    it('should require growingSeasons array', () => {
      const crop = { ...validRegionConfig.crops[0] };
      delete (crop as any).growingSeasons;
      const result = CropSchema.safeParse(crop);
      expect(result.success).toBe(false);
    });
  });

  describe('DiseaseSchema', () => {
    it('should validate a valid disease', () => {
      const disease = validRegionConfig.diseases[0];
      const result = DiseaseSchema.safeParse(disease);
      expect(result.success).toBe(true);
    });

    it('should require cropIds array', () => {
      const disease = { ...validRegionConfig.diseases[0] };
      delete (disease as any).cropIds;
      const result = DiseaseSchema.safeParse(disease);
      expect(result.success).toBe(false);
    });

    it('should validate confidenceThreshold range', () => {
      const disease = { ...validRegionConfig.diseases[0], confidenceThreshold: 1.5 };
      const result = DiseaseSchema.safeParse(disease);
      expect(result.success).toBe(false);
    });
  });

  describe('ProviderSchema', () => {
    it('should validate a valid provider', () => {
      const provider = validRegionConfig.providers[0];
      const result = ProviderSchema.safeParse(provider);
      expect(result.success).toBe(true);
    });

    it('should require models object', () => {
      const provider = { ...validRegionConfig.providers[0] };
      delete (provider as any).models;
      const result = ProviderSchema.safeParse(provider);
      expect(result.success).toBe(false);
    });
  });

  describe('Utility functions', () => {
    const region = validateRegionConfig(validRegionConfig);

    it('getDiseasesForCrop should return diseases for a crop', () => {
      const diseases = getDiseasesForCrop(region, 'maize');
      expect(diseases).toHaveLength(1);
      expect(diseases[0].id).toBe('fall_armyworm');
    });

    it('getDiseasesForCrop should return empty for unknown crop', () => {
      const diseases = getDiseasesForCrop(region, 'unknown');
      expect(diseases).toHaveLength(0);
    });

    it('getProvidersForTask should return providers for task', () => {
      const providers = getProvidersForTask(region, 'disease-detection');
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('gemini');
    });

    it('getProvidersForTask should return empty for unsupported task', () => {
      const providers = getProvidersForTask(region, 'unsupported-task' as any);
      expect(providers).toHaveLength(0);
    });

    it('getPromptTemplate should return template for task and language', () => {
      const template = getPromptTemplate(region, 'disease-detection', 'en');
      expect(template).toBeDefined();
      expect(template?.id).toBe('disease-detection-en');
    });

    it('getPromptTemplate should return undefined for missing language', () => {
      const template = getPromptTemplate(region, 'disease-detection', 'fr');
      expect(template).toBeUndefined();
    });
  });
});