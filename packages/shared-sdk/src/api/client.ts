/**
 * AgriSense Shared SDK - API Client
 * Type-safe client for interacting with AgriSense API
 */

import { z } from 'zod';

// Base URL configuration
let API_BASE_URL = 'http://localhost:8000';

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// Response schemas
export const DiseaseResultSchema = z.object({
  disease_id: z.string(),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['edge', 'cloud', 'hybrid']),
  symptoms: z.array(z.string()),
  treatment: z.string(),
  local_names: z.record(z.string()),
});

export const YieldPredictionSchema = z.object({
  yield_min: z.number(),
  yield_max: z.number(),
  yield_expected: z.number(),
  confidence: z.number().min(0).max(1),
  key_drivers: z.array(z.string()),
  explanation: z.string(),
  model_version: z.string(),
});

export const AdvisorySchema = z.object({
  disease_id: z.string(),
  crop_id: z.string(),
  region_id: z.string(),
  language: z.string(),
  severity: z.string(),
  treatment: z.string(),
  preventive_measures: z.array(z.string()),
  local_names: z.record(z.string()),
  follow_up: z.string(),
  safety_warnings: z.array(z.string()),
});

export const WeatherDataSchema = z.object({
  location: z.object({
    lat: z.number(),
    lon: z.number(),
  }),
  current: z.object({
    temperature: z.number(),
    humidity: z.number(),
    precipitation: z.number(),
    wind_speed: z.number(),
    condition: z.string(),
  }),
  forecast: z.array(z.object({
    date: z.string(),
    temperature_min: z.number(),
    temperature_max: z.number(),
    precipitation: z.number(),
    humidity: z.number(),
    condition: z.string(),
  })),
  satellite: z.object({
    ndvi: z.number(),
    evi: z.number(),
    lai: z.number(),
    timestamp: z.string(),
  }).optional(),
});

export const CropSchema = z.object({
  id: z.string(),
  name: z.string(),
  scientificName: z.string(),
  localNames: z.record(z.string()),
  growingSeasons: z.array(z.string()),
  diseaseClasses: z.array(z.string()),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const DiseaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  scientificName: z.string(),
  cropIds: z.array(z.string()),
  symptoms: z.array(z.string()),
  localNames: z.record(z.string()),
  severityLevels: z.array(z.string()),
  treatmentTemplate: z.string(),
  preventiveMeasures: z.array(z.string()),
  imageTags: z.array(z.string()).optional(),
  confidenceThreshold: z.number().optional(),
});

// Type exports
export type DiseaseResult = z.infer<typeof DiseaseResultSchema>;
export type YieldPrediction = z.infer<typeof YieldPredictionSchema>;
export type Advisory = z.infer<typeof AdvisorySchema>;
export type WeatherData = z.infer<typeof WeatherDataSchema>;
export type Crop = z.infer<typeof CropSchema>;
export type Disease = z.infer<typeof DiseaseSchema>;

// Request types
export interface DetectRequest {
  image: File | Blob | string; // File, Blob, or base64 string
  crop_id: string;
  region_id: string;
  location?: { lat: number; lon: number };
}

export interface PredictYieldRequest {
  field_id: string;
  crop_id: string;
  region_id: string;
  season: string;
  area_hectares?: number;
  planting_date?: string; // YYYY-MM-DD
  location: { lat: number; lon: number };
  irrigation?: 'rainfed' | 'irrigated' | 'partial';
}

export interface AdvisoryRequest {
  disease_id: string;
  crop_id: string;
  region_id: string;
  language?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface WeatherRequest {
  lat: number;
  lon: number;
  days?: number;
}

// Error class
export class AgriSenseError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AgriSenseError';
  }
}

// HTTP client with error handling
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  responseSchema?: z.ZodSchema<T>
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new AgriSenseError(
      data.error || `HTTP ${response.status}`,
      response.status,
      data.code,
      data.details
    );
  }

  if (responseSchema) {
    const result = responseSchema.safeParse(data);
    if (!result.success) {
      throw new AgriSenseError('Invalid response format', 500, 'INVALID_RESPONSE', result.error.errors);
    }
    return result.data;
  }

  return data as T;
}

/**
 * Detect crop disease from image
 */
export async function detectDisease(request: DetectRequest): Promise<DiseaseResult> {
  const formData = new FormData();

  // Handle image input
  if (typeof request.image === 'string') {
    // Base64 string - convert to blob
    const base64 = request.image.replace(/^data:image\/[a-z]+;base64,/, '');
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    formData.append('image', blob, 'image.jpg');
  } else if (request.image instanceof File) {
    formData.append('image', request.image);
  } else if (request.image instanceof Blob) {
    formData.append('image', request.image, 'image.jpg');
  }

  formData.append('crop_id', request.crop_id);
  formData.append('region_id', request.region_id);
  if (request.location) {
    formData.append('location', JSON.stringify(request.location));
  }

  return apiFetch<DiseaseResult>('/v1/detect', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  }, DiseaseResultSchema);
}

/**
 * Predict yield for a field
 */
export async function predictYield(request: PredictYieldRequest): Promise<YieldPrediction> {
  return apiFetch<YieldPrediction>('/v1/predict-yield', {
    method: 'POST',
    body: JSON.stringify(request),
  }, YieldPredictionSchema);
}

/**
 * Get treatment advisory for a disease
 */
export async function getAdvisory(request: AdvisoryRequest): Promise<Advisory> {
  return apiFetch<Advisory>('/v1/advisory', {
    method: 'POST',
    body: JSON.stringify({
      ...request,
      language: request.language || 'en',
      severity: request.severity || 'medium',
    }),
  }, AdvisorySchema);
}

/**
 * Get weather and satellite data for a location
 */
export async function getWeather(request: WeatherRequest): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(request.lat),
    lon: String(request.lon),
    days: String(request.days || 7),
  });

  return apiFetch<WeatherData>(`/v1/weather?${params}`, {
    method: 'GET',
  }, WeatherDataSchema);
}

/**
 * Get supported crops for a region
 */
export async function getCrops(regionId: string): Promise<Crop[]> {
  return apiFetch<Crop[]>(`/v1/crops/${regionId}`, {
    method: 'GET',
  }, z.array(CropSchema));
}

/**
 * Get diseases for a region (optionally filtered by crop)
 */
export async function getDiseases(regionId: string, cropId?: string): Promise<Disease[]> {
  const params = cropId ? `?crop_id=${cropId}` : '';
  return apiFetch<Disease[]>(`/v1/diseases/${regionId}${params}`, {
    method: 'GET',
  }, z.array(DiseaseSchema));
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string; version: string; regions: string[] }> {
  return apiFetch('/health', { method: 'GET' });
}