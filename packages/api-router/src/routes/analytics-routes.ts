/**
 * Analytics API Routes
 * Provides insights on disease trends, yield accuracy, provider performance, and regional stats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { regionRegistry } from '@agrisense/region-config';
import { metricsService } from '../services/metrics';
import { circuitBreakerRegistry } from '../services/circuit-breaker';
import { cacheService } from '../services/cache';

// Query schemas
const DateRangeQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  region_id: z.string().optional(),
  crop_id: z.string().optional(),
});

const DiseaseTrendsQuerySchema = DateRangeQuerySchema.extend({
  disease_id: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  interval: z.enum(['day', 'week', 'month']).default('week'),
});

const YieldAccuracyQuerySchema = DateRangeQuerySchema.extend({
  season: z.string().optional(),
  model_version: z.string().optional(),
});

const ProviderPerformanceQuerySchema = DateRangeQuerySchema.extend({
  provider_id: z.string().optional(),
  task_type: z.enum(['disease-detection', 'yield-prediction', 'advisory', 'chat']).optional(),
});

const RegionalStatsQuerySchema = z.object({
  region_id: z.string().optional(),
  include_historical: z.boolean().default(false),
});

const FarmerEngagementQuerySchema = DateRangeQuerySchema.extend({
  region_id: z.string().optional(),
  metric: z.enum(['scans', 'alerts', 'advisories', 'yield_predictions', 'all']).default('all'),
});

export async function analyticsRoutes(fastify: FastifyInstance) {
  // GET /v1/analytics/overview
  fastify.get('/analytics/overview', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get platform overview metrics',
      querystring: DateRangeQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            total_farmers: { type: 'number' },
            total_fields: { type: 'number' },
            total_scans: { type: 'number' },
            total_yield_predictions: { type: 'number' },
            total_advisories: { type: 'number' },
            active_regions: { type: 'number' },
            disease_alerts_24h: { type: 'number' },
            provider_health: { type: 'string' },
            cache_hit_rate: { type: 'number' },
            avg_response_time_ms: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = DateRangeQuerySchema.parse(request.query);

    // Get metrics from services
    const metrics = await metricsService.getMetricsAsJson();
    const cacheStats = cacheService.getStats();
    const breakerStatus = circuitBreakerRegistry.getHealthStatus();

    // Calculate overview
    const regions = regionRegistry.getAllRegions();
    let totalProviders = 0;
    let enabledProviders = 0;

    for (const region of regions) {
      for (const taskType of ['disease-detection', 'yield-prediction', 'advisory'] as const) {
        const providers = regionRegistry.getProvidersForTask(region.id, taskType);
        totalProviders += providers.length;
        enabledProviders += providers.filter(p => p.enabled).length;
      }
    }

    return reply.code(200).send({
      total_farmers: 125000, // Would come from database
      total_fields: 45000,
      total_scans: 2500000,
      total_yield_predictions: 180000,
      total_advisories: 320000,
      active_regions: regions.length,
      disease_alerts_24h: 23,
      provider_health: enabledProviders === totalProviders ? 'healthy' : enabledProviders > 0 ? 'degraded' : 'critical',
      cache_hit_rate: cacheStats.hitRate,
      avg_response_time_ms: 245,
      regions_covered: regions.map(r => r.id),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /v1/analytics/disease-trends
  fastify.get('/analytics/disease-trends', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get disease outbreak trends over time',
      querystring: DiseaseTrendsQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            trends: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  disease_id: { type: 'string' },
                  disease_name: { type: 'string' },
                  count: { type: 'number' },
                  severity_distribution: {
                    type: 'object',
                    properties: {
                      low: { type: 'number' },
                      medium: { type: 'number' },
                      high: { type: 'number' },
                    },
                  },
                  affected_regions: { type: 'number' },
                  affected_farmers: { type: 'number' },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                total_outbreaks: { type: 'number' },
                top_diseases: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      disease_id: { type: 'string' },
                      disease_name: { type: 'string' },
                      count: { type: 'number' },
                    },
                  },
                },
                trend_direction: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = DiseaseTrendsQuerySchema.parse(request.query);

    // Generate mock trend data (would query database in production)
    const trends = generateDiseaseTrends(query);

    return reply.code(200).send({
      trends,
      summary: {
        total_outbreaks: trends.reduce((sum, t) => sum + t.count, 0),
        top_diseases: trends
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map(t => ({ disease_id: t.disease_id, disease_name: t.disease_name, count: t.count })),
        trend_direction: 'stable', // Would calculate from data
      },
      period: {
        start: query.start_date || '2024-01-01',
        end: query.end_date || new Date().toISOString().split('T')[0],
        interval: query.interval,
      },
    });
  });

  // GET /v1/analytics/yield-accuracy
  fastify.get('/analytics/yield-accuracy', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get yield prediction accuracy metrics',
      querystring: YieldAccuracyQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            accuracy_metrics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  region_id: { type: 'string' },
                  crop_id: { type: 'string' },
                  season: { type: 'string' },
                  model_version: { type: 'string' },
                  mae: { type: 'number' }, // Mean Absolute Error
                  rmse: { type: 'number' }, // Root Mean Square Error
                  mape: { type: 'number' }, // Mean Absolute Percentage Error
                  r2: { type: 'number' }, // R-squared
                  predictions_count: { type: 'number' },
                  within_10_percent: { type: 'number' },
                  within_20_percent: { type: 'number' },
                },
              },
            },
            overall: {
              type: 'object',
              properties: {
                avg_mae: { type: 'number' },
                avg_rmse: { type: 'number' },
                avg_mape: { type: 'number' },
                avg_r2: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = YieldAccuracyQuerySchema.parse(request.query);

    // Generate mock accuracy data
    const accuracyMetrics = generateYieldAccuracyMetrics(query);

    const overall = {
      avg_mae: accuracyMetrics.reduce((sum, m) => sum + m.mae, 0) / accuracyMetrics.length,
      avg_rmse: accuracyMetrics.reduce((sum, m) => sum + m.rmse, 0) / accuracyMetrics.length,
      avg_mape: accuracyMetrics.reduce((sum, m) => sum + m.mape, 0) / accuracyMetrics.length,
      avg_r2: accuracyMetrics.reduce((sum, m) => sum + m.r2, 0) / accuracyMetrics.length,
    };

    return reply.code(200).send({
      accuracy_metrics: accuracyMetrics,
      overall,
      filters: {
        season: query.season,
        model_version: query.model_version,
        period: {
          start: query.start_date,
          end: query.end_date,
        },
      },
    });
  });

  // GET /v1/analytics/provider-performance
  fastify.get('/analytics/provider-performance', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get AI provider performance metrics',
      querystring: ProviderPerformanceQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            providers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  provider_id: { type: 'string' },
                  provider_name: { type: 'string' },
                  task_type: { type: 'string' },
                  total_requests: { type: 'number' },
                  successful_requests: { type: 'number' },
                  failed_requests: { type: 'number' },
                  avg_latency_ms: { type: 'number' },
                  p50_latency_ms: { type: 'number' },
                  p95_latency_ms: { type: 'number' },
                  p99_latency_ms: { type: 'number' },
                  error_rate: { type: 'number' },
                  uptime_percent: { type: 'number' },
                  cost_per_1k_tokens: { type: 'number' },
                  tokens_used: { type: 'number' },
                  circuit_breaker_state: { type: 'string' },
                },
              },
            },
            circuit_breakers: {
              type: 'object',
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ProviderPerformanceQuerySchema.parse(request.query);

    // Get circuit breaker status
    const breakerStatus = circuitBreakerRegistry.getHealthStatus();

    // Generate provider performance data
    const providers = generateProviderPerformance(query);

    return reply.code(200).send({
      providers,
      circuit_breakers: breakerStatus,
      period: {
        start: query.start_date || '2024-01-01',
        end: query.end_date || new Date().toISOString().split('T')[0],
      },
    });
  });

  // GET /v1/analytics/regional-stats
  fastify.get('/analytics/regional-stats', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get regional statistics',
      querystring: RegionalStatsQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            regions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  region_id: { type: 'string' },
                  region_name: { type: 'string' },
                  total_farmers: { type: 'number' },
                  total_fields: { type: 'number' },
                  total_area_hectares: { type: 'number' },
                  crops_grown: { type: 'number' },
                  diseases_detected: { type: 'number' },
                  yield_predictions: { type: 'number' },
                  avg_yield_t_per_ha: { type: 'number' },
                  active_alerts: { type: 'number' },
                  weather_stations: { type: 'number' },
                  satellite_coverage_percent: { type: 'number' },
                  top_diseases: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        disease_id: { type: 'string' },
                        disease_name: { type: 'string' },
                        count: { type: 'number' },
                      },
                    },
                  },
                  top_crops: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        crop_id: { type: 'string' },
                        crop_name: { type: 'string' },
                        area_hectares: { type: 'number' },
                        farmers_count: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = RegionalStatsQuerySchema.parse(request.query);

    const regions = regionRegistry.getAllRegions();
    const filteredRegions = query.region_id
      ? regions.filter(r => r.id === query.region_id)
      : regions;

    const regionalStats = filteredRegions.map(region => generateRegionalStats(region, query.include_historical));

    return reply.code(200).send({
      regions: regionalStats,
      summary: {
        total_regions: regionalStats.length,
        total_farmers: regionalStats.reduce((sum, r) => sum + r.total_farmers, 0),
        total_fields: regionalStats.reduce((sum, r) => sum + r.total_fields, 0),
        total_area_hectares: regionalStats.reduce((sum, r) => sum + r.total_area_hectares, 0),
      },
    });
  });

  // GET /v1/analytics/farmer-engagement
  fastify.get('/analytics/farmer-engagement', {
    schema: {
      tags: ['Analytics'],
      summary: 'Get farmer engagement metrics',
      querystring: FarmerEngagementQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            engagement: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  period: { type: 'string' },
                  active_farmers: { type: 'number' },
                  new_farmers: { type: 'number' },
                  returning_farmers: { type: 'number' },
                  churned_farmers: { type: 'number' },
                  scans_per_farmer: { type: 'number' },
                  advisories_per_farmer: { type: 'number' },
                  yield_predictions_per_farmer: { type: 'number' },
                  avg_session_duration_minutes: { type: 'number' },
                  retention_rate_7d: { type: 'number' },
                  retention_rate_30d: { type: 'number' },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                total_active_farmers: { type: 'number' },
                avg_scans_per_farmer: { type: 'number' },
                avg_advisories_per_farmer: { type: 'number' },
                retention_7d: { type: 'number' },
                retention_30d: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = FarmerEngagementQuerySchema.parse(request.query);

    const engagement = generateFarmerEngagement(query);

    const summary = {
      total_active_farmers: engagement[engagement.length - 1]?.active_farmers || 0,
      avg_scans_per_farmer: engagement.reduce((sum, e) => sum + e.scans_per_farmer, 0) / engagement.length,
      avg_advisories_per_farmer: engagement.reduce((sum, e) => sum + e.advisories_per_farmer, 0) / engagement.length,
      retention_7d: engagement[engagement.length - 1]?.retention_rate_7d || 0,
      retention_30d: engagement[engagement.length - 1]?.retention_rate_30d || 0,
    };

    return reply.code(200).send({
      engagement,
      summary,
      period: {
        start: query.start_date || '2024-01-01',
        end: query.end_date || new Date().toISOString().split('T')[0],
      },
    });
  });
}

// Helper functions to generate mock data (replace with actual database queries)

function generateDiseaseTrends(query: any) {
  const diseases = [
    { id: 'bacterial_leaf_blight', name: 'Bacterial Leaf Blight' },
    { id: 'blast', name: 'Rice Blast' },
    { id: 'fall_armyworm', name: 'Fall Armyworm' },
    { id: 'yellow_rust', name: 'Yellow Rust' },
    { id: 'late_blight', name: 'Late Blight' },
  ];

  const regions = ['india', 'kenya', 'brazil', 'bangladesh', 'nigeria'];
  const interval = query.interval || 'week';

  return diseases.map(disease => ({
    period: interval === 'day' ? '2024-01-15' : interval === 'week' ? '2024-W03' : '2024-01',
    disease_id: disease.id,
    disease_name: disease.name,
    count: Math.floor(Math.random() * 500) + 50,
    severity_distribution: {
      low: Math.floor(Math.random() * 100),
      medium: Math.floor(Math.random() * 200),
      high: Math.floor(Math.random() * 50),
    },
    affected_regions: Math.floor(Math.random() * 5) + 1,
    affected_farmers: Math.floor(Math.random() * 1000) + 100,
  }));
}

function generateYieldAccuracyMetrics(query: any) {
  const regions = ['india', 'kenya', 'brazil', 'bangladesh', 'nigeria'];
  const crops = ['rice', 'wheat', 'maize', 'cotton', 'sugarcane', 'potato'];
  const seasons = ['kharif', 'rabi', 'zaid', 'summer', 'winter', 'annual'];
  const modelVersions = ['v1.0.0', 'v1.1.0', 'v1.2.0'];

  return regions.flatMap(region =>
    crops.flatMap(crop =>
      seasons.map(season => ({
        region_id: region,
        crop_id: crop,
        season,
        model_version: modelVersions[Math.floor(Math.random() * modelVersions.length)],
        mae: Math.random() * 0.5 + 0.2,
        rmse: Math.random() * 0.7 + 0.3,
        mape: Math.random() * 15 + 5,
        r2: Math.random() * 0.3 + 0.65,
        predictions_count: Math.floor(Math.random() * 1000) + 100,
        within_10_percent: Math.floor(Math.random() * 40) + 50,
        within_20_percent: Math.floor(Math.random() * 20) + 75,
      }))
  ).slice(0, 20);
}

function generateProviderPerformance(query: any) {
  const providers = [
    { id: 'gemini-1', name: 'Google Gemini', type: 'gemini' },
    { id: 'groq-1', name: 'Groq', type: 'groq' },
    { id: 'huggingface-1', name: 'Hugging Face', type: 'huggingface' },
    { id: 'together-1', name: 'Together.ai', type: 'together' },
    { id: 'openrouter-1', name: 'OpenRouter', type: 'openrouter' },
  ];

  const taskTypes = ['disease-detection', 'yield-prediction', 'advisory', 'chat'];

  return providers.flatMap(provider =>
    taskTypes.map(task => ({
      provider_id: provider.id,
      provider_name: provider.name,
      task_type: task,
      total_requests: Math.floor(Math.random() * 100000) + 1000,
      successful_requests: Math.floor(Math.random() * 95000) + 5000,
      failed_requests: Math.floor(Math.random() * 5000),
      avg_latency_ms: Math.floor(Math.random() * 500) + 100,
      p50_latency_ms: Math.floor(Math.random() * 400) + 80,
      p95_latency_ms: Math.floor(Math.random() * 1000) + 500,
      p99_latency_ms: Math.floor(Math.random() * 2000) + 1500,
      error_rate: Math.random() * 0.05,
      uptime_percent: 99.5 + Math.random() * 0.4,
      cost_per_1k_tokens: 0,
      tokens_used: Math.floor(Math.random() * 10000000) + 100000,
      circuit_breaker_state: Math.random() > 0.95 ? 'open' : Math.random() > 0.9 ? 'half_open' : 'closed',
    }))
  ).filter(p => !query.provider_id || p.provider_id === query.provider_id)
   .filter(p => !query.task_type || p.task_type === query.task_type);
}

function generateRegionalStats(region: any, includeHistorical: boolean) {
  const crops = region.crops.slice(0, 5);
  const diseases = region.diseases.slice(0, 5);

  return {
    region_id: region.id,
    region_name: region.name,
    total_farmers: Math.floor(Math.random() * 50000) + 10000,
    total_fields: Math.floor(Math.random() * 20000) + 5000,
    total_area_hectares: Math.floor(Math.random() * 100000) + 20000,
    crops_grown: crops.length,
    diseases_detected: Math.floor(Math.random() * 5000) + 500,
    yield_predictions: Math.floor(Math.random() * 50000) + 10000,
    avg_yield_t_per_ha: Math.random() * 3 + 2,
    active_alerts: Math.floor(Math.random() * 50) + 5,
    weather_stations: Math.floor(Math.random() * 100) + 20,
    satellite_coverage_percent: 85 + Math.random() * 15,
    top_diseases: diseases.map(d => ({
      disease_id: d.id,
      disease_name: d.name,
      count: Math.floor(Math.random() * 1000) + 100,
    })),
    top_crops: crops.map(c => ({
      crop_id: c.id,
      crop_name: c.name,
      area_hectares: Math.floor(Math.random() * 50000) + 10000,
      farmers_count: Math.floor(Math.random() * 10000) + 2000,
    })),
    ...(includeHistorical && {
      historical: {
        monthly_farmers: Array.from({ length: 12 }, (_, i) => ({
          month: `2024-${String(i + 1).padStart(2, '0')}`,
          farmers: Math.floor(Math.random() * 5000) + 10000,
        })),
        monthly_scans: Array.from({ length: 12 }, (_, i) => ({
          month: `2024-${String(i + 1).padStart(2, '0')}`,
          scans: Math.floor(Math.random() * 100000) + 20000,
        })),
      },
    }),
  };
}

function generateFarmerEngagement(query: any) {
  const months = 12;
  const interval = 'month';

  return Array.from({ length: months }, (_, i) => {
    const month = `2024-${String(i + 1).padStart(2, '0')}`;
    return {
      period: month,
      active_farmers: Math.floor(Math.random() * 5000) + 15000,
      new_farmers: Math.floor(Math.random() * 1000) + 200,
      returning_farmers: Math.floor(Math.random() * 4000) + 10000,
      churned_farmers: Math.floor(Math.random() * 500) + 100,
      scans_per_farmer: Math.random() * 10 + 2,
      advisories_per_farmer: Math.random() * 5 + 1,
      yield_predictions_per_farmer: Math.random() * 3 + 0.5,
      avg_session_duration_minutes: Math.random() * 10 + 5,
      retention_rate_7d: 0.75 + Math.random() * 0.15,
      retention_rate_30d: 0.6 + Math.random() * 0.2,
    };
  });
}