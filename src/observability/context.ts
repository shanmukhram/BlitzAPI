/**
 * Trace context management
 * Handles trace ID generation, span creation, and context propagation
 * OPTIMIZED: Direct span access from TraceContext (no lookups)
 */

import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { TraceContext } from './types.js';
import { getTraceContext } from './storage.js';

/**
 * Get current trace context (direct access - FAST)
 */
export function getCurrentTrace(): TraceContext | undefined {
  return getTraceContext();
}

/**
 * Generate trace ID (W3C format - 32 hex characters)
 */
export function generateTraceId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generate span ID (W3C format - 16 hex characters)
 */
export function generateSpanId(): string {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Create root trace context
 * This is called by middleware for each incoming request
 */
export function createTraceContext(
  protocol: 'rest' | 'graphql' | 'grpc',
  operationName: string,
  attributes?: Record<string, any>
): TraceContext {
  const tracer = trace.getTracer('ramapi');

  // Start root span
  const span = tracer.startSpan(operationName, {
    kind: SpanKind.SERVER,
    attributes: {
      'ramapi.protocol': protocol,
      ...attributes,
    },
  });

  const spanContext = span.spanContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    span,
    tracer,
    protocol,
    operationName,
    startTime: performance.now(),
    attributes: attributes || {},
  };
}

/**
 * Create child span from current trace context
 * Uses tracer from context for maximum performance
 */
export function startSpan(
  name: string,
  attributes?: Record<string, any>
): Span {
  const context = getTraceContext();

  if (!context) {
    // Return no-op span if no trace context (observability disabled)
    return trace.getTracer('ramapi').startSpan(name);
  }

  // Use tracer from context (FAST - no lookup)
  const span = context.tracer.startSpan(name, {
    attributes,
  });

  return span;
}

/**
 * End span with status
 */
export function endSpan(
  span: Span,
  error?: Error
): void {
  if (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.recordException(error);
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  span.end();
}

/**
 * Add event to current span
 */
export function addEvent(
  name: string,
  attributes?: Record<string, any>
): void {
  const context = getTraceContext();
  if (!context) return;

  context.span.addEvent(name, attributes);
}

/**
 * Set attributes on current span
 */
export function setAttributes(attributes: Record<string, any>): void {
  const context = getTraceContext();
  if (!context) return;

  context.span.setAttributes(attributes);
  Object.assign(context.attributes, attributes);
}

/**
 * Record exception on current span
 */
export function recordException(error: Error): void {
  const context = getTraceContext();
  if (!context) return;

  context.span.recordException(error);
  context.span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
}
