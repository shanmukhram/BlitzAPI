/**
 * Observability types for tracing, logging, and metrics
 * Phase 3.0: Foundation for distributed tracing - CORE USP
 */

import type { Span, Tracer } from '@opentelemetry/api';

/**
 * Trace context - propagated across all protocol layers
 * This is the CORE of our observability USP
 */
export interface TraceContext {
  traceId: string;          // W3C trace ID (32 hex chars)
  spanId: string;           // W3C span ID (16 hex chars)
  parentSpanId?: string;    // Parent span ID for nested spans
  span: Span;               // Active OpenTelemetry span
  tracer: Tracer;           // Tracer instance for child spans
  protocol: 'rest' | 'graphql' | 'grpc';
  operationName?: string;   // Operation being traced
  startTime: number;        // High-resolution start time (hrtime)
  attributes: Record<string, any>;  // Span attributes
}

/**
 * Tracing configuration
 */
export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion?: string;
  exporter?: 'console' | 'otlp' | 'memory';
  endpoint?: string;  // OTLP endpoint
  sampleRate?: number;  // 0-1, default 1.0 (100%)

  // Advanced options
  captureStackTraces?: boolean;  // Capture stack traces on errors
  maxSpanAttributes?: number;    // Prevent memory bloat (default: 128)
  redactHeaders?: string[];      // Headers to redact in spans
  captureRequestBody?: boolean;  // Capture request bodies (opt-in, default: false)
  captureResponseBody?: boolean; // Capture response bodies (opt-in, default: false)
  spanNaming?: 'default' | 'http.route' | 'operation';
  defaultAttributes?: Record<string, any>;  // Default attributes for all spans
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  enabled: boolean;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  format: 'json' | 'pretty';
  redactFields?: string[];  // PII fields to redact
  includeStackTrace?: boolean;  // Include stack traces in error logs
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  enabled: boolean;
  collectInterval?: number;  // Collection interval in ms (default: 60000)
  endpoint?: string;         // Metrics push endpoint
  prefix?: string;           // Metric name prefix (default: 'blitzapi')
}

/**
 * Health check configuration
 */
export interface HealthConfig {
  enabled: boolean;
  path?: string;  // default: /health
  includeMetrics?: boolean;  // Include basic metrics in health response
}

/**
 * Metrics endpoint configuration
 */
export interface MetricsEndpointConfig {
  enabled: boolean;
  path?: string;  // default: /metrics
  format?: 'prometheus' | 'json';
}

/**
 * Profiling configuration (Phase 3.1)
 */
export interface ProfilingConfig {
  enabled: boolean;
  captureMemory?: boolean;      // Enable memory profiling (adds overhead)
  bufferSize?: number;          // Number of profiles to keep in memory (default: 100)
  slowThreshold?: number;       // ms - what's considered "slow" (default: 1000)
  enableBudgets?: boolean;      // Enable performance budgets
  autoDetectBottlenecks?: boolean;  // Automatic bottleneck detection
  captureStacks?: boolean;      // Capture stack traces for slow operations
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  enabled?: boolean;  // Global toggle (default: true)
  tracing?: TracingConfig;
  logging?: LoggingConfig;
  metrics?: MetricsConfig;
  health?: HealthConfig;
  metricsEndpoint?: MetricsEndpointConfig;
  profiling?: ProfilingConfig;  // Phase 3.1: Performance profiling
}

/**
 * Span attributes for structured metadata
 */
export interface SpanAttributes {
  // HTTP attributes
  'http.method'?: string;
  'http.url'?: string;
  'http.status_code'?: number;
  'http.route'?: string;
  'http.request_content_length'?: number;
  'http.response_content_length'?: number;

  // GraphQL attributes
  'graphql.operation.name'?: string;
  'graphql.operation.type'?: 'query' | 'mutation' | 'subscription';
  'graphql.document'?: string;

  // gRPC attributes
  'rpc.service'?: string;
  'rpc.method'?: string;
  'rpc.system'?: 'grpc';

  // Custom attributes
  'user.id'?: string;
  'operation.name'?: string;
  'error'?: boolean;
  'error.message'?: string;
  'error.stack'?: string;

  [key: string]: any;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  traceId?: string;
  spanId?: string;
  protocol?: string;
  operationName?: string;
  metadata?: Record<string, any>;
  stack?: string;  // Stack trace for errors
}

/**
 * Request metrics snapshot
 */
export interface RequestMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  byProtocol: {
    rest: number;
    graphql: number;
    grpc: number;
  };
  byStatusCode: Record<number, number>;
}

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    http: boolean;
    grpc?: boolean;
    database?: boolean;
  };
  metrics?: RequestMetrics;
}
