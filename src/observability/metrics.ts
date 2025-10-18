/**
 * Metrics collection system
 * Tracks request metrics, latency, error rates
 */

import type { RequestMetrics, MetricsConfig } from './types.js';

/**
 * Metrics storage
 */
interface MetricsStore {
  requests: {
    total: number;
    byProtocol: { rest: number; graphql: number; grpc: number };
    byStatusCode: Record<number, number>;
  };
  latencies: number[]; // Store last 1000 latencies for percentile calc
  errors: number;
  startTime: number;
}

const store: MetricsStore = {
  requests: {
    total: 0,
    byProtocol: { rest: 0, graphql: 0, grpc: 0 },
    byStatusCode: {},
  },
  latencies: [],
  errors: 0,
  startTime: Date.now(),
};

/**
 * Metrics configuration
 */
let metricsConfig: {
  enabled: boolean;
  collectInterval: number;
  endpoint?: string;
  prefix: string;
} = {
  enabled: true,
  collectInterval: 60000, // 1 minute
  prefix: 'ramapi',
};

/**
 * Initialize metrics collection
 */
export function initializeMetrics(config?: MetricsConfig): void {
  metricsConfig = {
    enabled: config?.enabled !== false,
    collectInterval: config?.collectInterval || 60000,
    endpoint: config?.endpoint,
    prefix: config?.prefix || 'ramapi',
  };

  if (metricsConfig.enabled) {
    console.log(`✅ Metrics collection initialized (interval: ${metricsConfig.collectInterval}ms, prefix: ${metricsConfig.prefix})`);
  }
}

/**
 * Record a request
 */
export function recordRequest(
  protocol: 'rest' | 'graphql' | 'grpc',
  statusCode: number,
  latencyMs: number
): void {
  if (!metricsConfig.enabled) return;

  // Increment counters
  store.requests.total++;
  store.requests.byProtocol[protocol]++;
  store.requests.byStatusCode[statusCode] = (store.requests.byStatusCode[statusCode] || 0) + 1;

  // Track latency (keep last 1000)
  store.latencies.push(latencyMs);
  if (store.latencies.length > 1000) {
    store.latencies.shift();
  }

  // Track errors
  if (statusCode >= 500) {
    store.errors++;
  }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get current metrics snapshot
 */
export function getMetrics(): RequestMetrics {
  const uptime = Date.now() - store.startTime;
  const uptimeSeconds = uptime / 1000;

  const averageLatency = store.latencies.length > 0
    ? store.latencies.reduce((a, b) => a + b, 0) / store.latencies.length
    : 0;

  const p50Latency = percentile(store.latencies, 50);
  const p95Latency = percentile(store.latencies, 95);
  const p99Latency = percentile(store.latencies, 99);

  const errorRate = store.requests.total > 0
    ? store.errors / store.requests.total
    : 0;

  const requestsPerSecond = store.requests.total / uptimeSeconds;

  return {
    totalRequests: store.requests.total,
    requestsPerSecond,
    averageLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    errorRate,
    byProtocol: store.requests.byProtocol,
    byStatusCode: store.requests.byStatusCode,
  };
}

/**
 * Reset metrics (useful for testing)
 */
export function resetMetrics(): void {
  store.requests.total = 0;
  store.requests.byProtocol = { rest: 0, graphql: 0, grpc: 0 };
  store.requests.byStatusCode = {};
  store.latencies = [];
  store.errors = 0;
  store.startTime = Date.now();
}

/**
 * Export metrics in Prometheus format
 */
export function exportPrometheusMetrics(): string {
  const metrics = getMetrics();

  const lines: string[] = [
    '# HELP ramapi_requests_total Total number of requests',
    '# TYPE ramapi_requests_total counter',
    `ramapi_requests_total ${metrics.totalRequests}`,
    '',
    '# HELP ramapi_requests_per_second Requests per second',
    '# TYPE ramapi_requests_per_second gauge',
    `ramapi_requests_per_second ${metrics.requestsPerSecond.toFixed(2)}`,
    '',
    '# HELP ramapi_latency_average_ms Average latency in milliseconds',
    '# TYPE ramapi_latency_average_ms gauge',
    `ramapi_latency_average_ms ${metrics.averageLatency.toFixed(2)}`,
    '',
    '# HELP ramapi_latency_p95_ms P95 latency in milliseconds',
    '# TYPE ramapi_latency_p95_ms gauge',
    `ramapi_latency_p95_ms ${metrics.p95Latency.toFixed(2)}`,
    '',
    '# HELP ramapi_latency_p99_ms P99 latency in milliseconds',
    '# TYPE ramapi_latency_p99_ms gauge',
    `ramapi_latency_p99_ms ${metrics.p99Latency.toFixed(2)}`,
    '',
    '# HELP ramapi_error_rate Error rate (5xx)',
    '# TYPE ramapi_error_rate gauge',
    `ramapi_error_rate ${metrics.errorRate.toFixed(4)}`,
    '',
    '# HELP ramapi_requests_by_protocol Requests by protocol',
    '# TYPE ramapi_requests_by_protocol counter',
    `ramapi_requests_by_protocol{protocol="rest"} ${metrics.byProtocol.rest}`,
    `ramapi_requests_by_protocol{protocol="graphql"} ${metrics.byProtocol.graphql}`,
    `ramapi_requests_by_protocol{protocol="grpc"} ${metrics.byProtocol.grpc}`,
    '',
  ];

  // Add status code metrics
  lines.push('# HELP ramapi_requests_by_status Requests by status code');
  lines.push('# TYPE ramapi_requests_by_status counter');
  for (const [code, count] of Object.entries(metrics.byStatusCode)) {
    lines.push(`ramapi_requests_by_status{code="${code}"} ${count}`);
  }

  return lines.join('\n');
}
