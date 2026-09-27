/**
 * Authentication & Authorization Service
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'farmer' | 'coop_admin' | 'admin' | 'api_user';
  regionId?: string;
  cropIds?: string[];
  permissions: string[];
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;  // First 8 chars for identification
  userId: string;
  scopes: string[];
  rateLimitTier: string;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface JWTPayload {
  sub: string;           // User ID
  email: string;
  role: string;
  regionId?: string;
  permissions: string[];
  rateLimitTier: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtAccessExpiry: string;     // e.g., '15m', '1h'
  jwtRefreshExpiry: string;    // e.g., '7d', '30d'
  apiKeyPrefix: string;
  bcryptRounds: number;
}

const DEFAULT_CONFIG: AuthConfig = {
  jwtSecret: process.env.JWT_SECRET || 'agrisense-dev-secret-change-in-production',
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  apiKeyPrefix: 'agr_',
  bcryptRounds: 12,
};

export class AuthService {
  private config: AuthConfig;
  private users: Map<string, User> = new Map();
  private apiKeys: Map<string, ApiKey> = new Map();
  private refreshTokens: Map<string, { userId: string; expiresAt: Date }> = new Map();

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultUsers();
  }

  private initializeDefaultUsers(): void {
    // Default admin user
    const adminUser: User = {
      id: 'admin-001',
      email: 'admin@agrisense.app',
      name: 'System Admin',
      role: 'admin',
      permissions: ['*'],
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Default API key for admin
    this.createApiKey({
      name: 'Admin Default Key',
      userId: adminUser.id,
      scopes: ['*'],
      rateLimitTier: 'enterprise',
    });
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string): string {
    // Simple JWT implementation (in production, use jsonwebtoken library)
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const expiry = this.parseExpiry(expiresIn);

    const fullPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + expiry,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));
    const signature = this.sign(`${encodedHeader}.${encodedPayload}`);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [encodedHeader, encodedPayload, signature] = parts;

      // Verify signature
      const expectedSignature = this.sign(`${encodedHeader}.${encodedPayload}`);
      if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as JWTPayload;

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokenPair(user: User): TokenPair {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      regionId: user.regionId,
      permissions: user.permissions,
      rateLimitTier: 'free', // Would come from user profile
    };

    const accessToken = this.generateToken(payload, this.config.jwtAccessExpiry);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiry(this.config.jwtAccessExpiry),
    };
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(userId: string): string {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.parseExpiry(this.config.jwtRefreshExpiry) * 1000);

    this.refreshTokens.set(token, { userId, expiresAt });

    return token;
  }

  /**
   * Verify refresh token and generate new access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    const tokenData = this.refreshTokens.get(refreshToken);

    if (!tokenData) return null;
    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(refreshToken);
      return null;
    }

    const user = this.users.get(tokenData.userId);
    if (!user) return null;

    // Rotate refresh token
    this.refreshTokens.delete(refreshToken);

    return this.generateTokenPair(user);
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(refreshToken: string): boolean {
    return this.refreshTokens.delete(refreshToken);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  revokeAllRefreshTokens(userId: string): number {
    let count = 0;
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.userId === userId) {
        this.refreshTokens.delete(token);
        count++;
      }
    }
    return count;
  }

  /**
   * Create API key
   */
  createApiKey(params: {
    name: string;
    userId: string;
    scopes: string[];
    rateLimitTier: string;
    expiresAt?: Date;
  }): ApiKey {
    const keyId = `key_${randomBytes(8).toString('hex')}`;
    const rawKey = `${this.config.apiKeyPrefix}${randomBytes(24).toString('hex')}`;
    const keyHash = this.hashApiKey(rawKey);
    const prefix = rawKey.substring(0, 12); // First 12 chars for identification

    const apiKey: ApiKey = {
      id: keyId,
      name: params.name,
      keyHash,
      prefix,
      userId: params.userId,
      scopes: params.scopes,
      rateLimitTier: params.rateLimitTier,
      expiresAt: params.expiresAt,
      createdAt: new Date(),
      isActive: true,
    };

    this.apiKeys.set(keyId, apiKey);

    // Return the raw key only once
    return { ...apiKey, keyHash: rawKey } as any;
  }

  /**
   * Verify API key
   */
  verifyApiKey(rawKey: string): ApiKey | null {
    if (!rawKey.startsWith(this.config.apiKeyPrefix)) return null;

    const keyHash = this.hashApiKey(rawKey);

    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.keyHash === keyHash && apiKey.isActive) {
        // Check expiration
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return null;
        }

        // Update last used
        apiKey.lastUsedAt = new Date();

        return apiKey;
      }
    }

    return null;
  }

  /**
   * Get API key by ID (without raw key)
   */
  getApiKey(keyId: string): ApiKey | null {
    return this.apiKeys.get(keyId) || null;
  }

  /**
   * List API keys for a user
   */
  listApiKeys(userId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(k => k.userId === userId)
      .map(k => ({ ...k, keyHash: '' })); // Don't expose hash
  }

  /**
   * Revoke API key
   */
  revokeApiKey(keyId: string): boolean {
    const key = this.apiKeys.get(keyId);
    if (key) {
      key.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Get user by email
   */
  getUserByEmail(email: string): User | null {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  /**
   * Create user
   */
  createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const id = `user_${randomBytes(8).toString('hex')}`;
    const newUser: User = {
      ...user,
      id,
      createdAt: new Date(),
    };
    this.users.set(id, newUser);
    return newUser;
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: Partial<User>): User | null {
    const user = this.users.get(userId);
    if (!user) return null;

    const updated = { ...user, ...updates };
    this.users.set(userId, updated);
    return updated;
  }

  /**
   * Get rate limit tier configuration
   */
  getRateLimitConfig(tier: string): { requestsPerMinute: number; requestsPerDay: number } {
    const tiers: Record<string, { requestsPerMinute: number; requestsPerDay: number }> = {
      free: { requestsPerMinute: 60, requestsPerDay: 1000 },
      basic: { requestsPerMinute: 300, requestsPerDay: 10000 },
      pro: { requestsPerMinute: 1000, requestsPerDay: 100000 },
      enterprise: { requestsPerMinute: 10000, requestsPerDay: 1000000 },
    };
    return tiers[tier] || tiers.free;
  }

  /**
   * Hash API key
   */
  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Sign data with HMAC
   */
  private sign(data: string): string {
    return createHash('sha256')
      .update(data + this.config.jwtSecret)
      .digest('base64url');
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64url');
  }

  /**
   * Base64 URL decode
   */
  private base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString('utf-8');
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  cleanupExpiredTokens(): number {
    let count = 0;
    const now = new Date();

    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now) {
        this.refreshTokens.delete(token);
        count++;
      }
    }

    return count;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalUsers: number;
    totalApiKeys: number;
    activeApiKeys: number;
    activeRefreshTokens: number;
  } {
    return {
      totalUsers: this.users.size,
      totalApiKeys: this.apiKeys.size,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.isActive).length,
      activeRefreshTokens: this.refreshTokens.size,
    };
  }
}

// Singleton instance
export const authService = new AuthService();

/**
 * Middleware to extract authentication from request
 */
export function createAuthMiddleware(auth: AuthService) {
  return async (request: any, reply: any) => {
    // Try Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = auth.verifyToken(token);
      if (payload) {
        request.auth = {
          userId: payload.sub,
          email: payload.email,
          role: payload.role,
          regionId: payload.regionId,
          permissions: payload.permissions,
          rateLimitTier: payload.rateLimitTier,
        };
        return;
      }
    }

    // Try API key (X-API-Key header or query param)
    const apiKey = request.headers['x-api-key'] || request.query.api_key;
    if (apiKey) {
      const keyData = auth.verifyApiKey(apiKey);
      if (keyData) {
        const user = auth.getUser(keyData.userId);
        if (user) {
          request.auth = {
            userId: user.id,
            email: user.email,
            role: user.role,
            regionId: user.regionId,
            permissions: user.permissions,
            rateLimitTier: keyData.rateLimitTier,
            apiKeyId: keyData.id,
          };
          return;
        }
      }
    }

    // No authentication found - continue without auth
    // Individual routes can require auth
    return;
  };
}

/**
 * Require authentication middleware
 */
export function requireAuth(auth: AuthService, requiredPermissions?: string[]) {
  return async (request: any, reply: any) => {
    if (!request.auth) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some(p =>
        request.auth.permissions.includes(p) || request.auth.permissions.includes('*')
      );

      if (!hasPermission) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
    }

    return;
  };
}

/**
 * Require specific role
 */
export function requireRole(...roles: string[]) {
  return async (request: any, reply: any) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }
    return;
  };
}