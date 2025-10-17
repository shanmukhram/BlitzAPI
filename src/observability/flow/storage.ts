/**
 * Flow storage with circular buffer
 * Keeps the most recent N request flows in memory
 */

import type { RequestFlow, FlowEvent } from './types.js';

export interface FlowQueryOptions {
  /**
   * Filter by slow requests
   */
  slow?: boolean;

  /**
   * Filter by trace ID pattern
   */
  traceId?: string;

  /**
   * Filter by minimum duration (ms)
   */
  minDuration?: number;

  /**
   * Filter by maximum duration (ms)
   */
  maxDuration?: number;

  /**
   * Filter by start time (timestamp)
   */
  startTime?: number;

  /**
   * Filter by end time (timestamp)
   */
  endTime?: number;

  /**
   * Filter by event type
   */
  eventType?: FlowEvent['type'];

  /**
   * Filter by event name pattern
   */
  eventName?: string;

  /**
   * Filter flows with bottlenecks
   */
  hasBottlenecks?: boolean;

  /**
   * Filter by dependency type
   */
  hasDependency?: 'database' | 'http' | 'cache';

  /**
   * Minimum number of dependencies
   */
  minDependencies?: number;

  /**
   * Sort by field
   */
  sortBy?: 'duration' | 'timestamp' | 'dependencies';

  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc';

  /**
   * Pagination offset
   */
  offset?: number;

  /**
   * Pagination limit
   */
  limit?: number;
}

export interface FlowStats {
  /**
   * Total number of flows stored
   */
  totalFlows: number;

  /**
   * Number of slow flows
   */
  slowFlows: number;

  /**
   * Number of flows with bottlenecks
   */
  flowsWithBottlenecks: number;

  /**
   * Average flow duration (ms)
   */
  averageDuration: number;

  /**
   * P50 (median) duration (ms)
   */
  p50Duration: number;

  /**
   * P95 duration (ms)
   */
  p95Duration: number;

  /**
   * P99 duration (ms)
   */
  p99Duration: number;

  /**
   * Total database calls across all flows
   */
  totalDatabaseCalls: number;

  /**
   * Total HTTP calls across all flows
   */
  totalHTTPCalls: number;

  /**
   * Total cache operations across all flows
   */
  totalCacheOperations: number;

  /**
   * Average cache hit rate (0-100)
   */
  cacheHitRate: number;

  /**
   * Most common bottlenecks
   */
  commonBottlenecks: Array<{ name: string; count: number }>;
}

class FlowStorage {
  private flows: RequestFlow[] = [];
  private maxSize: number = 100;
  private traceIdIndex: Map<string, RequestFlow> = new Map();

  /**
   * Configure storage size
   */
  configure(maxSize: number): void {
    this.maxSize = maxSize;
    this.enforceSize();
  }

  /**
   * Store a flow
   */
  store(flow: RequestFlow): void {
    // Add to array
    this.flows.push(flow);

    // Add to index
    this.traceIdIndex.set(flow.traceId, flow);

    // Enforce size limit (circular buffer)
    this.enforceSize();
  }

  /**
   * Get flow by trace ID
   */
  get(traceId: string): RequestFlow | undefined {
    return this.traceIdIndex.get(traceId);
  }

  /**
   * Query flows with filters
   */
  query(options: FlowQueryOptions = {}): RequestFlow[] {
    let results = this.flows;

    // Filter by slow threshold
    if (options.slow !== undefined) {
      results = results.filter(f => f.slow === options.slow);
    }

    // Filter by trace ID pattern
    if (options.traceId) {
      const pattern = new RegExp(options.traceId);
      results = results.filter(f => pattern.test(f.traceId));
    }

    // Filter by duration range
    if (options.minDuration !== undefined) {
      const minDuration = options.minDuration;
      results = results.filter(f => f.stats.totalDuration >= minDuration);
    }

    if (options.maxDuration !== undefined) {
      const maxDuration = options.maxDuration;
      results = results.filter(f => f.stats.totalDuration <= maxDuration);
    }

    // Filter by time range
    if (options.startTime !== undefined) {
      const startTime = options.startTime;
      results = results.filter(f => {
        const flowStart = f.events[0]?.startTime || 0;
        return flowStart >= startTime;
      });
    }

    if (options.endTime !== undefined) {
      const endTime = options.endTime;
      results = results.filter(f => {
        const flowStart = f.events[0]?.startTime || 0;
        return flowStart <= endTime;
      });
    }

    // Filter by event type
    if (options.eventType) {
      const eventType = options.eventType;
      results = results.filter(f => f.events.some(e => e.type === eventType));
    }

    // Filter by event name pattern
    if (options.eventName) {
      const pattern = new RegExp(options.eventName);
      results = results.filter(f => f.events.some(e => pattern.test(e.name)));
    }

    // Filter by bottlenecks
    if (options.hasBottlenecks !== undefined) {
      if (options.hasBottlenecks) {
        results = results.filter(f => f.bottlenecks.length > 0);
      } else {
        results = results.filter(f => f.bottlenecks.length === 0);
      }
    }

    // Filter by dependency type
    if (options.hasDependency) {
      const depType = options.hasDependency;
      results = results.filter(f => f.dependencies[depType].length > 0);
    }

    // Filter by minimum dependencies
    if (options.minDependencies !== undefined) {
      const minDeps = options.minDependencies;
      results = results.filter(f => {
        const totalDeps =
          f.dependencies.database.length +
          f.dependencies.http.length +
          f.dependencies.cache.length;
        return totalDeps >= minDeps;
      });
    }

    // Sort results
    const sortBy = options.sortBy || 'duration';
    const sortDirection = options.sortDirection || 'desc';

    results.sort((a, b) => {
      let valueA: number;
      let valueB: number;

      if (sortBy === 'duration') {
        valueA = a.stats.totalDuration;
        valueB = b.stats.totalDuration;
      } else if (sortBy === 'timestamp') {
        valueA = a.events[0]?.startTime || 0;
        valueB = b.events[0]?.startTime || 0;
      } else if (sortBy === 'dependencies') {
        valueA =
          a.dependencies.database.length +
          a.dependencies.http.length +
          a.dependencies.cache.length;
        valueB =
          b.dependencies.database.length +
          b.dependencies.http.length +
          b.dependencies.cache.length;
      } else {
        valueA = a.stats.totalDuration;
        valueB = b.stats.totalDuration;
      }

      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get slowest flows
   */
  getSlowest(limit: number = 10): RequestFlow[] {
    return this.query({ slow: true, sortBy: 'duration', sortDirection: 'desc', limit });
  }

  /**
   * Get flows with bottlenecks
   */
  getBottlenecks(limit?: number): RequestFlow[] {
    return this.query({
      hasBottlenecks: true,
      sortBy: 'duration',
      sortDirection: 'desc',
      limit,
    });
  }

  /**
   * Get flows with specific dependency type
   */
  getByDependency(
    type: 'database' | 'http' | 'cache',
    limit?: number
  ): RequestFlow[] {
    return this.query({
      hasDependency: type,
      sortBy: 'dependencies',
      sortDirection: 'desc',
      limit,
    });
  }

  /**
   * Get flows in time range
   */
  getByTimeRange(startTime: number, endTime: number): RequestFlow[] {
    return this.query({ startTime, endTime, sortBy: 'timestamp', sortDirection: 'asc' });
  }

  /**
   * Get flow statistics
   */
  getStats(): FlowStats {
    if (this.flows.length === 0) {
      return {
        totalFlows: 0,
        slowFlows: 0,
        flowsWithBottlenecks: 0,
        averageDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        totalDatabaseCalls: 0,
        totalHTTPCalls: 0,
        totalCacheOperations: 0,
        cacheHitRate: 0,
        commonBottlenecks: [],
      };
    }

    const durations = this.flows
      .map(f => f.stats.totalDuration)
      .sort((a, b) => a - b);
    const slowCount = this.flows.filter(f => f.slow).length;
    const bottleneckCount = this.flows.filter(f => f.bottlenecks.length > 0).length;

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Dependency statistics
    let totalDbCalls = 0;
    let totalHttpCalls = 0;
    let totalCacheOps = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const flow of this.flows) {
      totalDbCalls += flow.dependencies.database.length;
      totalHttpCalls += flow.dependencies.http.length;
      totalCacheOps += flow.dependencies.cache.length;

      for (const cache of flow.dependencies.cache) {
        if (cache.hit) cacheHits++;
        else cacheMisses++;
      }
    }

    const cacheHitRate =
      totalCacheOps > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0;

    // Common bottlenecks
    const bottleneckMap = new Map<string, number>();
    for (const flow of this.flows) {
      for (const bottleneck of flow.bottlenecks) {
        bottleneckMap.set(bottleneck, (bottleneckMap.get(bottleneck) || 0) + 1);
      }
    }

    const commonBottlenecks = Array.from(bottleneckMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 bottlenecks

    return {
      totalFlows: this.flows.length,
      slowFlows: slowCount,
      flowsWithBottlenecks: bottleneckCount,
      averageDuration: avg,
      p50Duration: durations[p50Index],
      p95Duration: durations[p95Index],
      p99Duration: durations[p99Index],
      totalDatabaseCalls: totalDbCalls,
      totalHTTPCalls: totalHttpCalls,
      totalCacheOperations: totalCacheOps,
      cacheHitRate,
      commonBottlenecks,
    };
  }

  /**
   * Clear all flows
   */
  clear(): void {
    this.flows = [];
    this.traceIdIndex.clear();
  }

  /**
   * Get total count
   */
  count(): number {
    return this.flows.length;
  }

  /**
   * Get all flows (for debugging)
   */
  getAll(): RequestFlow[] {
    return [...this.flows];
  }

  /**
   * Enforce circular buffer size
   */
  private enforceSize(): void {
    while (this.flows.length > this.maxSize) {
      const removed = this.flows.shift();
      if (removed) {
        this.traceIdIndex.delete(removed.traceId);
      }
    }
  }
}

// Singleton instance
export const flowStorage = new FlowStorage();

/**
 * Configure both flow and profile storage together
 */
export function configureStorage(options: {
  flowMaxSize?: number;
  profileMaxSize?: number;
}): void {
  if (options.flowMaxSize !== undefined) {
    flowStorage.configure(options.flowMaxSize);
  }

  // Import and configure profile storage if needed
  if (options.profileMaxSize !== undefined) {
    const profileMaxSize = options.profileMaxSize;
    import('../profiler/storage.js').then(({ profileStorage }) => {
      profileStorage.configure(profileMaxSize);
    });
  }
}
