/**
 * gRPC metadata propagation for trace context
 * Supports W3C Trace Context via gRPC metadata
 */

import type { Metadata } from '@grpc/grpc-js';
import { context } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

const propagator = new W3CTraceContextPropagator();

/**
 * Extract trace context from gRPC metadata
 * Called automatically when gRPC requests are received
 */
export function extractTraceFromMetadata(metadata: Metadata): any {
  const carrier: Record<string, string> = {};

  // Convert gRPC metadata to carrier format
  const metadataMap = metadata.getMap();
  for (const [key, value] of Object.entries(metadataMap)) {
    if (value) {
      carrier[key] = String(Array.isArray(value) ? value[0] : value);
    }
  }

  return propagator.extract(context.active(), carrier, {
    get: (carrier, key) => carrier[key],
    keys: (carrier) => Object.keys(carrier),
  });
}

/**
 * Inject trace context into gRPC metadata
 * For outgoing gRPC calls to propagate trace context
 */
export function injectTraceIntoMetadata(metadata: Metadata): void {
  const carrier: Record<string, string> = {};

  propagator.inject(context.active(), carrier, {
    set: (carrier, key, value) => {
      carrier[key] = value;
    },
  });

  // Inject into metadata
  for (const [key, value] of Object.entries(carrier)) {
    metadata.set(key, value);
  }
}
