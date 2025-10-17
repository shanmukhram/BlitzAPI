/**
 * Trace middleware for automatic request tracing
 * Entry point for all requests - creates root span
 * OPTIMIZED: Direct span access from TraceContext (no lookups)
 */

import type { Middleware } from '../core/types.js';
import { createTraceContext, endSpan, startSpan } from './context.js';
import { runWithTraceAsync } from './storage.js';
import { SpanStatusCode } from '@opentelemetry/api';
// import { extractTraceFromHeaders } from './propagators/rest.js'; // TODO: Use for distributed tracing
import { recordRequest } from './metrics.js';

/**
 * Trace middleware - automatically creates trace context for every request
 * This should be the FIRST middleware in the chain
 */
export function traceMiddleware(): Middleware {
  return async (ctx, next) => {
    const startTime = performance.now();

    // Extract parent trace context from headers (distributed tracing)
    // TODO: Use parentContext for distributed tracing
    // const parentContext = extractTraceFromHeaders(ctx.req.headers);

    // Create trace context with proper operation name
    const operationName = `${ctx.method} ${ctx.path}`;
    const traceContext = createTraceContext(
      'rest', // Will be overridden by protocol manager for GraphQL/gRPC
      operationName,
      {
        'http.method': ctx.method,
        'http.url': ctx.req.url,
        'http.path': ctx.path,
        'http.user_agent': ctx.req.headers['user-agent'] || 'unknown',
      }
    );

    // Inject trace ID into response headers
    ctx.res.setHeader('X-Trace-Id', traceContext.traceId);
    ctx.res.setHeader('X-Span-Id', traceContext.spanId);

    // Attach trace context to Context (for user access)
    (ctx as any).trace = traceContext;

    try {
      // Run middleware chain with trace context
      await runWithTraceAsync(traceContext, async () => {
        await next();
      });

      // Record successful request
      const duration = performance.now() - startTime;
      const statusCode = ctx.res.statusCode;

      // Set final span attributes
      traceContext.span.setAttributes({
        'http.status_code': statusCode,
        'http.response.duration_ms': duration,
      });

      // Set span status
      if (statusCode >= 500) {
        traceContext.span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${statusCode}`,
        });
      } else {
        traceContext.span.setStatus({ code: SpanStatusCode.OK });
      }

      // Record metrics
      recordRequest(traceContext.protocol, statusCode, duration);
    } catch (error) {
      const duration = performance.now() - startTime;

      // Record error in span
      const err = error as Error;
      traceContext.span.recordException(err);
      traceContext.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message,
      });

      traceContext.span.setAttributes({
        'error': true,
        'error.message': err.message,
        'error.stack': err.stack,
      });

      // Record error metrics
      const statusCode = ctx.res.statusCode || 500;
      recordRequest(traceContext.protocol, statusCode, duration);

      throw error;
    } finally {
      // End root span
      endSpan(traceContext.span);
    }
  };
}

/**
 * Operation timing middleware - measures handler execution time
 * Creates a child span for the actual handler logic
 */
export function timingMiddleware(): Middleware {
  return async (ctx, next) => {
    const trace = (ctx as any).trace;
    if (!trace) {
      // No trace context, skip timing
      await next();
      return;
    }

    // Create child span for handler execution
    const span = startSpan('handler.execution', {
      'operation.name': trace.operationName,
      'operation.protocol': trace.protocol,
    });

    const startTime = performance.now();

    try {
      await next();

      const duration = performance.now() - startTime;
      span.setAttribute('handler.duration_ms', duration);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      const duration = performance.now() - startTime;

      span.setAttribute('handler.duration_ms', duration);
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });

      throw error;
    } finally {
      endSpan(span);
    }
  };
}
