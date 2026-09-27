/**
 * Circuit Breaker Pattern for Provider Resilience
 * Prevents cascading failures when providers are unhealthy
 */

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation, requests pass through
  OPEN = 'open',         // Failing, requests blocked immediately
  HALF_OPEN = 'half_open' // Testing if provider recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Successes needed to close from half-open
  timeout: number;               // Time in ms before trying half-open
  rollingWindowMs: number;       // Time window for failure counting
  minimumRequests: number;       // Minimum requests before evaluating
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  stateChanges: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,        // 30 seconds
  rollingWindowMs: 60000, // 1 minute
  minimumRequests: 10,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastFailureTime: 0,
    lastSuccessTime: 0,
    stateChanges: 0,
  };
  private recentRequests: Array<{ timestamp: number; success: boolean }> = [];
  private halfOpenAttempts = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is ${this.state}. Provider unavailable.`,
        this.state
      );
    }

    this.metrics.totalRequests++;
    this.recordRequest();

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if operation can be executed
   */
  private canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed to transition to half-open
      if (Date.now() - this.metrics.lastFailureTime >= this.config.timeout) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow limited requests
    return this.halfOpenAttempts < this.config.successThreshold;
  }

  /**
   * Record a request for rolling window statistics
   */
  private recordRequest(): void {
    const now = Date.now();
    this.recentRequests.push({ timestamp: now, success: false }); // Will update on success/failure

    // Clean old requests outside rolling window
    const cutoff = now - this.config.rollingWindowMs;
    this.recentRequests = this.recentRequests.filter(r => r.timestamp > cutoff);
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.metrics.successfulRequests++;
    this.metrics.consecutiveSuccesses++;
    this.metrics.consecutiveFailures = 0;
    this.metrics.lastSuccessTime = Date.now();

    // Update last request as success
    if (this.recentRequests.length > 0) {
      this.recentRequests[this.recentRequests.length - 1].success = true;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.metrics.failedRequests++;
    this.metrics.consecutiveFailures++;
    this.metrics.consecutiveSuccesses = 0;
    this.metrics.lastFailureTime = Date.now();

    // Update last request as failure
    if (this.recentRequests.length > 0) {
      this.recentRequests[this.recentRequests.length - 1].success = false;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open goes back to open
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Determine if circuit should open based on failure rate
   */
  private shouldOpenCircuit(): boolean {
    // Need minimum requests before evaluating
    if (this.metrics.totalRequests < this.config.minimumRequests) {
      return false;
    }

    // Check consecutive failures
    if (this.metrics.consecutiveFailures >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate in rolling window
    if (this.recentRequests.length >= this.config.minimumRequests) {
      const failures = this.recentRequests.filter(r => !r.success).length;
      const failureRate = failures / this.recentRequests.length;
      if (failureRate >= 0.5) { // 50% failure rate
        return true;
      }
    }

    return false;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.metrics.stateChanges++;
      this.halfOpenAttempts = 0;
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.metrics.stateChanges++;
    this.halfOpenAttempts = 0;
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.metrics.stateChanges++;
    this.halfOpenAttempts = 0;
    this.metrics.consecutiveFailures = 0;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get failure rate in rolling window
   */
  getFailureRate(): number {
    if (this.recentRequests.length === 0) return 0;
    const failures = this.recentRequests.filter(r => !r.success).length;
    return failures / this.recentRequests.length;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      stateChanges: 0,
    };
    this.recentRequests = [];
    this.halfOpenAttempts = 0;
  }

  /**
   * Force open (for maintenance)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }

  /**
   * Force close (after maintenance)
   */
  forceClose(): void {
    this.transitionToClosed();
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker Registry - manages circuit breakers for multiple providers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker for a provider
   */
  getBreaker(providerId: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(providerId)) {
      this.breakers.set(providerId, new CircuitBreaker(config));
    }
    return this.breakers.get(providerId)!;
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(providerId: string): boolean {
    return this.breakers.delete(providerId);
  }

  /**
   * Get all breakers
   */
  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus(): Record<string, { state: CircuitState; metrics: CircuitBreakerMetrics; failureRate: number }> {
    const status: Record<string, { state: CircuitState; metrics: CircuitBreakerMetrics; failureRate: number }> = {};

    for (const [providerId, breaker] of this.breakers.entries()) {
      status[providerId] = {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
        failureRate: breaker.getFailureRate(),
      };
    }

    return status;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Singleton instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry();