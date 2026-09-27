// Server-side AI provider adapters. Used by /api routes only.
// Ported/simplified from the legacy packages/api-router provider-adapters.ts,
// using native fetch (no axios). Every call is optional: if no credentials are
// available the callers fall back to the offline demo logic.
import type { AiProvider } from './types';

export interface ProviderCreds {
  provider: AiProvider;
  apiKey: string;
  /** True when this is the free, no-key provider (Pollinations). */
  keyless?: boolean;
  /** Optional model override (used by the keyless pool tiers). */
  model?: string;
}

export interface GenerateInput {
  system?: string;
  user: string;
  /** base64-encoded JPEG/PNG (no data: prefix) for vision tasks. */
  images?: string[];
  temperature?: number;
  maxTokens?: number;
}

const ENV_KEY: Record<'gemini' | 'groq' | 'openrouter', string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Free, keyless fallback so AI always works with zero configuration. */
export function keylessCreds(): ProviderCreds {
  return { provider: 'pollinations', apiKey: process.env.POLLINATIONS_TOKEN || '', keyless: true };
}

/**
 * Resolve credentials from (1) the caller's request headers (browser BYO key),
 * (2) server environment variables, or (3) the free keyless provider. Because
 * of (3) this never returns null — AI is always available, degrading to the
 * offline demo only if the network call itself fails.
 */
export function resolveCreds(headers: Headers): ProviderCreds {
  const headerKey = headers.get('x-api-key')?.trim();
  const headerProvider = headers.get('x-provider')?.trim() as AiProvider | undefined;
  if (headerKey && headerProvider && headerProvider in ENV_KEY) {
    return { provider: headerProvider, apiKey: headerKey };
  }

  const envProvider = process.env.AGRISENSE_AI_PROVIDER as keyof typeof ENV_KEY | undefined;
  const order: (keyof typeof ENV_KEY)[] = envProvider && envProvider in ENV_KEY
    ? [envProvider, 'gemini', 'groq', 'openrouter']
    : ['gemini', 'groq', 'openrouter'];
  for (const p of order) {
    const key = process.env[ENV_KEY[p]];
    if (key) return { provider: p, apiKey: key };
  }
  return keylessCreds();
}

export function providerSupportsVision(provider: AiProvider): boolean {
  return provider === 'gemini' || provider === 'openrouter' || provider === 'pollinations';
}

/** Generate text (optionally from images) with the given provider. Throws on failure. */
export async function generate(creds: ProviderCreds, input: GenerateInput): Promise<string> {
  switch (creds.provider) {
    case 'gemini':
      return callGemini(creds.apiKey, input);
    case 'groq':
      return callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', creds.apiKey, input);
    case 'openrouter':
      return callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct', creds.apiKey, input, {
        'HTTP-Referer': 'https://agrisense.app',
        'X-Title': 'AgriSense',
      });
    case 'pollinations':
      return callPollinations(creds.apiKey, input, creds.model);
    default:
      throw new Error(`Unknown provider: ${creds.provider}`);
  }
}

/**
 * Free, keyless provider (https://pollinations.ai). OpenAI-compatible endpoint;
 * the default `openai` model handles both text and vision. Anonymous access is
 * rate-limited — callers always keep the offline demo as a final fallback.
 */
async function callPollinations(token: string, input: GenerateInput, modelOverride?: string): Promise<string> {
  const model = modelOverride || process.env.POLLINATIONS_MODEL || 'openai';
  const content = input.images?.length
    ? [
        { type: 'text', text: input.user },
        ...input.images.map((img) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } })),
      ]
    : input.user;
  const body = {
    model,
    messages: [
      ...(input.system ? [{ role: 'system', content: input.system }] : []),
      { role: 'user', content },
    ],
    temperature: input.temperature ?? 0.5,
    max_tokens: input.maxTokens ?? 1024,
    referrer: 'agrisense',
    private: true,
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchJson('https://text.pollinations.ai/openai', { method: 'POST', headers, body: JSON.stringify(body) }, 45_000);
  const text = res?.choices?.[0]?.message?.content ?? res?.choices?.[0]?.text ?? '';
  if (!text) throw new Error('Empty response from Pollinations');
  return String(text).trim();
}

async function callGemini(apiKey: string, input: GenerateInput): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts: unknown[] = [{ text: input.user }];
  for (const img of input.images ?? []) {
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: img } });
  }
  const body = {
    ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: input.temperature ?? 0.5,
      maxOutputTokens: input.maxTokens ?? 1024,
    },
  };
  const res = await fetchJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = res?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') ?? '';
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}

async function callOpenAICompatible(
  url: string,
  model: string,
  apiKey: string,
  input: GenerateInput,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const content = input.images?.length
    ? [
        { type: 'text', text: input.user },
        ...input.images.map((img) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } })),
      ]
    : input.user;
  const body = {
    model,
    messages: [
      ...(input.system ? [{ role: 'system', content: input.system }] : []),
      { role: 'user', content },
    ],
    temperature: input.temperature ?? 0.5,
    max_tokens: input.maxTokens ?? 1024,
  };
  const res = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify(body),
  });
  const text = res?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Empty response from provider');
  return String(text).trim();
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 30_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const raw = await res.text();
    let json: any;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`Non-JSON response (${res.status}): ${raw.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}
