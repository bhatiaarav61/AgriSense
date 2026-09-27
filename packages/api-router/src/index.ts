/**
 * AgriSense API Router
 * Main entry point for the Fastify API server
 */

import Fastify, { FastifyInstance } from 'fastify';
import { regionRegistry } from '@agrisense/region-config';
import { diseaseRoutes } from './routes/disease';
import { yieldRoutes } from './routes/yield';
import { advisoryRoutes } from './routes/advisory';
import * as path from 'path';
import * as fs from 'fs';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const REGIONS_DIR = process.env.REGIONS_DIR || path.resolve(__dirname, '../../regions');

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true },
      } : undefined,
    },
  });

  // Initialize region registry
  try {
    regionRegistry.initialize(REGIONS_DIR);
  } catch (error) {
    app.log.error(error, 'Failed to initialize region registry');
    throw error;
  }

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    regions: regionRegistry.getRegionIds(),
  }));

  // API version info
  app.get('/v1', async () => ({
    name: 'AgriSense API',
    version: '1.0.0',
    description: 'AI-Powered Crop Disease Detection & Yield Prediction Platform',
    docs: '/v1/docs',
    endpoints: {
      disease_detection: '/v1/detect',
      yield_prediction: '/v1/predict-yield',
      advisory: '/v1/advisory',
      weather: '/v1/weather',
      crops: '/v1/crops/:regionId',
      diseases: '/v1/diseases/:regionId',
    },
  }));

  // Register routes
  await app.register(diseaseRoutes, { prefix: '/v1' });
  await app.register(yieldRoutes, { prefix: '/v1' });
  await app.register(advisoryRoutes, { prefix: '/v1' });

  // 404 handler
  app.setNotFoundHandler(async (request, reply) => {
    return reply.code(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      docs: '/v1',
    });
  });

  // Error handler
  app.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.code(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 AgriSense API running at http://${HOST}:${PORT}`);
    console.log(`📚 API docs at http://${HOST}:${PORT}/v1`);
    console.log(`🌍 Loaded regions: ${regionRegistry.getRegionIds().join(', ')}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});

if (require.main === module) {
  start();
}

export { buildApp, start };