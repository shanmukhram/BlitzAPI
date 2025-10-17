/**
 * AsyncLocalStorage wrapper for trace context propagation
 * Uses Node.js AsyncLocalStorage to maintain context across async operations
 * SIMPLIFIED: Stores TraceContext directly (no wrapper needed)
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { TraceContext } from './types.js';

/**
 * Global async local storage instance
 * Stores TraceContext directly for maximum performance
 */
export const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Get current trace context from async storage
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore();
}

/**
 * Set attribute in current trace context
 */
export function setTraceAttribute(key: string, value: any): void {
  const context = traceStorage.getStore();
  if (context) {
    context.attributes[key] = value;
    context.span.setAttribute(key, value);
  }
}

/**
 * Get attribute from current trace context
 */
export function getTraceAttribute(key: string): any {
  const context = traceStorage.getStore();
  return context?.attributes[key];
}

/**
 * Run function with trace context
 */
export function runWithTrace<T>(
  traceContext: TraceContext,
  fn: () => T
): T {
  return traceStorage.run(traceContext, fn);
}

/**
 * Run async function with trace context
 */
export async function runWithTraceAsync<T>(
  traceContext: TraceContext,
  fn: () => Promise<T>
): Promise<T> {
  return traceStorage.run(traceContext, fn);
}
