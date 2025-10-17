/**
 * Middleware wrapper for profiling individual middleware stages
 * Allows tracking of validation, authentication, and other middleware
 */

import type { Middleware } from '../../core/types.js';
import type { StageTiming } from './types.js';

// Store middleware timings on context
const PROFILER_TIMINGS_KEY = '__profilerTimings';

/**
 * Get middleware timings from context
 */
export function getMiddlewareTimings(ctx: any): StageTiming[] {
  return ctx[PROFILER_TIMINGS_KEY] || [];
}

/**
 * Add middleware timing to context
 */
export function addMiddlewareTiming(ctx: any, timing: StageTiming): void {
  if (!ctx[PROFILER_TIMINGS_KEY]) {
    ctx[PROFILER_TIMINGS_KEY] = [];
  }
  ctx[PROFILER_TIMINGS_KEY].push(timing);
}

/**
 * Wrap middleware to track its execution time
 * Usage: app.use(profiledMiddleware('Validation', validationMiddleware))
 */
export function profiledMiddleware(name: string, middleware: Middleware): Middleware {
  return async (ctx, next) => {
    const startTime = performance.now();

    try {
      // Execute the middleware
      await middleware(ctx, next);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Store timing
      addMiddlewareTiming(ctx, {
        name,
        startTime,
        duration,
      });
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Store timing even on error
      addMiddlewareTiming(ctx, {
        name: `${name} (error)`,
        startTime,
        duration,
      });

      throw error;
    }
  };
}

/**
 * Higher-order function to create profiled middleware
 * Usage: const validation = profiled('Validation')((ctx, next) => { ... })
 */
export function profiled(name: string) {
  return (middleware: Middleware): Middleware => {
    return profiledMiddleware(name, middleware);
  };
}
