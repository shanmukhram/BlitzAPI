/**
 * Automatic bottleneck detection
 * Analyzes request profiles to identify performance issues
 */

import type { RequestProfile, BottleneckDetection } from './types.js';

/**
 * Detect bottlenecks in a request profile
 */
export function detectBottlenecks(
  profile: RequestProfile,
  slowThreshold: number = 1000,
  p95Baseline?: number
): string[] {
  const bottlenecks: string[] = [];
  const detections = analyzeProfile(profile, slowThreshold, p95Baseline);

  detections.forEach(detection => {
    let message = `[${detection.severity.toUpperCase()}] ${detection.message}`;
    if (detection.recommendation) {
      message += ` - ${detection.recommendation}`;
    }
    bottlenecks.push(message);
  });

  return bottlenecks;
}

/**
 * Analyze profile and return structured detections
 */
export function analyzeProfile(
  profile: RequestProfile,
  slowThreshold: number = 1000,
  p95Baseline?: number
): BottleneckDetection[] {
  const detections: BottleneckDetection[] = [];

  // Check if overall request is slow
  if (profile.stages.total > slowThreshold) {
    detections.push({
      type: 'slow_operation',
      severity: profile.stages.total > slowThreshold * 2 ? 'critical' : 'warning',
      message: `Request exceeded slow threshold (${profile.stages.total.toFixed(2)}ms > ${slowThreshold}ms)`,
      duration: profile.stages.total,
      threshold: slowThreshold,
      recommendation: 'Review handler logic and consider caching or optimization',
    });
  }

  // Check if exceeds p95 baseline
  if (p95Baseline && profile.stages.total > p95Baseline * 1.5) {
    detections.push({
      type: 'slow_operation',
      severity: 'warning',
      message: `Request significantly slower than p95 baseline (${profile.stages.total.toFixed(2)}ms vs ${p95Baseline.toFixed(2)}ms)`,
      duration: profile.stages.total,
      threshold: p95Baseline,
      recommendation: 'Investigate variance in request handling',
    });
  }

  // Check for slow handler
  if (profile.stages.handler > slowThreshold * 0.8) {
    detections.push({
      type: 'slow_operation',
      severity: 'warning',
      message: `Handler execution is slow (${profile.stages.handler.toFixed(2)}ms)`,
      stage: 'handler',
      duration: profile.stages.handler,
      recommendation: 'Profile business logic, check for N+1 queries or blocking operations',
    });
  }

  // Check for slow middleware
  const slowMiddleware = profile.stages.middleware.filter(
    m => m.duration > slowThreshold * 0.3
  );

  slowMiddleware.forEach(middleware => {
    detections.push({
      type: 'slow_middleware',
      severity: middleware.duration > slowThreshold * 0.5 ? 'warning' : 'info',
      message: `Slow middleware detected: ${middleware.name} (${middleware.duration.toFixed(2)}ms)`,
      stage: middleware.name,
      duration: middleware.duration,
      recommendation: 'Consider optimizing or caching middleware logic',
    });
  });

  // Check for disproportionate stages
  const handlerPercentage = (profile.stages.handler / profile.stages.total) * 100;
  if (handlerPercentage > 90) {
    detections.push({
      type: 'slow_operation',
      severity: 'info',
      message: `Handler accounts for ${handlerPercentage.toFixed(1)}% of total time`,
      stage: 'handler',
      recommendation: 'Most time spent in business logic - focus optimization efforts here',
    });
  }

  // Check for high serialization time
  if (profile.stages.serialization > slowThreshold * 0.2) {
    detections.push({
      type: 'slow_operation',
      severity: 'info',
      message: `High serialization time (${profile.stages.serialization.toFixed(2)}ms)`,
      stage: 'serialization',
      recommendation: 'Consider reducing response payload size or using streaming',
    });
  }

  // Check for memory leaks (if memory profiling enabled)
  if (profile.memory) {
    const heapIncrease = profile.memory.delta.heapUsed;
    const heapIncreaseMB = heapIncrease / 1024 / 1024;

    if (heapIncreaseMB > 50) {
      detections.push({
        type: 'memory_leak',
        severity: heapIncreaseMB > 100 ? 'critical' : 'warning',
        message: `Large memory allocation detected (+${heapIncreaseMB.toFixed(2)}MB)`,
        recommendation: 'Check for memory leaks or inefficient data structures',
      });
    }
  }

  // N+1 query pattern detection (heuristic)
  const hasMultipleDBCalls = profile.breakdown.filter(s =>
    s.name.toLowerCase().includes('db') ||
    s.name.toLowerCase().includes('database') ||
    s.name.toLowerCase().includes('query')
  ).length > 5;

  if (hasMultipleDBCalls && profile.stages.handler > slowThreshold * 0.5) {
    detections.push({
      type: 'n1_pattern',
      severity: 'warning',
      message: 'Potential N+1 query pattern detected (multiple database calls)',
      stage: 'handler',
      recommendation: 'Consider using eager loading, joins, or DataLoader pattern',
    });
  }

  return detections;
}

/**
 * Calculate p95 baseline from recent profiles
 */
export function calculateP95Baseline(durations: number[]): number {
  if (durations.length === 0) return 0;

  const sorted = [...durations].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);

  return sorted[p95Index];
}

/**
 * Detect patterns across multiple profiles
 */
export function detectPatterns(profiles: RequestProfile[]): {
  patterns: string[];
  recommendations: string[];
} {
  const patterns: string[] = [];
  const recommendations: string[] = [];

  if (profiles.length === 0) {
    return { patterns, recommendations };
  }

  // Group by operation
  const byOperation = new Map<string, RequestProfile[]>();
  profiles.forEach(profile => {
    const key = `${profile.method} ${profile.path}`;
    if (!byOperation.has(key)) {
      byOperation.set(key, []);
    }
    byOperation.get(key)!.push(profile);
  });

  // Analyze each operation
  byOperation.forEach((operationProfiles, operationName) => {
    const durations = operationProfiles.map(p => p.stages.total);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);

    // High variance indicates inconsistent performance
    const variance = max - min;
    if (variance > avg * 2) {
      patterns.push(`${operationName}: High performance variance (${min.toFixed(0)}-${max.toFixed(0)}ms)`);
      recommendations.push(`Investigate why ${operationName} has inconsistent performance`);
    }

    // Consistently slow operation
    if (avg > 1000) {
      patterns.push(`${operationName}: Consistently slow (avg: ${avg.toFixed(0)}ms)`);
      recommendations.push(`Optimize ${operationName} - consider caching or refactoring`);
    }
  });

  return { patterns, recommendations };
}
