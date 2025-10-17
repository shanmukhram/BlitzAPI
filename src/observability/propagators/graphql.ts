/**
 * GraphQL context propagation for trace context
 * Injects trace context into GraphQL resolver context
 */

import type { TraceContext } from '../types.js';
import { getCurrentTrace } from '../context.js';

/**
 * Inject trace context into GraphQL resolver context
 * Called automatically when GraphQL requests are processed
 */
export function injectTraceIntoGraphQLContext(
  graphqlContext: any
): void {
  const trace = getCurrentTrace();
  if (trace) {
    graphqlContext.trace = trace;
  }
}

/**
 * Extract trace from GraphQL context
 * Used by resolvers to access trace context
 */
export function extractTraceFromGraphQLContext(
  graphqlContext: any
): TraceContext | undefined {
  // GraphQL context has ctx which has trace
  return graphqlContext?.ctx?.trace;
}
