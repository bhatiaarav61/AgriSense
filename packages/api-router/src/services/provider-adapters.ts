/**
 * Free-tier API Provider Adapters
 * Normalizes responses from various free AI providers
 */

import axios, { AxiosInstance } from 'axios';
import { Provider } from '@agrisense/region-config';

export interface AdapterRequest {
  taskType: 'disease-detection' | 'yield-prediction' | 'advisory' | 'chat';
  prompt: string;
  systemPrompt?: string;
  images?: string[]; // base64 encoded
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
}

export interface AdapterResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export abstract class BaseAdapter {
  protected client: AxiosInstance;
  protected provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
    this.client = axios.create({
      baseURL: provider.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  abstract request(req: AdapterRequest): Promise<AdapterResponse>;

  protected getAuthHeaders(): Record<string, string> {
    const apiKey = process.env[this.provider.apiKeyEnvVar];
    if (!apiKey) {
      throw new Error(`API key not found in environment: ${this.provider.apiKeyEnvVar}`);
    }
    return this.buildAuthHeaders(apiKey);
  }

  protected abstract buildAuthHeaders(apiKey: string): Record<string, string>;

  getProviderId(): string {
    return this.provider.id;
  }

  getRateLimit() {
    return this.provider.rateLimit;
  }

  getModels() {
    return this.provider.models;
  }
}

/**
 * Google Gemini Adapter
 */
export class GeminiAdapter extends BaseAdapter {
  protected buildAuthHeaders(apiKey: string): Record<string, string> {
    return { 'x-goog-api-key': apiKey };
  }

  async request(req: AdapterRequest): Promise<AdapterResponse> {
    const modelId = req.modelId || Object.keys(this.provider.models)[0];
    const url = `/v1beta/models/${modelId}:generateContent`;

    const contents = [
      ...(req.systemPrompt ? [{ role: 'user', parts: [{ text: req.systemPrompt }] }] : []),
      {
        role: 'user',
        parts: [
          { text: req.prompt },
          ...(req.images || []).map(img => ({
            inline_data: {
              mime_type: 'image/jpeg',
              data: img,
            },
          })),
        ],
      },
    ];

    const response = await this.client.post(url, {
      contents,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: req.maxTokens ?? 2048,
      },
    });

    const candidate = response.data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]?.text) {
      throw new Error('Empty response from Gemini');
    }

    return {
      content: candidate.content.parts[0].text,
      usage: response.data.usageMetadata ? {
        promptTokens: response.data.usageMetadata.promptTokenCount,
        completionTokens: response.data.usageMetadata.candidatesTokenCount,
        totalTokens: response.data.usageMetadata.totalTokenCount,
      } : undefined,
      model: modelId,
      provider: 'gemini',
    };
  }
}

/**
 * Groq Adapter (OpenAI-compatible)
 */
export class GroqAdapter extends BaseAdapter {
  protected buildAuthHeaders(apiKey: string): Record<string, string> {
    return { Authorization: `Bearer ${apiKey}` };
  }

  async request(req: AdapterRequest): Promise<AdapterResponse> {
    const modelId = req.modelId || Object.keys(this.provider.models)[0];
    const url = '/v1/chat/completions';

    const messages = [
      ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
      {
        role: 'user' as const,
        content: req.images?.length
          ? [
              { type: 'text' as const, text: req.prompt },
              ...req.images.map(img => ({
                type: 'image_url' as const,
                image_url: { url: `data:image/jpeg;base64,${img}` },
              })),
            ]
          : req.prompt,
      },
    ];

    const response = await this.client.post(url, {
      model: modelId,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    });

    const choice = response.data.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error('Empty response from Groq');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
      } : undefined,
      model: modelId,
      provider: 'groq',
    };
  }
}

/**
 * Hugging Face Inference Adapter
 */
export class HuggingFaceAdapter extends BaseAdapter {
  protected buildAuthHeaders(apiKey: string): Record<string, string> {
    return { Authorization: `Bearer ${apiKey}` };
  }

  async request(req: AdapterRequest): Promise<AdapterResponse> {
    const modelId = req.modelId || Object.keys(this.provider.models)[0];
    const url = `/models/${modelId}`;

    // For image classification tasks
    if (req.images?.length) {
      const imageData = req.images[0]; // Use first image
      const response = await this.client.post(url, imageData, {
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/octet-stream',
        },
        params: {
          wait_for_model: true,
        },
      });

      // HF returns array of {label, score}
      const predictions = response.data;
      return {
        content: JSON.stringify(predictions),
        model: modelId,
        provider: 'huggingface',
      };
    }

    // For text generation
    const response = await this.client.post(url, {
      inputs: req.systemPrompt ? `${req.systemPrompt}\n\n${req.prompt}` : req.prompt,
      parameters: {
        temperature: req.temperature ?? 0.7,
        max_new_tokens: req.maxTokens ?? 2048,
        return_full_text: false,
      },
    });

    const content = Array.isArray(response.data)
      ? response.data[0]?.generated_text
      : response.data.generated_text;

    if (!content) {
      throw new Error('Empty response from Hugging Face');
    }

    return {
      content,
      model: modelId,
      provider: 'huggingface',
    };
  }
}

/**
 * Together.ai Adapter (OpenAI-compatible)
 */
export class TogetherAdapter extends BaseAdapter {
  protected buildAuthHeaders(apiKey: string): Record<string, string> {
    return { Authorization: `Bearer ${apiKey}` };
  }

  async request(req: AdapterRequest): Promise<AdapterResponse> {
    const modelId = req.modelId || Object.keys(this.provider.models)[0];
    const url = '/v1/chat/completions';

    const messages = [
      ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
      {
        role: 'user' as const,
        content: req.images?.length
          ? [
              { type: 'text' as const, text: req.prompt },
              ...req.images.map(img => ({
                type: 'image_url' as const,
                image_url: { url: `data:image/jpeg;base64,${img}` },
              })),
            ]
          : req.prompt,
      },
    ];

    const response = await this.client.post(url, {
      model: modelId,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    });

    const choice = response.data.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error('Empty response from Together.ai');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
      } : undefined,
      model: modelId,
      provider: 'together',
    };
  }
}

/**
 * OpenRouter Adapter (OpenAI-compatible)
 */
export class OpenRouterAdapter extends BaseAdapter {
  protected buildAuthHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://agrisense.app',
      'X-Title': 'AgriSense',
    };
  }

  async request(req: AdapterRequest): Promise<AdapterResponse> {
    const modelId = req.modelId || Object.keys(this.provider.models)[0];
    const url = '/v1/chat/completions';

    const messages = [
      ...(req.systemPrompt ? [{ role: 'system' as const, content: req.systemPrompt }] : []),
      {
        role: 'user' as const,
        content: req.images?.length
          ? [
              { type: 'text' as const, text: req.prompt },
              ...req.images.map(img => ({
                type: 'image_url' as const,
                image_url: { url: `data:image/jpeg;base64,${img}` },
              })),
            ]
          : req.prompt,
      },
    ];

    const response = await this.client.post(url, {
      model: modelId,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    });

    const choice = response.data.choices?.[0];
    if (!choice?.message?.content) {
      throw new Error('Empty response from OpenRouter');
    }

    return {
      content: choice.message.content,
      usage: response.data.usage ? {
        promptTokens: response.data.usage.prompt_tokens,
        completionTokens: response.data.usage.completion_tokens,
        totalTokens: response.data.usage.total_tokens,
      } : undefined,
      model: modelId,
      provider: 'openrouter',
    };
  }
}

/**
 * Factory to create adapters
 */
export function createAdapter(provider: Provider): BaseAdapter {
  switch (provider.type) {
    case 'gemini':
      return new GeminiAdapter(provider);
    case 'groq':
      return new GroqAdapter(provider);
    case 'huggingface':
      return new HuggingFaceAdapter(provider);
    case 'together':
      return new TogetherAdapter(provider);
    case 'openrouter':
      return new OpenRouterAdapter(provider);
    default:
      throw new Error(`Unknown provider type: ${provider.type}`);
  }
}

/**
 * Provider Router - Handles fallback logic and provider selection
 */
export class ProviderRouter {
  private adapters: Map<string, BaseAdapter> = new Map();
  private regionId: string;

  constructor(regionId: string, providers: Provider[]) {
    this.regionId = regionId;
    for (const provider of providers) {
      if (provider.enabled) {
        this.adapters.set(provider.id, createAdapter(provider));
      }
    }
  }

  /**
   * Select best provider for a task using scoring
   */
  selectProvider(taskType: string): BaseAdapter | null {
    const candidates = Array.from(this.adapters.values())
      .filter(a => {
        const models = a.getModels();
        return Object.values(models).some(m => m.taskTypes.includes(taskType as any));
      });

    if (candidates.length === 0) {
      return null;
    }

    // Score providers (availability, latency, accuracy, cost)
    const scored = candidates.map(adapter => {
      const provider = this.getProviderConfig(adapter.getProviderId());
      if (!provider) return { score: -1, adapter };

      let score = 0;
      score += provider.priority * 10; // priority weight

      // Could add dynamic scoring based on recent performance
      return { score, adapter };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].adapter;
  }

  /**
   * Execute request with fallback
   */
  async execute(req: AdapterRequest): Promise<AdapterResponse> {
    const candidates = Array.from(this.adapters.values())
      .filter(a => {
        const models = a.getModels();
        return Object.values(models).some(m => m.taskTypes.includes(req.taskType));
      })
      .sort((a, b) => {
        const pa = this.getProviderConfig(a.getProviderId());
        const pb = this.getProviderConfig(b.getProviderId());
        return (pb?.priority ?? 0) - (pa?.priority ?? 0);
      });

    if (candidates.length === 0) {
      throw new Error(`No providers available for task: ${req.taskType}`);
    }

    let lastError: Error | null = null;

    for (const adapter of candidates) {
      try {
        return await adapter.request(req);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Provider ${adapter.getProviderId()} failed:`, error);
        continue;
      }
    }

    throw new Error(`All providers exhausted. Last error: ${lastError?.message}`);
  }

  private getProviderConfig(providerId: string): Provider | undefined {
    // This would be populated from region config
    return undefined;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}