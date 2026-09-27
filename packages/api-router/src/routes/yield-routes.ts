/**
 * Yield Prediction API Routes
 * POST /v1/predict-yield - Predict yield for field(s)
 * GET /v1/weather - Get weather + satellite data for location
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { regionRegistry } from '@agrisense/region-config';
import { ProviderRouter, AdapterRequest } from '../adapters';

// Request schemas
const PredictYieldRequestSchema = z.object({
  field_id: z.string(),
  crop_id: z.string(),
  region_id: z.string(),
  season: z.string(),
  area_hectares: z.number().positive().optional(),
  planting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  location: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
  }),
  irrigation: z.enum(['rainfed', 'irrigated', 'partial']).optional(),
});

const WeatherRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  days: z.number().int().positive().max(30).default(7),
});

type PredictYieldRequest = z.infer<typeof PredictYieldRequestSchema>;
type WeatherRequest = z.infer<typeof WeatherRequestSchema>;

interface YieldPrediction {
  yield_min: number;
  yield_max: number;
  yield_expected: number;
  confidence: number;
  key_drivers: string[];
  explanation: string;
  model_version: string;
}

interface WeatherData {
  location: { lat: number; lon: number };
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
    wind_speed: number;
    condition: string;
  };
  forecast: Array<{
    date: string;
    temperature_min: number;
    temperature_max: number;
    precipitation: number;
    humidity: number;
    condition: string;
  }>;
  satellite?: {
    ndvi: number;
    evi: number;
    lai: number;
    timestamp: string;
  };
}

export async function yieldRoutes(fastify: FastifyInstance) {
  // POST /v1/predict-yield
  fastify.post<{
    Body: PredictYieldRequest;
  }>('/predict-yield', {
    schema: {
      tags: ['Yield Prediction'],
      summary: 'Predict yield for field(s)',
      body: {
        type: 'object',
        required: ['field_id', 'crop_id', 'region_id', 'season', 'location'],
        properties: {
          field_id: { type: 'string' },
          crop_id: { type: 'string' },
          region_id: { type: 'string' },
          season: { type: 'string' },
          area_hectares: { type: 'number' },
          planting_date: { type: 'string', format: 'date' },
          location: {
            type: 'object',
            required: ['lat', 'lon'],
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
            },
          },
          irrigation: { type: 'string', enum: ['rainfed', 'irrigated', 'partial'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            yield_min: { type: 'number' },
            yield_max: { type: 'number' },
            yield_expected: { type: 'number' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            key_drivers: { type: 'array', items: { type: 'string' } },
            explanation: { type: 'string' },
            model_version: { type: 'string' },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        500: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = PredictYieldRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      const req = validation.data;

      // Validate region
      const region = regionRegistry.getRegion(req.region_id);
      if (!region) {
        return reply.code(404).send({ error: `Region not found: ${req.region_id}` });
      }

      // Validate crop
      const crop = regionRegistry.getCrop(req.region_id, req.crop_id);
      if (!crop) {
        return reply.code(404).send({ error: `Crop not found in region: ${req.crop_id}` });
      }

      // Get providers for yield prediction
      const providers = regionRegistry.getProvidersForTask(req.region_id, 'yield-prediction');
      if (providers.length === 0) {
        return reply.code(503).send({ error: 'No yield prediction providers available for this region' });
      }

      const router = new ProviderRouter(req.region_id, providers);

      // Fetch weather data for the location
      const weatherData = await fetchWeatherData(req.location.lat, req.location.lon, 30);

      // Get prompt template
      const promptTemplate = regionRegistry.getPromptTemplate(req.region_id, 'yield-prediction', region.defaultLanguage);
      const systemPrompt = promptTemplate?.systemPrompt ||
        `You are an expert agricultural economist and crop scientist. Predict crop yield based on weather, satellite, and field data.
         Respond with JSON only: { "yield_min": 0, "yield_max": 0, "yield_expected": 0, "confidence": 0.0-1.0, "key_drivers": [...], "explanation": "..." }`;

      const userPrompt = promptTemplate?.userPromptTemplate
        ? promptTemplate.userPromptTemplate
            .replace('{crop}', crop.name)
            .replace('{region}', region.name)
            .replace('{season}', req.season)
            .replace('{area}', String(req.area_hectares || 1))
            .replace('{irrigation}', req.irrigation || 'rainfed')
            .replace('{weather}', JSON.stringify(weatherData))
        : `Predict yield for ${crop.name} in ${region.name}, season ${req.season}.
           Field: ${req.field_id}, Area: ${req.area_hectares || 1} ha, Irrigation: ${req.irrigation || 'rainfed'}
           Weather data: ${JSON.stringify(weatherData)}`;

      const adapterRequest: AdapterRequest = {
        taskType: 'yield-prediction',
        prompt: userPrompt,
        systemPrompt,
        temperature: 0.4,
        maxTokens: 1536,
      };

      const response = await router.execute(adapterRequest);

      // Parse AI response
      let result: YieldPrediction;
      try {
        const parsed = JSON.parse(response.content);
        result = {
          yield_min: Math.max(0, parsed.yield_min || 0),
          yield_max: Math.max(0, parsed.yield_max || 0),
          yield_expected: Math.max(0, parsed.yield_expected || 0),
          confidence: Math.min(Math.max(parsed.confidence || 0.7, 0), 1),
          key_drivers: parsed.key_drivers || ['Weather conditions', 'Soil health', 'Management practices'],
          explanation: parsed.explanation || 'Yield prediction based on current conditions.',
          model_version: response.model,
        };
      } catch (parseError) {
        // Fallback prediction based on regional averages
        const baseYield = getBaseYieldForCrop(region, crop.id);
        result = {
          yield_min: baseYield * 0.7,
          yield_max: baseYield * 1.3,
          yield_expected: baseYield,
          confidence: 0.6,
          key_drivers: ['Regional historical average', 'Current weather trends'],
          explanation: `Estimated yield based on ${region.name} historical data for ${crop.name}.`,
          model_version: 'fallback-v1',
        };
      }

      return reply.code(200).send(result);

    } catch (error) {
      request.log.error(error, 'Yield prediction failed');
      return reply.code(500).send({ error: 'Yield prediction failed', message: (error as Error).message });
    }
  });

  // GET /v1/weather - Get weather + satellite data
  fastify.get<{
    Querystring: WeatherRequest;
  }>('/weather', {
    schema: {
      tags: ['Yield Prediction'],
      summary: 'Get weather + satellite data for location',
      querystring: {
        type: 'object',
        required: ['lat', 'lon'],
        properties: {
          lat: { type: 'number' },
          lon: { type: 'number' },
          days: { type: 'integer', default: 7 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            location: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lon: { type: 'number' },
              },
            },
            current: {
              type: 'object',
              properties: {
                temperature: { type: 'number' },
                humidity: { type: 'number' },
                precipitation: { type: 'number' },
                wind_speed: { type: 'number' },
                condition: { type: 'string' },
              },
            },
            forecast: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  temperature_min: { type: 'number' },
                  temperature_max: { type: 'number' },
                  precipitation: { type: 'number' },
                  humidity: { type: 'number' },
                  condition: { type: 'string' },
                },
              },
            },
            satellite: {
              type: 'object',
              properties: {
                ndvi: { type: 'number' },
                evi: { type: 'number' },
                lai: { type: 'number' },
                timestamp: { type: 'string' },
              },
            },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        500: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const validation = WeatherRequestSchema.safeParse(request.query);
    if (!validation.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: validation.error.errors });
    }

    const { lat, lon, days } = validation.data;

    try {
      const weatherData = await fetchWeatherData(lat, lon, days);
      return reply.code(200).send(weatherData);
    } catch (error) {
      request.log.error(error, 'Weather fetch failed');
      return reply.code(500).send({ error: 'Failed to fetch weather data', message: (error as Error).message });
    }
  });
}

/**
 * Fetch weather data from configured sources
 */
async function fetchWeatherData(lat: number, lon: number, days: number): Promise<WeatherData> {
  // In production, this would use the region's configured weather sources
  // For now, use Open-Meteo as default free source

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean,weather_code` +
    `&forecast_days=${days}&timezone=auto`
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  // Map weather codes to conditions
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain', 66: 'Light freezing rain',
    67: 'Heavy freezing rain', 71: 'Slight snow fall', 73: 'Moderate snow fall',
    75: 'Heavy snow fall', 77: 'Snow grains', 80: 'Slight rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 85: 'Slight snow showers',
    86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  const current = data.current || {};
  const daily = data.daily || {};

  return {
    location: { lat, lon },
    current: {
      temperature: current.temperature_2m || 0,
      humidity: current.relative_humidity_2m || 0,
      precipitation: current.precipitation || 0,
      wind_speed: current.wind_speed_10m || 0,
      condition: weatherCodes[current.weather_code] || 'Unknown',
    },
    forecast: (daily.time || []).map((date: string, i: number) => ({
      date,
      temperature_min: daily.temperature_2m_min?.[i] || 0,
      temperature_max: daily.temperature_2m_max?.[i] || 0,
      precipitation: daily.precipitation_sum?.[i] || 0,
      humidity: daily.relative_humidity_2m_mean?.[i] || 0,
      condition: weatherCodes[daily.weather_code?.[i]] || 'Unknown',
    })),
    satellite: undefined, // Would fetch from Sentinel Hub in production
  };
}

/**
 * Get base yield for a crop in a region (fallback)
 */
function getBaseYieldForCrop(region: any, cropId: string): number {
  // Regional base yields (tons/hectare) - would come from config in production
  const baseYields: Record<string, Record<string, number>> = {
    india: {
      rice: 4.0,
      wheat: 3.5,
      maize: 2.8,
      cotton: 1.5,
      sugarcane: 70.0,
    },
    kenya: {
      maize: 2.0,
      beans: 1.2,
      coffee: 0.8,
      tea: 2.5,
    },
    brazil: {
      soybean: 3.3,
      maize: 5.5,
      coffee: 1.5,
      sugarcane: 75.0,
    },
  };

  return baseYields[region.id]?.[cropId] || 3.0;
}