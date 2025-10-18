/**
 * OpenTelemetry tracer initialization
 * Sets up tracing with configurable exporters
 */

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import type { ObservabilityConfig, TracingConfig } from './types.js';

let provider: NodeTracerProvider | undefined;
let tracingConfig: TracingConfig | undefined;

/**
 * Initialize OpenTelemetry tracing with full configuration support
 */
export function initializeTracing(config: ObservabilityConfig = {}): void {
  // Skip if already initialized
  if (provider) return;

  // Skip if globally disabled
  if (config.enabled === false) {
    console.log('⏭️  Observability globally disabled');
    return;
  }

  // Skip if tracing disabled
  if (config.tracing?.enabled === false) {
    console.log('⏭️  Tracing disabled');
    return;
  }

  // Store config for runtime access
  tracingConfig = {
    enabled: true,
    serviceName: config.tracing?.serviceName || 'ramapi',
    serviceVersion: config.tracing?.serviceVersion || '0.1.0',
    exporter: config.tracing?.exporter || 'console',
    endpoint: config.tracing?.endpoint || 'http://localhost:4318/v1/traces',
    sampleRate: config.tracing?.sampleRate ?? (process.env.NODE_ENV === 'production' ? 0.1 : 1.0),
    captureStackTraces: config.tracing?.captureStackTraces ?? true,
    maxSpanAttributes: config.tracing?.maxSpanAttributes ?? 128,
    redactHeaders: config.tracing?.redactHeaders || ['authorization', 'cookie', 'x-api-key'],
    captureRequestBody: config.tracing?.captureRequestBody ?? false,
    captureResponseBody: config.tracing?.captureResponseBody ?? false,
    spanNaming: config.tracing?.spanNaming || 'default',
    defaultAttributes: config.tracing?.defaultAttributes || {},
  };

  // Create provider with resource
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: tracingConfig.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: tracingConfig.serviceVersion || '0.1.0',
    ...tracingConfig.defaultAttributes,
  });

  // Configure exporter
  let spanExporter;
  let processorType: 'simple' | 'batch' = 'batch';

  switch (tracingConfig.exporter) {
    case 'console':
      spanExporter = new ConsoleSpanExporter();
      processorType = 'simple'; // Immediate for dev
      break;

    case 'otlp':
      spanExporter = new OTLPTraceExporter({
        url: tracingConfig.endpoint,
      });
      break;

    case 'memory':
      // In-memory exporter for testing/dashboard
      spanExporter = new ConsoleSpanExporter(); // Fallback for now
      console.warn('⚠️  Memory exporter not yet implemented, using console');
      break;

    default:
      spanExporter = new ConsoleSpanExporter();
  }

  // Create span processor
  const processor = processorType === 'simple'
    ? new SimpleSpanProcessor(spanExporter)
    : new BatchSpanProcessor(spanExporter, {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000, // Export every 5s
      });

  // Create provider with resource and span processors
  provider = new NodeTracerProvider({
    resource,
    spanProcessors: [processor],
  });

  // Register provider
  provider.register();

  const sampleRate = tracingConfig.sampleRate || 1.0;
  console.log(`✅ Tracing initialized (service: ${tracingConfig.serviceName}, exporter: ${tracingConfig.exporter}, sample: ${sampleRate * 100}%)`);
}

/**
 * Get current tracing configuration
 */
export function getTracingConfig(): TracingConfig | undefined {
  return tracingConfig;
}

/**
 * Shutdown tracing gracefully
 */
export async function shutdownTracing(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = undefined;
    console.log('🛑 Tracing shut down');
  }
}
