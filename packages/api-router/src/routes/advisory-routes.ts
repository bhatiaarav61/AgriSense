/**
 * Advisory API Routes
 * POST /v1/advisory - Get treatment advisory for disease
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { regionRegistry } from '@agrisense/region-config';
import { ProviderRouter, AdapterRequest } from '../adapters';

const AdvisoryRequestSchema = z.object({
  disease_id: z.string(),
  crop_id: z.string(),
  region_id: z.string(),
  language: z.string().length(2).default('en'),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
});

type AdvisoryRequest = z.infer<typeof AdvisoryRequestSchema>;

interface Advisory {
  disease_id: string;
  crop_id: string;
  region_id: string;
  language: string;
  severity: string;
  treatment: string;
  preventive_measures: string[];
  local_names: Record<string, string>;
  follow_up: string;
  safety_warnings: string[];
}

export async function advisoryRoutes(fastify: FastifyInstance) {
  // POST /v1/advisory
  fastify.post<{
    Body: AdvisoryRequest;
  }>('/advisory', {
    schema: {
      tags: ['Advisory'],
      summary: 'Get treatment advisory for disease',
      body: {
        type: 'object',
        required: ['disease_id', 'crop_id', 'region_id'],
        properties: {
          disease_id: { type: 'string' },
          crop_id: { type: 'string' },
          region_id: { type: 'string' },
          language: { type: 'string', default: 'en' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            disease_id: { type: 'string' },
            crop_id: { type: 'string' },
            region_id: { type: 'string' },
            language: { type: 'string' },
            severity: { type: 'string' },
            treatment: { type: 'string' },
            preventive_measures: { type: 'array', items: { type: 'string' } },
            local_names: { type: 'object' },
            follow_up: { type: 'string' },
            safety_warnings: { type: 'array', items: { type: 'string' } },
          },
        },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
        500: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validation = AdvisoryRequestSchema.safeParse(request.body);
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

      // Validate disease
      const disease = regionRegistry.getDisease(req.region_id, req.disease_id);
      if (!disease) {
        return reply.code(404).send({ error: `Disease not found in region: ${req.disease_id}` });
      }

      // Check if disease affects this crop
      if (!disease.cropIds.includes(req.crop_id)) {
        return reply.code(400).send({ error: `Disease ${req.disease_id} does not affect crop ${req.crop_id}` });
      }

      // Get providers for advisory
      const providers = regionRegistry.getProvidersForTask(req.region_id, 'advisory');
      if (providers.length === 0) {
        // Fallback to static advisory from region config
        return reply.code(200).send(buildStaticAdvisory(disease, crop, region, req.language, req.severity));
      }

      const router = new ProviderRouter(req.region_id, providers);

      // Get prompt template
      const promptTemplate = regionRegistry.getPromptTemplate(req.region_id, 'advisory', req.language);
      const systemPrompt = promptTemplate?.systemPrompt ||
        `You are an agricultural extension officer providing treatment advice to farmers.
         Respond with JSON only: { "treatment": "...", "preventive_measures": [...], "follow_up": "...", "safety_warnings": [...] }
         Language: ${req.language}. Be practical, affordable, and culturally appropriate.`;

      const userPrompt = promptTemplate?.userPromptTemplate
        ? promptTemplate.userPromptTemplate
            .replace('{disease}', disease.name)
            .replace('{crop}', crop.name)
            .replace('{region}', region.name)
            .replace('{severity}', req.severity)
            .replace('{language}', req.language)
        : `Provide treatment advisory for ${disease.name} in ${crop.name} (${region.name}).
           Severity: ${req.severity}. Language: ${req.language}.
           Symptoms: ${disease.symptoms.join(', ')}.
           Local names: ${JSON.stringify(disease.localNames)}`;

      const adapterRequest: AdapterRequest = {
        taskType: 'advisory',
        prompt: userPrompt,
        systemPrompt,
        temperature: 0.5,
        maxTokens: 2048,
      };

      const response = await router.execute(adapterRequest);

      // Parse AI response
      let advisory: Advisory;
      try {
        const parsed = JSON.parse(response.content);
        advisory = {
          disease_id: disease.id,
          crop_id: crop.id,
          region_id: region.id,
          language: req.language,
          severity: req.severity,
          treatment: parsed.treatment || disease.treatmentTemplate
            .replace('{disease}', disease.name)
            .replace('{crop}', crop.name)
            .replace('{region}', region.name),
          preventive_measures: parsed.preventive_measures || disease.preventiveMeasures,
          local_names: disease.localNames,
          follow_up: parsed.follow_up || `Monitor crop for ${7 + req.severity === 'high' ? 3 : 7} days. Re-apply treatment if symptoms persist.`,
          safety_warnings: parsed.safety_warnings || [
            'Wear protective equipment when applying chemicals',
            'Follow label instructions for dosage and pre-harvest intervals',
            'Keep children and animals away from treated areas',
          ],
        };
      } catch (parseError) {
        // Fallback to static advisory
        advisory = buildStaticAdvisory(disease, crop, region, req.language, req.severity);
      }

      return reply.code(200).send(advisory);

    } catch (error) {
      request.log.error(error, 'Advisory generation failed');
      return reply.code(500).send({ error: 'Advisory generation failed', message: (error as Error).message });
    }
  });
}

function buildStaticAdvisory(
  disease: any,
  crop: any,
  region: any,
  language: string,
  severity: string
): Advisory {
  const baseTreatment = disease.treatmentTemplate
    .replace('{disease}', disease.name)
    .replace('{crop}', crop.name)
    .replace('{region}', region.name);

  return {
    disease_id: disease.id,
    crop_id: crop.id,
    region_id: region.id,
    language,
    severity,
    treatment: baseTreatment,
    preventive_measures: disease.preventiveMeasures,
    local_names: disease.localNames,
    follow_up: `Monitor crop for ${severity === 'high' ? 3 : 7} days. Re-apply treatment if symptoms persist.`,
    safety_warnings: [
      'Wear protective equipment when applying chemicals',
      'Follow label instructions for dosage and pre-harvest intervals',
      'Keep children and animals away from treated areas',
      'Store chemicals safely away from food and water sources',
    ],
  };
}