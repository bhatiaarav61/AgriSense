import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { keylessCreds, resolveCreds, providerSupportsVision } from '@/lib/providers';

// Clear any provider env the host machine happens to have set, so credential
// resolution is tested deterministically.
beforeEach(() => {
  for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'AGRISENSE_AI_PROVIDER', 'POLLINATIONS_TOKEN']) {
    vi.stubEnv(k, '');
  }
});
afterEach(() => vi.unstubAllEnvs());

describe('resolveCreds', () => {
  it('prefers a valid browser BYO key from headers', () => {
    const creds = resolveCreds(new Headers({ 'x-api-key': 'sk-test', 'x-provider': 'gemini' }));
    expect(creds).toEqual({ provider: 'gemini', apiKey: 'sk-test' });
  });

  it('ignores an unknown provider in headers', () => {
    const creds = resolveCreds(new Headers({ 'x-api-key': 'sk-test', 'x-provider': 'nope' }));
    expect(creds.keyless).toBe(true);
    expect(creds.provider).toBe('pollinations');
  });

  it('falls back to a server env key when present', () => {
    vi.stubEnv('GROQ_API_KEY', 'env-groq');
    const creds = resolveCreds(new Headers());
    expect(creds).toEqual({ provider: 'groq', apiKey: 'env-groq' });
  });

  it('falls back to the free keyless provider with no key anywhere', () => {
    const creds = resolveCreds(new Headers());
    expect(creds.provider).toBe('pollinations');
    expect(creds.keyless).toBe(true);
  });
});

describe('keylessCreds', () => {
  it('is the free Pollinations provider', () => {
    const creds = keylessCreds();
    expect(creds.provider).toBe('pollinations');
    expect(creds.keyless).toBe(true);
  });
});

describe('providerSupportsVision', () => {
  it('knows which providers can see images', () => {
    expect(providerSupportsVision('gemini')).toBe(true);
    expect(providerSupportsVision('openrouter')).toBe(true);
    expect(providerSupportsVision('pollinations')).toBe(true);
    expect(providerSupportsVision('groq')).toBe(false);
  });
});
