/**
 * Disease Detection API Routes
 * POST /v1/detect - Detect crop disease from image
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { regionRegistry } from '@agrisense/region-config';
import { ProviderRouter, AdapterRequest } from '../adapters';

// Request schema
const DetectRequestSchema = z.object({
  crop_id: z.string(),
  region_id: z.string(),
  location: z.object({
    lat: z.number(),
    lon: z.number(),
  }).optional(),
});

type DetectRequest = z.infer<typeof DetectRequestSchema>;

interface DiseaseResult {
  disease_id: string;
  name: string;
  confidence: number;
  source: 'edge' | 'cloud' | 'hybrid';
  symptoms: string[];
  treatment: string;
  local_names: Record<string, string>;
}

// Multipart file handling
const multipartOptions = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
};

export async function diseaseRoutes(fastify: FastifyInstance) {
  // POST /v1/detect
  fastify.post<{
    Body: DetectRequest;
  }>('/detect', {
    schema: {
      tags: ['Disease Detection'],
      summary: 'Detect crop disease from image',
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['image', 'crop_id', 'region_id'],
        properties: {
          image: { type: 'string', format: 'binary' },
          crop_id: { type: 'string' },
          region_id: { type: 'string' },
          location: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            disease_id: { type: 'string' },
            name: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            source: { type: 'string', enum: ['edge', 'cloud', 'hybrid'] },
            symptoms: { type: 'array', items: { type: 'string' } },
            treatment: { type: 'string' },
            local_names: { type: 'object' },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        500: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse multipart form data
      const data = await request.file(multipartOptions);
      if (!data) {
        return reply.code(400).send({ error: 'No image file provided' });
      }

      // Parse form fields
      const fields = data.fields as unknown as DetectRequest;
      const validation = DetectRequestSchema.safeParse(fields);
      if (!validation.success) {
        return reply.code(400).send({ error: 'Invalid request', details: validation.error.errors });
      }

      const { crop_id, region_id, location } = validation.data;

      // Validate region exists
      const region = regionRegistry.getRegion(region_id);
      if (!region) {
        return reply.code(404).send({ error: `Region not found: ${region_id}` });
      }

      // Validate crop exists in region
      const crop = regionRegistry.getCrop(region_id, crop_id);
      if (!crop) {
        return reply.code(404).send({ error: `Crop not found in region: ${crop_id}` });
      }

      // Read image as base64
      const imageBuffer = await data.toBuffer();
      const imageBase64 = imageBuffer.toString('base64');

      // Try edge inference first (would be done client-side in production)
      // For now, we'll use cloud inference via provider router
      const providers = regionRegistry.getProvidersForTask(region_id, 'disease-detection');
      if (providers.length === 0) {
        return reply.code(503).send({ error: 'No disease detection providers available for this region' });
      }

      const router = new ProviderRouter(region_id, providers);

      // Get disease classes for this crop
      const diseases = regionRegistry.getDiseasesForCrop(region_id, crop_id);
      const diseaseLabels = diseases.map(d => d.id);

      // Get prompt template
      const promptTemplate = regionRegistry.getPromptTemplate(region_id, 'disease-detection', region.defaultLanguage);
      const systemPrompt = promptTemplate?.systemPrompt ||
        `You are an expert plant pathologist. Identify the crop disease from the image.
         Respond with JSON only: { "disease_id": "...", "confidence": 0.0-1.0, "symptoms": [...], "reasoning": "..." }
         Possible diseases for ${crop.name}: ${diseaseLabels.join(', ')}`;

      const userPrompt = promptTemplate?.userPromptTemplate
        ? promptTemplate.userPromptTemplate.replace('{crop}', crop.name).replace('{region}', region.name)
        : `Analyze this image of ${crop.name} and identify any disease.`;

      const adapterRequest: AdapterRequest = {
        taskType: 'disease-detection',
        prompt: userPrompt,
        systemPrompt,
        images: [imageBase64],
        temperature: 0.3,
        maxTokens: 1024,
      };

      const response = await router.execute(adapterRequest);

      // Parse AI response
      let result: DiseaseResult;
      try {
        const parsed = JSON.parse(response.content);
        const disease = diseases.find(d => d.id === parsed.disease_id);

        if (!disease) {
          // Fallback: find closest match or return unknown
          return reply.code(200).send({
            disease_id: 'unknown',
            name: 'Unknown Disease',
            confidence: parsed.confidence || 0.5,
            source: 'cloud',
            symptoms: parsed.symptoms || ['Unable to determine'],
            treatment: 'Please consult a local agricultural extension officer for diagnosis.',
            local_names: {},
          });
        }

        result = {
          disease_id: disease.id,
          name: disease.name,
          confidence: Math.min(Math.max(parsed.confidence || 0.7, 0), 1),
          source: 'cloud',
          symptoms: parsed.symptoms || disease.symptoms,
          treatment: disease.treatmentTemplate
            .replace('{disease}', disease.name)
            .replace('{crop}', crop.name)
            .replace('{region}', region.name),
          local_names: disease.localNames,
        };
      } catch (parseError) {
        // Fallback for non-JSON responses
        return reply.code(200).send({
          disease_id: 'unknown',
          name: 'Analysis Complete',
          confidence: 0.5,
          source: 'cloud',
          symptoms: ['See advisory for details'],
          treatment: response.content,
          local_names: {},
        });
      }

      return reply.code(200).send(result);

    } catch (error) {
      request.log.error(error, 'Disease detection failed');
      return reply.code(500).send({ error: 'Disease detection failed', message: (error as Error).message });
    }
  });

  // GET /v1/diseases/:regionId - List diseases for a region
  fastify.get<{
    Params: { regionId: string };
    Querystring: { crop_id?: string };
  }>('/diseases/:regionId', {
    schema: {
      tags: ['Disease Detection'],
      summary: 'List diseases for a region (optionally filtered by crop)',
      params: {
        type: 'object',
        properties: {
          regionId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          crop_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              scientificName: { type: 'string' },
              cropIds: { type: 'array', items: { type: 'string' } },
              symptoms: { type: 'array', items: { type: 'string' } },
              localNames: { type: 'object' },
              severityLevels: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { regionId } = request.params;
    const { crop_id } = request.query;

    const region = regionRegistry.getRegion(regionId);
    if (!region) {
      return reply.code(404).send({ error: `Region not found: ${regionId}` });
    }

    let diseases = region.diseases;
    if (crop_id) {
      diseases = diseases.filter(d => d.cropIds.includes(crop_id));
    }

    return reply.code(200).send(diseases);
  });

  // GET /v1/crops/:regionId - List crops for a region
  fastify.get<{
    Params: { regionId: string };
  }>('/crops/:regionId', {
    schema: {
      tags: ['Disease Detection'],
      summary: 'List supported crops for a region',
      params: {
        type: 'object',
        properties: {
          regionId: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              scientificName: { type: 'string' },
              localNames: { type: 'object' },
              growingSeasons: { type: 'array', items: { type: 'string' } },
              diseaseClasses: { type: 'array', items: { type: 'string' } },
              icon: { type: 'string' },
              color: { type: 'string' },
            },
          },
        },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { regionId } = request.params;

    const region = regionRegistry.getRegion(regionId);
    if (!region) {
      return reply.code(404).send({ error: `Region not found: ${regionId}` });
    }

    return reply.code(200).send(region.crops);
  });
}