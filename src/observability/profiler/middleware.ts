/**
 * Profiling middleware - captures detailed request timing
 * Phase 3.1: Request timeline visualization
 */

import type { Middleware } from '../../core/types.js';
import type { RequestProfile, StageTiming, ProfilingConfig } from './types.js';
import { profileStorage } from './storage.js';
import { detectBottlenecks, calculateP95Baseline } from './detector.js';
import { getMiddlewareTimings } from './wrapper.js';

let profilingConfig: ProfilingConfig = {
  enabled: false,
  captureMemory: false,
  bufferSize: 100,
  slowThreshold: 1000,
  enableBudgets: false,
  autoDetectBottlenecks: true,
  captureStacks: false,
};

/**
 * Initialize profiling
 */
export function initializeProfiling(config: ProfilingConfig): void {
  profilingConfig = {
    ...profilingConfig,
    ...config,
  };

  if (config.bufferSize) {
    profileStorage.configure(config.bufferSize);
  }

  console.log(`✅ Performance profiling initialized (buffer: ${config.bufferSize || 100}, threshold: ${config.slowThreshold || 1000}ms)`);
}

/**
 * Get current profiling config
 */
export function getProfilingConfig(): ProfilingConfig {
  return profilingConfig;
}

/**
 * Profiling middleware - wraps request execution and captures timings
 */
export function profilingMiddleware(): Middleware {
  return async (ctx, next) => {
    // Skip if profiling disabled
    if (!profilingConfig.enabled) {
      await next();
      return;
    }

    const trace = (ctx as any).trace;
    if (!trace) {
      // No trace context, skip profiling
      await next();
      return;
    }

    // Capture memory snapshot (if enabled)
    const memoryBefore = profilingConfig.captureMemory
      ? process.memoryUsage()
      : undefined;

    // Start timing
    const requestStart = performance.now();
    const timings: Map<string, StageTiming> = new Map();

    // Track routing time (already happened, use 0 as placeholder)
    timings.set('routing', {
      name: 'Routing',
      startTime: requestStart,
      duration: 0, // Will be calculated from trace span
    });

    // Wrap middleware execution to capture individual timings
    const originalNext = next;
    let middlewareIndex = 0;
    const middlewareTimings: StageTiming[] = [];

    // Track handler execution
    let handlerStart = 0;
    let handlerEnd = 0;

    const wrappedNext = async (): Promise<void> => {
      const stageStart = performance.now();

      try {
        await originalNext();
      } finally {
        // Record as handler timing (the final "next" is the actual handler)
        if (middlewareIndex === 0) {
          handlerStart = stageStart;
          handlerEnd = performance.now();
        }
      }

      middlewareIndex++;
    };

    try {
      // Execute request (handler)
      await wrappedNext();

      // Capture memory snapshot after (if enabled)
      const memoryAfter = profilingConfig.captureMemory
        ? process.memoryUsage()
        : undefined;

      const requestEnd = performance.now();
      const totalDuration = requestEnd - requestStart;

      // Calculate stage durations
      const handlerDuration = handlerEnd - handlerStart;
      const serializationStart = handlerEnd;
      const serializationDuration = requestEnd - serializationStart;

      // Build breakdown
      const breakdown: StageTiming[] = [];

      // Calculate routing time (time before handler started)
      const routingDuration = handlerStart - requestStart;

      // Add routing
      breakdown.push({
        name: 'Routing',
        startTime: requestStart,
        duration: routingDuration,
      });

      // Add middleware timings (validation, auth, etc.)
      const middlewareTimingsFromContext = getMiddlewareTimings(ctx);
      middlewareTimingsFromContext.forEach(timing => {
        breakdown.push(timing);
      });

      // Add handler
      breakdown.push({
        name: 'Handler',
        startTime: handlerStart,
        duration: handlerDuration,
      });

      // Add serialization
      breakdown.push({
        name: 'Serialization',
        startTime: serializationStart,
        duration: serializationDuration,
      });

      // Calculate percentages based on actual total duration
      breakdown.forEach(stage => {
        stage.percentage = totalDuration > 0 ? (stage.duration / totalDuration) * 100 : 0;
      });

      // Create profile
      const profile: RequestProfile = {
        traceId: trace.traceId,
        spanId: trace.spanId,
        operationName: trace.operationName || `${ctx.method} ${ctx.path}`,
        method: ctx.method,
        path: ctx.path,
        timestamp: Date.now(),

        stages: {
          routing: routingDuration,
          middleware: middlewareTimings,
          handler: handlerDuration,
          serialization: serializationDuration,
          total: totalDuration,
        },

        breakdown,

        slow: totalDuration > (profilingConfig.slowThreshold || 1000),
        bottlenecks: [],
      };

      // Add memory profiling if enabled
      if (memoryBefore && memoryAfter) {
        profile.memory = {
          before: memoryBefore,
          after: memoryAfter,
          delta: {
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            external: memoryAfter.external - memoryBefore.external,
            rss: memoryAfter.rss - memoryBefore.rss,
          },
        };
      }

      // Detect bottlenecks (if enabled)
      if (profilingConfig.autoDetectBottlenecks) {
        // Get recent durations for p95 baseline
        const recentProfiles = profileStorage.query({ limit: 50 });
        const recentDurations = recentProfiles.map(p => p.stages.total);
        const p95Baseline = recentDurations.length > 10
          ? calculateP95Baseline(recentDurations)
          : undefined;

        profile.bottlenecks = detectBottlenecks(
          profile,
          profilingConfig.slowThreshold,
          p95Baseline
        );
      }

      // Store profile (synchronous operation)
      profileStorage.store(profile);

      // Attach profile to context for user access
      (ctx as any).profile = profile;

    } catch (error) {
      // Still record profile on error
      const requestEnd = performance.now();
      const totalDuration = requestEnd - requestStart;

      const profile: RequestProfile = {
        traceId: trace.traceId,
        spanId: trace.spanId,
        operationName: trace.operationName || `${ctx.method} ${ctx.path}`,
        method: ctx.method,
        path: ctx.path,
        timestamp: Date.now(),

        stages: {
          routing: 0.5,
          middleware: [],
          handler: totalDuration - 0.5,
          serialization: 0,
          total: totalDuration,
        },

        breakdown: [{
          name: 'Error',
          startTime: requestStart,
          duration: totalDuration,
          percentage: 100,
        }],

        slow: totalDuration > (profilingConfig.slowThreshold || 1000),
        bottlenecks: ['Request failed with error'],
      };

      profileStorage.store(profile);
      throw error;
    }
  };
}
