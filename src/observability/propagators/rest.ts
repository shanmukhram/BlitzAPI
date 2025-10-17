/**
 * REST HTTP header propagation for trace context
 * Supports W3C Trace Context format (traceparent header)
 */

import { context } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import type { IncomingHttpHeaders } from 'http';

const propagator = new W3CTraceContextPropagator();

/**
 * Extract trace context from HTTP headers
 * Supports W3C Trace Context (traceparent, tracestate)
 */
export function extractTraceFromHeaders(
  headers: IncomingHttpHeaders
): any {
  // Normalize headers to string values for propagator
  const carrier: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      carrier[key.toLowerCase()] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      carrier[key.toLowerCase()] = value[0];
    }
  }

  // Extract using W3C Trace Context format
  return propagator.extract(context.active(), carrier, {
    get: (carrier, key) => carrier[key.toLowerCase()],
    keys: (carrier) => Object.keys(carrier),
  });
}

/**
 * Inject trace context into HTTP headers
 * For outgoing requests to propagate trace context
 */
export function injectTraceIntoHeaders(
  headers: Record<string, string>
): void {
  propagator.inject(context.active(), headers, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });
}
