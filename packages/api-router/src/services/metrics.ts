/**
 * Metrics Service - Prometheus-compatible metrics collection
 */

export interface MetricLabels {
  [key: string]: string;
}

export interface CounterMetric {
  name: string;
  help: string;
  type: 'counter';
  value: number;
  labels: MetricLabels;
}

export interface GaugeMetric {
  name: string;
  help: string;
  type: 'gauge';
  value: number;
  labels: MetricLabels;
}

export interface HistogramMetric {
  name: string;
  help: string;
  type: 'histogram';
  buckets: Map<string, number>;
  sum: number;
  count: number;
  labels: MetricLabels;
}

export interface SummaryMetric {
  name: string;
  help: string;
  type: 'summary';
  quantiles: Map<number, number>;
  sum: number;
  count: number;
  labels: MetricLabels;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric | SummaryMetric;

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const DEFAULT_QUANTILES = [0.5, 0.9, 0.95, 0.99];

export class MetricsService {
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private histograms: Map<string, HistogramMetric> = new Map();
  private summaries: Map<string, SummaryMetric> = new Map();
  private defaultLabels: MetricLabels = {};

  constructor(defaultLabels: MetricLabels = {}) {
    this.defaultLabels = defaultLabels;

    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // HTTP metrics
    this.createCounter('http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
    this.createHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', ['method', 'path', 'status']);
    this.createHistogram('http_request_size_bytes', 'HTTP request size in bytes', ['method', 'path']);
    this.createHistogram('http_response_size_bytes', 'HTTP response size in bytes', ['method', 'path']);

    // API metrics
    this.createCounter('api_requests_total', 'Total API requests', ['endpoint', 'status']);
    this.createHistogram('api_request_duration_seconds', 'API request duration in seconds', ['endpoint']);

    // Provider metrics
    this.createCounter('provider_requests_total', 'Total provider requests', ['provider', 'task', 'status']);
    this.createHistogram('provider_latency_seconds', 'Provider API latency in seconds', ['provider', 'task']);
    this.createCounter('provider_errors_total', 'Total provider errors', ['provider', 'task', 'error_type']);

    // Cache metrics
    this.createCounter('cache_hits_total', 'Total cache hits', ['cache_type']);
    this.createCounter('cache_misses_total', 'Total cache misses', ['cache_type']);
    this.createGauge('cache_size_bytes', 'Current cache size in bytes', ['cache_type']);

    // Rate limiter metrics
    this.createCounter('rate_limit_exceeded_total', 'Total rate limit exceeded', ['rule', 'tier']);
    this.createGauge('rate_limit_remaining', 'Remaining requests in current window', ['rule', 'tier']);

    // Circuit breaker metrics
    this.createGauge('circuit_breaker_state', 'Circuit breaker state (0=closed, 1=half-open, 2=open)', ['provider']);
    this.createCounter('circuit_breaker_state_changes_total', 'Total circuit breaker state changes', ['provider', 'from_state', 'to_state']);

    // Database metrics
    this.createHistogram('db_query_duration_seconds', 'Database query duration in seconds', ['query_type', 'table']);
    this.createCounter('db_errors_total', 'Total database errors', ['query_type', 'error_type']);

    // Business metrics
    this.createCounter('disease_detections_total', 'Total disease detections', ['region', 'crop', 'disease', 'source']);
    this.createCounter('yield_predictions_total', 'Total yield predictions', ['region', 'crop', 'season']);
    this.createCounter('advisory_requests_total', 'Total advisory requests', ['region', 'crop', 'disease', 'language']);
    this.createGauge('active_farmers', 'Number of active farmers', ['region']);
    this.createGauge('active_fields', 'Number of active fields', ['region']);
  }

  /**
   * Create a counter metric
   */
  createCounter(name: string, help: string, labelNames: string[] = []): CounterMetric {
    const key = this.getMetricKey(name);
    if (this.counters.has(key)) return this.counters.get(key)!;

    const metric: CounterMetric = {
      name,
      help,
      type: 'counter',
      value: 0,
      labels: {},
    };
    this.counters.set(key, metric);
    return metric;
  }

  /**
   * Create a gauge metric
   */
  createGauge(name: string, help: string, labelNames: string[] = []): GaugeMetric {
    const key = this.getMetricKey(name);
    if (this.gauges.has(key)) return this.gauges.get(key)!;

    const metric: GaugeMetric = {
      name,
      help,
      type: 'gauge',
      value: 0,
      labels: {},
    };
    this.gauges.set(key, metric);
    return metric;
  }

  /**
   * Create a histogram metric
   */
  createHistogram(name: string, help: string, labelNames: string[] = [], buckets: number[] = DEFAULT_BUCKETS): HistogramMetric {
    const key = this.getMetricKey(name);
    if (this.histograms.has(key)) return this.histograms.get(key)!;

    const bucketMap = new Map<string, number>();
    for (const bucket of buckets) {
      bucketMap.set(bucket.toString(), 0);
    }
    bucketMap.set('+Inf', 0);

    const metric: HistogramMetric = {
      name,
      help,
      type: 'histogram',
      buckets: bucketMap,
      sum: 0,
      count: 0,
      labels: {},
    };
    this.histograms.set(key, metric);
    return metric;
  }

  /**
   * Create a summary metric
   */
  createSummary(name: string, help: string, labelNames: string[] = [], quantiles: number[] = DEFAULT_QUANTILES): SummaryMetric {
    const key = this.getMetricKey(name);
    if (this.summaries.has(key)) return this.summaries.get(key)!;

    const quantileMap = new Map<number, number>();
    for (const q of quantiles) {
      quantileMap.set(q, 0);
    }

    const metric: SummaryMetric = {
      name,
      help,
      type: 'summary',
      quantiles: quantileMap,
      sum: 0,
      count: 0,
      labels: {},
    };
    this.summaries.set(key, metric);
    return metric;
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: MetricLabels = {}, value = 1): void {
    const key = this.getMetricKey(name);
    const metric = this.counters.get(key);
    if (!metric) return;

    const labelKey = this.labelsToString(labels);
    const fullKey = `${key}{${labelKey}}`;

    // For simplicity, we store single value per label combination
    metric.value += value;
    metric.labels = labels;
  }

  /**
   * Increment counter with multiple label combinations
   */
  incrementCounterWithLabels(name: string, labelsArray: MetricLabels[], value = 1): void {
    for (const labels of labelsArray) {
      this.incrementCounter(name, labels, value);
    }
  }

  /**
   * Set gauge value
   */
  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.getMetricKey(name);
    const metric = this.gauges.get(key);
    if (!metric) return;

    metric.value = value;
    metric.labels = labels;
  }

  /**
   * Observe histogram value
   */
  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.getMetricKey(name);
    const metric = this.histograms.get(key);
    if (!metric) return;

    // Find appropriate bucket
    for (const [bucket, count] of metric.buckets) {
      const bucketValue = parseFloat(bucket);
      if (value <= bucketValue || bucket === '+Inf') {
        metric.buckets.set(bucket, count + 1);
        break;
      }
    }

    metric.sum += value;
    metric.count++;
    metric.labels = labels;
  }

  /**
   * Observe summary value
   */
  observeSummary(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.getMetricKey(name);
    const metric = this.summaries.get(key);
    if (!metric) return;

    metric.sum += value;
    metric.count++;

    // Update quantiles (approximate using single value)
    for (const [q, current] of metric.quantiles) {
      if (metric.count === 1) {
        metric.quantiles.set(q, value);
      } else {
        // Simple running estimate (not statistically accurate but close enough)
        metric.quantiles.set(q, (current * (metric.count - 1) + value) / metric.count);
      }
    }

    metric.labels = labels;
  }

  /**
   * Time a function execution
   */
  async time<T>(name: string, fn: () => Promise<T>, labels: MetricLabels = {}): Promise<T> {
    const start = process.hrtime.bigint();
    try {
      return await fn();
    } finally {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.observeHistogram(name, durationMs / 1000, labels); // Convert to seconds
    }
  }

  /**
   * Time a synchronous function
   */
  timeSync<T>(name: string, fn: () => T, labels: MetricLabels = {}): T {
    const start = process.hrtime.bigint();
    try {
      return fn();
    } finally {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.observeHistogram(name, durationMs / 1000, labels);
    }
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    const lines: string[] = [];

    // Helper to format labels
    const formatLabels = (labels: MetricLabels): string => {
      if (Object.keys(labels).length === 0) return '';
      return '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}';
    };

    // Counters
    for (const [, metric] of this.counters) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} counter`);
      const labelStr = formatLabels(metric.labels);
      lines.push(`${metric.name}${labelStr} ${metric.value}`);
    }

    // Gauges
    for (const [, metric] of this.gauges) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} gauge`);
      const labelStr = formatLabels(metric.labels);
      lines.push(`${metric.name}${labelStr} ${metric.value}`);
    }

    // Histograms
    for (const [, metric] of this.histograms) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} histogram`);
      const labelStr = formatLabels(metric.labels);

      let cumulativeCount = 0;
      for (const [bucket, count] of metric.buckets) {
        cumulativeCount += count;
        const bucketLabel = bucket === '+Inf' ? '+Inf' : bucket;
        lines.push(`${metric.name}_bucket${labelStr.replace('}', `,le="${bucketLabel}"}`)} ${cumulativeCount}`);
      }
      lines.push(`${metric.name}_sum${labelStr} ${metric.sum}`);
      lines.push(`${metric.name}_count${labelStr} ${metric.count}`);
    }

    // Summaries
    for (const [, metric] of this.summaries) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} summary`);
      const labelStr = formatLabels(metric.labels);

      for (const [quantile, value] of metric.quantiles) {
        lines.push(`${metric.name}${labelStr.replace('}', `,quantile="${quantile}"}`)} ${value}`);
      }
      lines.push(`${metric.name}_sum${labelStr} ${metric.sum}`);
      lines.push(`${metric.name}_count${labelStr} ${metric.count}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsAsJson(): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // Counters
    result.counters = {};
    for (const [key, metric] of this.counters) {
      result.counters[key] = { ...metric, value: metric.value };
    }

    // Gauges
    result.gauges = {};
    for (const [key, metric] of this.gauges) {
      result.gauges[key] = { ...metric, value: metric.value };
    }

    // Histograms
    result.histograms = {};
    for (const [key, metric] of this.histograms) {
      result.histograms[key] = { ...metric, buckets: Object.fromEntries(metric.buckets) };
    }

    // Summaries
    result.summaries = {};
    for (const [key, metric] of this.summaries) {
      result.summaries[key] = { ...metric, quantiles: Object.fromEntries(metric.quantiles) };
    }

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.initializeDefaultMetrics();
  }

  private getMetricKey(name: string): string {
    return name;
  }

  private labelsToString(labels: MetricLabels): string {
    return Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
  }

  /**
   * Set default labels for all metrics
   */
  setDefaultLabels(labels: MetricLabels): void {
    this.defaultLabels = { ...this.defaultLabels, ...labels };
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): Metric | undefined {
    const key = this.getMetricKey(name);
    return this.counters.get(key) || this.gauges.get(key) || this.histograms.get(key) || this.summaries.get(key);
  }
}

// Singleton instance
export const metricsService = new MetricsService({ service: 'agrisense-api' });

/**
 * Middleware to collect HTTP metrics
 */
export function createMetricsMiddleware(metrics: MetricsService) {
  return async (request: any, reply: any) => {
    const start = process.hrtime.bigint();

    // Add response hook to capture metrics after response
    reply.raw.addListener('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const durationSec = durationMs / 1000;

      const method = request.method;
      const path = request.routeOptions?.url || request.url;
      const status = reply.statusCode.toString();

      // Record metrics
      metrics.incrementCounter('http_requests_total', { method, path, status });
      metrics.observeHistogram('http_request_duration_seconds', durationSec, { method, path, status });
      metrics.observeHistogram('http_request_size_bytes', request.headers['content-length'] ? parseInt(request.headers['content-length']) : 0, { method, path });
      metrics.observeHistogram('http_response_size_bytes', reply.getHeader('content-length') ? parseInt(reply.getHeader('content-length') as string) : 0, { method, path });
    });

    return;
  };
}

/**
 * Decorator for timing methods
 */
export function Timed(metricName: string, labels: MetricLabels = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return metricsService.time(metricName, () => originalMethod.apply(this, args), labels);
    };

    return descriptor;
  };
}