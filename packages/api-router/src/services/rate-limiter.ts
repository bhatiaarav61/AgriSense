/**
 * Rate Limiter Service with Tiered Limits and Redis Backend
 */

import { createClient, RedisClientType } from 'redis';

export interface RateLimitConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RateLimitRule {
  windowMs: number;           // Time window in milliseconds
  maxRequests: number;        // Maximum requests per window
  blockDurationMs?: number;   // Optional block duration after exceeded
}

export interface RateLimitTier {
  name: string;
  rules: Record<string, RateLimitRule>;  // ruleKey -> rule
  defaultRule: RateLimitRule;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
  blocked?: boolean;
  blockExpiresAt?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '1', 10), // Different DB for rate limiting
  keyPrefix: 'ratelimit:',
};

// Default tier configurations
export const DEFAULT_TIERS: Record<string, RateLimitTier> = {
  free: {
    name: 'Free',
    defaultRule: { windowMs: 60000, maxRequests: 60 }, // 60 req/min
    rules: {
      'api:default': { windowMs: 60000, maxRequests: 60 },
      'api:disease-detection': { windowMs: 60000, maxRequests: 10 }, // 10 scans/min
      'api:yield-prediction': { windowMs: 60000, maxRequests: 20 },
      'api:advisory': { windowMs: 60000, maxRequests: 30 },
      'api:analytics': { windowMs: 60000, maxRequests: 10 },
    },
  },
  basic: {
    name: 'Basic',
    defaultRule: { windowMs: 60000, maxRequests: 300 },
    rules: {
      'api:default': { windowMs: 60000, maxRequests: 300 },
      'api:disease-detection': { windowMs: 60000, maxRequests: 50 },
      'api:yield-prediction': { windowMs: 60000, maxRequests: 100 },
      'api:advisory': { windowMs: 60000, maxRequests: 150 },
      'api:analytics': { windowMs: 60000, maxRequests: 50 },
    },
  },
  pro: {
    name: 'Pro',
    defaultRule: { windowMs: 60000, maxRequests: 1000 },
    rules: {
      'api:default': { windowMs: 60000, maxRequests: 1000 },
      'api:disease-detection': { windowMs: 60000, maxRequests: 200 },
      'api:yield-prediction': { windowMs: 60000, maxRequests: 500 },
      'api:advisory': { windowMs: 60000, maxRequests: 500 },
      'api:analytics': { windowMs: 60000, maxRequests: 200 },
    },
  },
  enterprise: {
    name: 'Enterprise',
    defaultRule: { windowMs: 60000, maxRequests: 10000 },
    rules: {
      'api:default': { windowMs: 60000, maxRequests: 10000 },
      'api:disease-detection': { windowMs: 60000, maxRequests: 2000 },
      'api:yield-prediction': { windowMs: 60000, maxRequests: 5000 },
      'api:advisory': { windowMs: 60000, maxRequests: 5000 },
      'api:analytics': { windowMs: 60000, maxRequests: 2000 },
    },
  },
};

export class RateLimiterService {
  private client: RedisClientType | null = null;
  private config: RateLimitConfig;
  private tiers: Record<string, RateLimitTier>;
  private connected = false;

  constructor(config: Partial<RateLimitConfig> = {}, tiers: Record<string, RateLimitTier> = DEFAULT_TIERS) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tiers = tiers;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) return;

    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
      password: this.config.password,
      database: this.config.db,
    });

    this.client.on('error', (err) => {
      console.error('[RateLimiter] Redis error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[RateLimiter] Connected to Redis');
    });

    this.client.on('disconnect', () => {
      this.connected = false;
    });

    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  private getKey(identifier: string, ruleKey: string): string {
    return `${this.config.keyPrefix}${ruleKey}:${identifier}`;
  }

  private getTierConfig(tierName: string): RateLimitTier {
    return this.tiers[tierName] || this.tiers.free;
  }

  private getRule(tier: RateLimitTier, ruleKey: string): RateLimitRule {
    return tier.rules[ruleKey] || tier.defaultRule;
  }

  /**
   * Check rate limit and increment counter
   */
  async checkLimit(
    identifier: string,
    ruleKey: string,
    tierName: string = 'free'
  ): Promise<RateLimitResult> {
    if (!this.isConnected() || !this.client) {
      // Fail open - allow request if Redis unavailable
      return {
        allowed: true,
        remaining: 999,
        resetTime: Date.now() + 60000,
        totalRequests: 0,
      };
    }

    const tier = this.getTierConfig(tierName);
    const rule = this.getRule(tier, ruleKey);
    const key = this.getKey(identifier, ruleKey);
    const windowSec = Math.ceil(rule.windowMs / 1000);
    const now = Date.now();
    const windowStart = now - (now % rule.windowMs);
    const resetTime = windowStart + rule.windowMs;

    try {
      // Use Redis transaction for atomic check-and-increment
      const multi = this.client.multi();

      // Increment counter
      multi.incr(key);

      // Set expiry if new key
      multi.pexpire(key, rule.windowMs);

      // Get TTL for reset time calculation
      multi.pttl(key);

      const results = await multi.exec();

      const totalRequests = results[0] as number;
      const ttl = results[2] as number;

      // Check if blocked
      let blocked = false;
      let blockExpiresAt: number | undefined;

      if (rule.blockDurationMs && totalRequests > rule.maxRequests) {
        const blockKey = `${key}:blocked`;
        const wasBlocked = await this.client.set(blockKey, '1', {
          PX: rule.blockDurationMs,
          NX: true,
        });

        if (wasBlocked) {
          blocked = true;
          blockExpiresAt = now + rule.blockDurationMs;
        } else {
          // Check if already blocked
          const existingBlock = await this.client.get(blockKey);
          if (existingBlock) {
            blocked = true;
            const blockTtl = await this.client.pttl(blockKey);
            blockExpiresAt = now + blockTtl;
          }
        }
      }

      const allowed = totalRequests <= rule.maxRequests && !blocked;
      const remaining = Math.max(0, rule.maxRequests - totalRequests);

      return {
        allowed,
        remaining,
        resetTime: now + (ttl > 0 ? ttl : rule.windowMs),
        totalRequests,
        blocked,
        blockExpiresAt,
      };
    } catch (error) {
      console.error('[RateLimiter] Check limit error:', error);
      // Fail open
      return {
        allowed: true,
        remaining: 999,
        resetTime: now + 60000,
        totalRequests: 0,
      };
    }
  }

  /**
   * Get current usage without incrementing
   */
  async getUsage(identifier: string, ruleKey: string, tierName: string = 'free'): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    if (!this.isConnected() || !this.client) {
      const tier = this.getTierConfig(tierName);
      const rule = this.getRule(tier, ruleKey);
      return {
        used: 0,
        limit: rule.maxRequests,
        remaining: rule.maxRequests,
        resetTime: Date.now() + rule.windowMs,
      };
    }

    try {
      const key = this.getKey(identifier, ruleKey);
      const tier = this.getTierConfig(tierName);
      const rule = this.getRule(tier, ruleKey);

      const [count, ttl] = await Promise.all([
        this.client.get(key),
        this.client.pttl(key),
      ]);

      const used = parseInt(count || '0', 10);
      const limit = rule.maxRequests;

      return {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        resetTime: Date.now() + (ttl > 0 ? ttl : rule.windowMs),
      };
    } catch (error) {
      const tier = this.getTierConfig(tierName);
      const rule = this.getRule(tier, ruleKey);
      return {
        used: 0,
        limit: rule.maxRequests,
        remaining: rule.maxRequests,
        resetTime: Date.now() + rule.windowMs,
      };
    }
  }

  /**
   * Reset limit for identifier
   */
  async resetLimit(identifier: string, ruleKey: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      const key = this.getKey(identifier, ruleKey);
      const blockKey = `${key}:blocked`;

      await this.client.del([key, blockKey]);
      return true;
    } catch (error) {
      console.error('[RateLimiter] Reset limit error:', error);
      return false;
    }
  }

  /**
   * Get all active limits for an identifier
   */
  async getAllLimits(identifier: string): Promise<Record<string, { used: number; limit: number }>> {
    if (!this.isConnected() || !this.client) return {};

    try {
      const pattern = `${this.config.keyPrefix}*:${identifier}`;
      const keys: string[] = [];

      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
      }

      if (keys.length === 0) return {};

      const values = await this.client.mGet(keys);
      const result: Record<string, { used: number; limit: number }> = {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const ruleKey = key.replace(`${this.config.keyPrefix}`, '').replace(`:${identifier}`, '');
        const tier = this.tiers.free;
        const rule = tier.rules[ruleKey] || tier.defaultRule;

        const count = parseInt(values[i] || '0', 10);
        result[ruleKey] = { used: count, limit: rule.maxRequests };
      }

      return result;
    } catch (error) {
      console.error('[RateLimiter] Get all limits error:', error);
      return {};
    }
  }

  /**
   * Add custom tier
   */
  addTier(name: string, tier: RateLimitTier): void {
    this.tiers[name] = tier;
  }

  /**
   * Update tier rule
   */
  updateRule(tierName: string, ruleKey: string, rule: RateLimitRule): void {
    const tier = this.tiers[tierName];
    if (tier) {
      tier.rules[ruleKey] = rule;
    }
  }

  /**
   * Get tier configuration
   */
  getTier(tierName: string): RateLimitTier | undefined {
    return this.tiers[tierName];
  }

  /**
   * List all tiers
   */
  listTiers(): string[] {
    return Object.keys(this.tiers);
  }

  getStats(): { connected: boolean; tiers: string[] } {
    return {
      connected: this.connected,
      tiers: Object.keys(this.tiers),
    };
  }
}

// Singleton instance
export const rateLimiter = new RateLimiterService();

/**
 * Express/Fastify middleware factory
 */
export function createRateLimitMiddleware(
  rateLimiter: RateLimiterService,
  getIdentifier: (request: any) => string,
  getRuleKey: (request: any) => string,
  getTier: (request: any) => string
) {
  return async (request: any, reply: any) => {
    const identifier = getIdentifier(request);
    const ruleKey = getRuleKey(request);
    const tier = getTier(request);

    const result = await rateLimiter.checkLimit(identifier, ruleKey, tier);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', result.totalRequests + result.remaining);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      reply.header('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));

      if (result.blocked && result.blockExpiresAt) {
        reply.header('X-RateLimit-Blocked', 'true');
        reply.header('X-RateLimit-BlockExpires', Math.ceil(result.blockExpiresAt / 1000));
      }

      return reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        blocked: result.blocked,
      });
    }

    return;
  };
}