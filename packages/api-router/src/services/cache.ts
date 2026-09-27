/**
 * Redis Cache Service with TTL and Pattern-based Invalidation
 */

import { createClient, RedisClientType, RedisModules } from 'redis';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'agrisense:',
  defaultTTL: 3600, // 1 hour
  maxRetries: 3,
  retryDelay: 100,
};

export class CacheService {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private connected = false;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) return;

    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
        reconnectStrategy: (retries) => {
          if (retries > (this.config.maxRetries || 3)) {
            return new Error('Max retries reached');
          }
          return Math.min(retries * (this.config.retryDelay || 100), 3000);
        },
      },
      password: this.config.password,
      database: this.config.db,
    });

    this.client.on('error', (err) => {
      this.stats.errors++;
      console.error('[Cache] Redis error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('[Cache] Connected to Redis');
    });

    this.client.on('disconnect', () => {
      this.connected = false;
      console.log('[Cache] Disconnected from Redis');
    });

    await this.client.connect();
    this.connected = true;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Generate full key with prefix
   */
  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected() || !this.client) {
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.getKey(key);
      const data = await this.client.get(fullKey);

      if (data === null) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check expiration
      if (entry.expiresAt < Date.now()) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      // Update hits and save
      entry.hits++;
      await this.client.set(this.getKey(key), JSON.stringify(entry), {
        PXAT: entry.expiresAt,
      });

      this.stats.hits++;
      return entry.data;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttlMs?: number): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      const fullKey = this.getKey(key);
      const ttl = ttlMs || this.config.defaultTTL * 1000;
      const expiresAt = Date.now() + ttl;

      const entry: CacheEntry<T> = {
        data: value,
        expiresAt,
        createdAt: Date.now(),
        hits: 0,
      };

      await this.client.set(this.getKey(key), JSON.stringify(entry), {
        PX: ttl,
      });

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Set error:', error);
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      const result = await this.client.del(this.getKey(key));
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Delete error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isConnected() || !this.client) return 0;

    try {
      const fullPattern = this.getKey(pattern);
      const keys: string[] = [];

      for await (const key of this.client.scanIterator({ MATCH: fullPattern, COUNT: 100 })) {
        keys.push(key);
      }

      if (keys.length === 0) return 0;

      const result = await this.client.del(keys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Delete by pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      const result = await this.client.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get TTL for key in milliseconds
   */
  async getTTL(key: string): Promise<number | null> {
    if (!this.isConnected() || !this.client) return null;

    try {
      const ttl = await this.client.pttl(this.getKey(key));
      return ttl > 0 ? ttl : null;
    } catch (error) {
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Extend TTL for key
   */
  async extendTTL(key: string, additionalMs: number): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      const fullKey = this.getKey(key);
      const currentTTL = await this.client.pttl(fullKey);

      if (currentTTL <= 0) return false;

      const newTTL = currentTTL + additionalMs;
      await this.client.pexpire(fullKey, newTTL);
      return true;
    } catch (error) {
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount = 1): Promise<number | null> {
    if (!this.isConnected() || !this.client) return null;

    try {
      const result = await this.client.incrBy(this.getKey(key), amount);
      return result;
    } catch (error) {
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (!this.isConnected() || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const fullKeys = keys.map(k => this.getKey(k));
      const results = await this.client.mGet(fullKeys);

      return results.map((data, index) => {
        if (data === null) {
          this.stats.misses++;
          return null;
        }

        try {
          const entry: CacheEntry<T> = JSON.parse(data);

          if (entry.expiresAt < Date.now()) {
            this.stats.misses++;
            return null;
          }

          entry.hits++;
          this.stats.hits++;
          return entry.data;
        } catch {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      this.stats.errors++;
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<boolean> {
    if (!this.isConnected() || !this.client || entries.length === 0) return false;

    try {
      const pipeline = this.client.multi();

      for (const entry of entries) {
        const fullKey = this.getKey(entry.key);
        const ttl = entry.ttlMs || this.config.defaultTTL * 1000;
        const expiresAt = Date.now() + ttl;

        const cacheEntry: CacheEntry<T> = {
          data: entry.value,
          expiresAt,
          createdAt: Date.now(),
          hits: 0,
        };

        pipeline.set(fullKey, JSON.stringify(cacheEntry), { PX: ttl });
      }

      await pipeline.exec();
      this.stats.sets += entries.length;
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] MSet error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): typeof this.stats & { hitRate: number; connected: boolean } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      connected: this.connected,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Flush all cache (use with caution)
   */
  async flushAll(): Promise<boolean> {
    if (!this.isConnected() || !this.client) return false;

    try {
      await this.client.flushDb();
      this.resetStats();
      return true;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Flush error:', error);
      return false;
    }
  }

  /**
   * Get memory usage info
   */
  async getMemoryInfo(): Promise<{ used: string; peak: string; keys: number } | null> {
    if (!this.isConnected() || !this.client) return null;

    try {
      const info = await this.client.info('memory');
      const lines = info.split('\r\n');

      let used = '0';
      let peak = '0';

      for (const line of lines) {
        if (line.startsWith('used_memory_human:')) {
          used = line.split(':')[1];
        } else if (line.startsWith('used_memory_peak_human:')) {
          peak = line.split(':')[1];
        }
      }

      const keys = await this.client.dbSize();

      return { used, peak, keys };
    } catch (error) {
      this.stats.errors++;
      return null;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

/**
 * Cache decorators for easy use
 */
export function Cacheable<T extends (...args: any[]) => Promise<any>>(
  keyGenerator: (...args: Parameters<T>) => string,
  ttlMs?: number
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args);

      // Try cache first
      const cached = await cacheService.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache result
      await cacheService.set(key, result, ttlMs);

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache invalidation decorator
 */
export function CacheInvalidate(
  keyGenerator: (...args: any[]) => string | string[]
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      const keys = keyGenerator(...args);
      const keyArray = Array.isArray(keys) ? keys : [keys];

      for (const key of keyArray) {
        await cacheService.delete(key);
      }

      return result;
    };

    return descriptor;
  };
}