/**
 * Flow Tracker - Automatically capture request lifecycle events
 * Phase 3.6: Request Flow Visualization
 */

import type { Context, Middleware } from '../../core/types.js';
import type { FlowEvent, FlowEventType, FlowEventStatus, RequestFlow } from './types.js';
import { getCurrentTrace } from '../context.js';
import { flowStorage } from './storage.js';

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Flow context stored on the request context
 * Contains all events for the current request
 */
interface FlowContext {
  traceId: string;
  spanId: string;
  operationName: string;
  method: string;
  path: string;
  startTime: number;
  events: FlowEvent[];
  eventStack: string[]; // Stack of currently active event IDs
  dependencies: {
    database: any[];
    http: any[];
    cache: any[];
  };
}

/**
 * Get or create flow context for the current request
 */
function getFlowContext(ctx: Context): FlowContext | undefined {
  return (ctx as any)._flowContext;
}

/**
 * Initialize flow context for a request
 */
function initFlowContext(ctx: Context): FlowContext {
  const trace = getCurrentTrace() || (ctx as any).trace;

  if (!trace) {
    throw new Error('Flow tracking requires tracing to be enabled');
  }

  const flowContext: FlowContext = {
    traceId: trace.traceId,
    spanId: trace.spanId,
    operationName: trace.operationName || `${ctx.method} ${ctx.path}`,
    method: ctx.method,
    path: ctx.path,
    startTime: performance.now(),
    events: [],
    eventStack: [],
    dependencies: {
      database: [],
      http: [],
      cache: [],
    },
  };

  (ctx as any)._flowContext = flowContext;
  return flowContext;
}

/**
 * Record a flow event
 */
export function recordFlowEvent(
  ctx: Context,
  type: FlowEventType,
  name: string,
  status: FlowEventStatus = 'started',
  metadata?: Record<string, any>
): string {
  const flowContext = getFlowContext(ctx);
  if (!flowContext) {
    return ''; // Flow tracking not enabled
  }

  const eventId = generateEventId();
  const parentId = flowContext.eventStack.length > 0
    ? flowContext.eventStack[flowContext.eventStack.length - 1]
    : undefined;

  const event: FlowEvent = {
    id: eventId,
    traceId: flowContext.traceId,
    type,
    name,
    status,
    startTime: performance.now(),
    parentId,
    metadata,
  };

  flowContext.events.push(event);

  // If started, push to stack
  if (status === 'started') {
    flowContext.eventStack.push(eventId);
  }

  return eventId;
}

/**
 * Complete a flow event (mark as completed and calculate duration)
 */
export function completeFlowEvent(
  ctx: Context,
  eventId: string,
  status: FlowEventStatus = 'completed',
  metadata?: Record<string, any>
): void {
  const flowContext = getFlowContext(ctx);
  if (!flowContext) return;

  const event = flowContext.events.find(e => e.id === eventId);
  if (!event) return;

  const endTime = performance.now();
  event.endTime = endTime;
  event.duration = endTime - event.startTime;
  event.status = status;

  // Merge metadata if provided
  if (metadata) {
    event.metadata = { ...event.metadata, ...metadata };
  }

  // Pop from stack if it's the top event
  const topEvent = flowContext.eventStack[flowContext.eventStack.length - 1];
  if (topEvent === eventId) {
    flowContext.eventStack.pop();
  }
}

/**
 * Record an error on a flow event
 */
export function recordFlowEventError(
  ctx: Context,
  eventId: string,
  error: Error
): void {
  const flowContext = getFlowContext(ctx);
  if (!flowContext) return;

  const event = flowContext.events.find(e => e.id === eventId);
  if (!event) return;

  event.status = 'error';
  event.error = {
    message: error.message,
    stack: error.stack,
  };

  completeFlowEvent(ctx, eventId, 'error');
}

/**
 * Flow tracking middleware
 * Auto-captures lifecycle events: routing, middleware, handler, serialization
 */
export function flowTrackingMiddleware(): Middleware {
  return async (ctx, next) => {
    // Check if flow tracking is enabled (requires tracing)
    const trace = (ctx as any).trace;
    if (!trace) {
      // Flow tracking requires tracing, skip
      await next();
      return;
    }

    // Initialize flow context
    initFlowContext(ctx);

    // Record request start event
    const requestEventId = recordFlowEvent(ctx, 'lifecycle', 'Request Started', 'started', {
      method: ctx.method,
      path: ctx.path,
      headers: {
        'user-agent': ctx.req.headers['user-agent'],
        'content-type': ctx.req.headers['content-type'],
      },
    });

    try {
      // Track routing (happens before handler execution)
      const routingEventId = recordFlowEvent(ctx, 'lifecycle', 'Routing', 'started');
      // Routing is very fast, complete immediately
      completeFlowEvent(ctx, routingEventId, 'completed');

      // Execute next middleware/handler
      await next();

      // Record response serialization
      const serializationEventId = recordFlowEvent(ctx, 'lifecycle', 'Response Serialization', 'started');
      completeFlowEvent(ctx, serializationEventId, 'completed', {
        statusCode: ctx.res.statusCode,
        contentType: ctx.res.getHeader?.('content-type'),
      });

      // Complete request event
      completeFlowEvent(ctx, requestEventId, 'completed', {
        statusCode: ctx.res.statusCode,
      });

      // Store the flow for later retrieval
      const flow = getRequestFlow(ctx);
      if (flow) {
        flowStorage.store(flow);
      }

    } catch (error) {
      // Record error
      recordFlowEventError(ctx, requestEventId, error as Error);

      // Still store the flow even on error
      const flow = getRequestFlow(ctx);
      if (flow) {
        flowStorage.store(flow);
      }

      throw error;
    }
  };
}

/**
 * Create a flow-tracked middleware wrapper
 * Wraps user middleware to automatically track execution time
 */
export function trackedMiddleware(name: string, middleware: Middleware): Middleware {
  return async (ctx, next) => {
    const eventId = recordFlowEvent(ctx, 'middleware', name, 'started');

    try {
      await middleware(ctx, next);
      completeFlowEvent(ctx, eventId, 'completed');
    } catch (error) {
      recordFlowEventError(ctx, eventId, error as Error);
      throw error;
    }
  };
}

/**
 * Get the complete flow for the current request
 * This is called at the end of request processing to extract the full flow
 */
export function getRequestFlow(ctx: Context): RequestFlow | undefined {
  const flowContext = getFlowContext(ctx);
  if (!flowContext) return undefined;

  const endTime = performance.now();
  const duration = endTime - flowContext.startTime;

  // Calculate statistics
  const databaseTime = flowContext.dependencies.database.reduce(
    (sum, call) => sum + call.duration,
    0
  );
  const httpTime = flowContext.dependencies.http.reduce(
    (sum, call) => sum + call.duration,
    0
  );
  const cacheTime = flowContext.dependencies.cache.reduce(
    (sum, call) => sum + call.duration,
    0
  );

  // Calculate phase durations from lifecycle events
  const routingEvent = flowContext.events.find(e => e.name === 'Routing');
  const responseEvent = flowContext.events.find(e => e.name === 'Response Serialization');

  const routingDuration = routingEvent?.duration || 0;
  const responseDuration = responseEvent?.duration || 0;
  const handlerDuration = duration - routingDuration - responseDuration;

  // Calculate percentages
  const routingPercentage = duration > 0 ? (routingDuration / duration) * 100 : 0;
  const handlerPercentage = duration > 0 ? (handlerDuration / duration) * 100 : 0;
  const responsePercentage = duration > 0 ? (responseDuration / duration) * 100 : 0;

  // Detect bottlenecks
  const bottlenecks: string[] = [];
  const slowThreshold = 100; // 100ms threshold for individual operations

  flowContext.events.forEach(event => {
    if (event.duration && event.duration > slowThreshold) {
      bottlenecks.push(`${event.name} (${event.duration.toFixed(2)}ms)`);
    }
  });

  const flow: RequestFlow = {
    traceId: flowContext.traceId,
    spanId: flowContext.spanId,
    operationName: flowContext.operationName,
    method: flowContext.method,
    path: flowContext.path,
    startTime: flowContext.startTime,
    endTime,
    duration,
    events: flowContext.events,
    dependencies: flowContext.dependencies,
    stats: {
      totalEvents: flowContext.events.length,
      databaseCalls: flowContext.dependencies.database.length,
      httpCalls: flowContext.dependencies.http.length,
      cacheOperations: flowContext.dependencies.cache.length,
      totalDatabaseTime: databaseTime,
      totalHTTPTime: httpTime,
      totalCacheTime: cacheTime,
      totalDuration: duration,
      routingDuration,
      handlerDuration,
      responseDuration,
      routingPercentage,
      handlerPercentage,
      responsePercentage,
    },
    slow: duration > 1000, // 1 second threshold for slow requests
    bottlenecks,
  };

  return flow;
}

/**
 * Helper: Record a custom flow event
 * Allows users to manually track custom operations
 */
export async function trackOperation<T>(
  ctx: Context,
  name: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const eventId = recordFlowEvent(ctx, 'custom', name, 'started', metadata);

  try {
    const result = await operation();
    completeFlowEvent(ctx, eventId, 'completed');
    return result;
  } catch (error) {
    recordFlowEventError(ctx, eventId, error as Error);
    throw error;
  }
}
