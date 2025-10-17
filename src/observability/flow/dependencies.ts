/**
 * Dependency Tracking Utilities
 * Phase 3.6: Track database queries, HTTP calls, and cache operations
 */

import type { Context } from '../../core/types.js';
import type { DatabaseCall, HTTPCall, CacheOperation } from './types.js';
import { recordFlowEvent, completeFlowEvent, recordFlowEventError } from './tracker.js';
import { startSpan, endSpan } from '../context.js';

/**
 * Generate unique dependency ID
 */
function generateDependencyId(type: string): string {
  return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get flow context from request context
 */
function getFlowContext(ctx: Context): any {
  return (ctx as any)._flowContext;
}

/**
 * Track a database query
 *
 * @example
 * const users = await trackDatabase(ctx, 'SELECT * FROM users WHERE id = ?', async () => {
 *   return db.query('SELECT * FROM users WHERE id = ?', [userId]);
 * }, { database: 'app_db' });
 */
export async function trackDatabase<T>(
  ctx: Context,
  query: string,
  operation: () => Promise<T>,
  options?: {
    database?: string;
    sanitize?: boolean; // Sanitize query (remove sensitive data)
  }
): Promise<T> {
  const flowContext = getFlowContext(ctx);
  const startTime = performance.now();

  // Sanitize query if requested (replace values with ?)
  const displayQuery = options?.sanitize
    ? query.replace(/(['"])(.*?)\1/g, '?').replace(/\d+/g, '?')
    : query;

  // Create OpenTelemetry span
  const span = startSpan('db.query', {
    'db.system': 'sql',
    'db.statement': displayQuery,
    'db.name': options?.database || 'unknown',
  });

  // Record flow event
  const eventId = recordFlowEvent(ctx, 'database', `DB: ${displayQuery.substring(0, 50)}...`, 'started', {
    query: displayQuery,
    database: options?.database,
  });

  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Complete flow event
    completeFlowEvent(ctx, eventId, 'completed', {
      duration,
      rowsAffected: (result as any)?.rowCount || (result as any)?.affectedRows || undefined,
    });

    // Update span
    span.setAttributes({
      'db.duration_ms': duration,
    });
    endSpan(span);

    // Store in dependencies if flow context exists
    if (flowContext) {
      const dbCall: DatabaseCall = {
        id: generateDependencyId('db'),
        query: displayQuery,
        duration,
        startTime,
        endTime,
        database: options?.database,
        rowsAffected: (result as any)?.rowCount || (result as any)?.affectedRows,
      };
      flowContext.dependencies.database.push(dbCall);
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Record error in flow event
    recordFlowEventError(ctx, eventId, error as Error);

    // Update span with error
    endSpan(span, error as Error);

    // Store in dependencies with error
    if (flowContext) {
      const dbCall: DatabaseCall = {
        id: generateDependencyId('db'),
        query: displayQuery,
        duration,
        startTime,
        endTime,
        database: options?.database,
        error: (error as Error).message,
      };
      flowContext.dependencies.database.push(dbCall);
    }

    throw error;
  }
}

/**
 * Track an HTTP call to external API
 *
 * @example
 * const response = await trackHTTP(ctx, 'GET', 'https://api.example.com/users', async () => {
 *   return fetch('https://api.example.com/users');
 * });
 */
export async function trackHTTP<T>(
  ctx: Context,
  method: string,
  url: string,
  operation: () => Promise<T>,
  options?: {
    captureBody?: boolean; // Capture request/response body sizes
  }
): Promise<T> {
  const flowContext = getFlowContext(ctx);
  const startTime = performance.now();

  // Parse URL to get clean display name
  let displayUrl = url;
  try {
    const urlObj = new URL(url);
    displayUrl = `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    // If URL parsing fails, use as-is
  }

  // Create OpenTelemetry span
  const span = startSpan('http.client.request', {
    'http.method': method,
    'http.url': displayUrl,
  });

  // Record flow event
  const eventId = recordFlowEvent(ctx, 'http', `HTTP: ${method} ${displayUrl}`, 'started', {
    method,
    url: displayUrl,
  });

  try {
    const result = await operation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Extract response details if it's a fetch Response
    let statusCode: number | undefined;
    let responseSize: number | undefined;

    if (result && typeof result === 'object') {
      const response = result as any;
      statusCode = response.status;

      if (options?.captureBody && response.headers) {
        const contentLength = response.headers.get?.('content-length');
        responseSize = contentLength ? parseInt(contentLength, 10) : undefined;
      }
    }

    // Complete flow event
    completeFlowEvent(ctx, eventId, 'completed', {
      duration,
      statusCode,
      responseSize,
    });

    // Update span
    span.setAttributes({
      'http.status_code': statusCode || 0,
      'http.duration_ms': duration,
    });
    endSpan(span);

    // Store in dependencies
    if (flowContext) {
      const httpCall: HTTPCall = {
        id: generateDependencyId('http'),
        method,
        url: displayUrl,
        duration,
        startTime,
        endTime,
        statusCode,
        responseSize,
      };
      flowContext.dependencies.http.push(httpCall);
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Record error in flow event
    recordFlowEventError(ctx, eventId, error as Error);

    // Update span with error
    endSpan(span, error as Error);

    // Store in dependencies with error
    if (flowContext) {
      const httpCall: HTTPCall = {
        id: generateDependencyId('http'),
        method,
        url: displayUrl,
        duration,
        startTime,
        endTime,
        error: (error as Error).message,
      };
      flowContext.dependencies.http.push(httpCall);
    }

    throw error;
  }
}

/**
 * Track a cache operation
 *
 * @example
 * const user = await trackCache(ctx, 'get', 'user:123', async () => {
 *   return redis.get('user:123');
 * });
 */
export async function trackCache<T>(
  ctx: Context,
  operation: 'get' | 'set' | 'delete' | 'clear',
  key: string,
  cacheOperation: () => Promise<T>,
  options?: {
    ttl?: number; // TTL in seconds (for 'set' operations)
    captureSize?: boolean; // Capture value size
  }
): Promise<T> {
  const flowContext = getFlowContext(ctx);
  const startTime = performance.now();

  // Create OpenTelemetry span
  const span = startSpan('cache.operation', {
    'cache.operation': operation,
    'cache.key': key,
  });

  // Record flow event
  const eventId = recordFlowEvent(ctx, 'cache', `Cache: ${operation.toUpperCase()} ${key}`, 'started', {
    operation,
    key,
    ttl: options?.ttl,
  });

  try {
    const result = await cacheOperation();
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Determine if it was a cache hit (for 'get' operations)
    const hit = operation === 'get' && result !== null && result !== undefined;

    // Calculate size if requested
    let size: number | undefined;
    if (options?.captureSize && result) {
      try {
        size = JSON.stringify(result).length;
      } catch {
        // If can't stringify, skip size
      }
    }

    // Complete flow event
    completeFlowEvent(ctx, eventId, 'completed', {
      duration,
      hit,
      size,
    });

    // Update span
    span.setAttributes({
      'cache.hit': hit,
      'cache.duration_ms': duration,
    });
    endSpan(span);

    // Store in dependencies
    if (flowContext) {
      const cacheOp: CacheOperation = {
        id: generateDependencyId('cache'),
        operation,
        key,
        duration,
        startTime,
        endTime,
        hit,
        size,
        ttl: options?.ttl,
      };
      flowContext.dependencies.cache.push(cacheOp);
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Record error in flow event
    recordFlowEventError(ctx, eventId, error as Error);

    // Update span with error
    endSpan(span, error as Error);

    // Store in dependencies with error
    if (flowContext) {
      const cacheOp: CacheOperation = {
        id: generateDependencyId('cache'),
        operation,
        key,
        duration,
        startTime,
        endTime,
        error: (error as Error).message,
      };
      flowContext.dependencies.cache.push(cacheOp);
    }

    throw error;
  }
}

/**
 * Convenience wrapper for tracking multiple database queries
 * Automatically tracks all queries in a transaction-like block
 */
export async function trackDatabaseTransaction<T>(
  ctx: Context,
  name: string,
  transaction: () => Promise<T>
): Promise<T> {
  const eventId = recordFlowEvent(ctx, 'database', `DB Transaction: ${name}`, 'started');

  const span = startSpan('db.transaction', {
    'db.transaction.name': name,
  });

  try {
    const result = await transaction();
    completeFlowEvent(ctx, eventId, 'completed');
    endSpan(span);
    return result;
  } catch (error) {
    recordFlowEventError(ctx, eventId, error as Error);
    endSpan(span, error as Error);
    throw error;
  }
}

/**
 * Create a simple database query tracker that doesn't need context
 * Useful for background jobs or non-HTTP contexts
 */
export function createSimpleDBTracker(database?: string) {
  return async function track<T>(
    query: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const span = startSpan('db.query', {
      'db.system': 'sql',
      'db.statement': query.substring(0, 100),
      'db.name': database || 'unknown',
    });

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      span.setAttributes({
        'db.duration_ms': duration,
      });
      endSpan(span);

      return result;
    } catch (error) {
      endSpan(span, error as Error);
      throw error;
    }
  };
}
