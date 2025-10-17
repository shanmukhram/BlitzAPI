/**
 * Profile storage with circular buffer
 * Keeps the most recent N profiles in memory
 */

import type { RequestProfile, ProfileQueryOptions, ProfileStats } from './types.js';

class ProfileStorage {
  private profiles: RequestProfile[] = [];
  private maxSize: number = 100;
  private traceIdIndex: Map<string, RequestProfile> = new Map();

  /**
   * Configure storage size
   */
  configure(maxSize: number): void {
    this.maxSize = maxSize;
    this.enforceSize();
  }

  /**
   * Store a profile
   */
  store(profile: RequestProfile): void {
    // Add to array
    this.profiles.push(profile);

    // Add to index
    this.traceIdIndex.set(profile.traceId, profile);

    // Enforce size limit (circular buffer)
    this.enforceSize();
  }

  /**
   * Get profile by trace ID
   */
  get(traceId: string): RequestProfile | undefined {
    return this.traceIdIndex.get(traceId);
  }

  /**
   * Query profiles with filters
   */
  query(options: ProfileQueryOptions = {}): RequestProfile[] {
    let results = this.profiles;

    // Filter by slow threshold
    if (options.slow !== undefined) {
      results = results.filter(p => p.slow === options.slow);
    }

    // Filter by method
    if (options.method) {
      results = results.filter(p => p.method === options.method);
    }

    // Filter by path pattern
    if (options.path) {
      const pattern = new RegExp(options.path);
      results = results.filter(p => pattern.test(p.path));
    }

    // Filter by duration range
    if (options.minDuration !== undefined) {
      const minDuration = options.minDuration;
      results = results.filter(p => p.stages.total >= minDuration);
    }

    if (options.maxDuration !== undefined) {
      const maxDuration = options.maxDuration;
      results = results.filter(p => p.stages.total <= maxDuration);
    }

    // Filter by time range
    if (options.startTime !== undefined) {
      const startTime = options.startTime;
      results = results.filter(p => p.timestamp >= startTime);
    }

    if (options.endTime !== undefined) {
      const endTime = options.endTime;
      results = results.filter(p => p.timestamp <= endTime);
    }

    // Sort by duration (descending - slowest first)
    results.sort((a, b) => b.stages.total - a.stages.total);

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get slowest requests
   */
  getSlowest(limit: number = 10): RequestProfile[] {
    return this.query({ slow: true, limit });
  }

  /**
   * Get profiles with budget violations
   */
  getBudgetViolations(limit?: number): RequestProfile[] {
    const violations = this.profiles.filter(p => p.budgetExceeded);
    violations.sort((a, b) => b.stages.total - a.stages.total);
    return limit ? violations.slice(0, limit) : violations;
  }

  /**
   * Get profile statistics
   */
  getStats(): ProfileStats {
    if (this.profiles.length === 0) {
      return {
        totalProfiles: 0,
        slowRequests: 0,
        budgetViolations: 0,
        averageDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        bottlenecksDetected: 0,
      };
    }

    const durations = this.profiles.map(p => p.stages.total).sort((a, b) => a - b);
    const slowCount = this.profiles.filter(p => p.slow).length;
    const violationCount = this.profiles.filter(p => p.budgetExceeded).length;
    const bottleneckCount = this.profiles.reduce((sum, p) => sum + p.bottlenecks.length, 0);

    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      totalProfiles: this.profiles.length,
      slowRequests: slowCount,
      budgetViolations: violationCount,
      averageDuration: avg,
      p50Duration: durations[p50Index],
      p95Duration: durations[p95Index],
      p99Duration: durations[p99Index],
      bottlenecksDetected: bottleneckCount,
    };
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles = [];
    this.traceIdIndex.clear();
  }

  /**
   * Get total count
   */
  count(): number {
    return this.profiles.length;
  }

  /**
   * Enforce circular buffer size
   */
  private enforceSize(): void {
    while (this.profiles.length > this.maxSize) {
      const removed = this.profiles.shift();
      if (removed) {
        this.traceIdIndex.delete(removed.traceId);
      }
    }
  }
}

// Singleton instance
export const profileStorage = new ProfileStorage();
