// Server-side AI pool. Rotates across the best free keyless models, keeps
// per-tier health so a failing tier is deprioritized (circuit breaker), gates
// upstream concurrency so bursts of users queue briefly instead of hammering
// providers (stable latency), and offers a small TTL cache for identical
// advisory requests. BYO-key callers keep their own single provider.
import { generate, type GenerateInput, type ProviderCreds } from './providers';

export interface PoolResult {
  text: string;
  provider: string;
  model?: string;
}

interface Tier {
  model: string;
  vision: boolean;
  /** Higher first — tried in order when healthy. */
  rank: number;
}

// Free keyless tiers (via Pollinations' OpenAI-compatible endpoint). The first
// is the quality default; the rest are independent models on other vendors so
// a single vendor outage or rate limit never takes the app down.
const KEYLESS_TIERS: Tier[] = [
  { model: 'openai', vision: true, rank: 100 },
  { model: 'openai-fast', vision: true, rank: 80 },
  { model: 'gemini', vision: true, rank: 70 },
  { model: 'mistral', vision: false, rank: 60 },
];

// ---- Circuit breaker: after 2 failures a tier cools down (still tried last). ----
const failures = new Map<string, { n: number; until: number }>();
const FAIL_THRESHOLD = 2;
const COOLDOWN_MS = 60_000;

function tierDown(id: string): boolean {
  const f = failures.get(id);
  return !!f && f.until > Date.now();
}
function markFailure(id: string) {
  const f = failures.get(id) ?? { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= FAIL_THRESHOLD) {
    f.until = Date.now() + COOLDOWN_MS;
    f.n = 0;
  }
  failures.set(id, f);
}
function markSuccess(id: string) {
  failures.delete(id);
}

// ---- Concurrency gate: FIFO queue with a short wait cap. ----
const MAX_CONCURRENT = 12;
const QUEUE_WAIT_MS = 8_000;
let active = 0;
const waiters: Array<(ok: boolean) => void> = [];

async function acquire(): Promise<() => void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return release;
  }
  const ok = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), QUEUE_WAIT_MS);
    waiters.push((go) => {
      clearTimeout(timer);
      resolve(go);
    });
  });
  if (!ok) throw new Error('All AI slots busy — try again shortly');
  return release; // slot handed over directly from the releaser
}
function release() {
  const next = waiters.shift();
  if (next) {
    next(true); // hand our slot to the next waiter; active count unchanged
  } else {
    active = Math.max(0, active - 1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Generate text with automatic failover. When the caller is on the free
 * keyless provider, tries the best healthy tier first and falls through the
 * pool on any error. BYO keys keep their own provider with one retry.
 */
export async function generateWithFailover(creds: ProviderCreds, input: GenerateInput & { needsVision?: boolean }): Promise<PoolResult> {
  if (!creds.keyless) {
    // Single caller-owned provider: one retry for transient errors.
    try {
      const text = await generate(creds, input);
      return { text, provider: creds.provider };
    } catch {
      await sleep(400);
      const text = await generate(creds, input);
      return { text, provider: creds.provider };
    }
  }

  const vision = input.needsVision ?? (input.images?.length ?? 0) > 0;
  const tiers = KEYLESS_TIERS.filter((t) => !vision || t.vision);
  const healthy = tiers.filter((t) => !tierDown(t.model));
  const cooling = tiers.filter((t) => tierDown(t.model));
  const ordered = [...healthy.sort((a, b) => b.rank - a.rank), ...cooling.sort((a, b) => b.rank - a.rank)];

  const errors: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const tier = ordered[i];
    if (i > 0) await sleep(120 + Math.floor(Math.random() * 200)); // stagger retries
    try {
      const rel = await acquire();
      try {
        const text = await generate({ ...creds, model: tier.model }, input);
        markSuccess(tier.model);
        return { text, provider: creds.provider, model: tier.model };
      } finally {
        rel();
      }
    } catch (err) {
      markFailure(tier.model);
      errors.push(`${tier.model}: ${(err as Error).message?.slice(0, 60)}`);
    }
  }
  throw new Error(errors.join(' | ') || 'All AI tiers failed');
}

// ---- Tiny TTL cache for identical requests (advisories, etc.). ----
const cache = new Map<string, { at: number; ttl: number; value: PoolResult }>();

export async function cachedGenerate(key: string, ttlMs: number, creds: ProviderCreds, input: GenerateInput & { needsVision?: boolean }): Promise<PoolResult> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const value = await generateWithFailover(creds, input);
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), ttl: ttlMs, value });
  return value;
}
