/**
 * Performance profiling types
 * Phase 3.1: Request timeline visualization and bottleneck detection
 */

/**
 * Individual stage timing
 */
export interface StageTiming {
  name: string;
  startTime: number;
  duration: number;
  percentage?: number;
}

/**
 * Memory snapshot
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Memory profile
 */
export interface MemoryProfile {
  before: MemorySnapshot;
  after: MemorySnapshot;
  delta: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

/**
 * Request profile with detailed timing breakdown
 */
export interface RequestProfile {
  traceId: string;
  spanId: string;
  operationName: string;
  method: string;
  path: string;
  timestamp: number;

  // Stage timings
  stages: {
    routing: number;           // Time to match route
    validation?: number;       // Validation middleware (if present)
    authentication?: number;   // Auth middleware (if present)
    middleware: StageTiming[]; // All middleware timings
    handler: number;          // Business logic execution
    serialization: number;    // Response serialization
    total: number;            // End-to-end time
  };

  // Breakdown for visualization
  breakdown: StageTiming[];

  // Memory profiling (optional)
  memory?: MemoryProfile;

  // Performance flags
  slow: boolean;              // Exceeds slow threshold
  budgetExceeded?: boolean;   // Exceeds performance budget
  bottlenecks: string[];      // Detected bottlenecks
}

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  operationName: string;      // Operation pattern (e.g., "GET /users/:id")
  budget: number;             // Warning threshold (ms)
  p95Threshold: number;       // Alert threshold (ms)
  exceeded: boolean;          // Currently exceeding budget
  violations: number;         // Total violations count
  lastViolation?: number;     // Timestamp of last violation
}

/**
 * Bottleneck detection result
 */
export interface BottleneckDetection {
  type: 'slow_operation' | 'slow_middleware' | 'n1_pattern' | 'memory_leak' | 'high_cpu';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  stage?: string;
  duration?: number;
  threshold?: number;
  recommendation?: string;
}

/**
 * Profiling configuration
 */
export interface ProfilingConfig {
  enabled: boolean;
  captureMemory?: boolean;      // Enable memory profiling (adds overhead)
  bufferSize?: number;          // Number of profiles to keep in memory (default: 100)
  slowThreshold?: number;       // ms - what's considered "slow" (default: 1000)
  enableBudgets?: boolean;      // Enable performance budgets
  autoDetectBottlenecks?: boolean;  // Automatic bottleneck detection
  captureStacks?: boolean;      // Capture stack traces for slow operations
}

/**
 * Profile statistics
 */
export interface ProfileStats {
  totalProfiles: number;
  slowRequests: number;
  budgetViolations: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  bottlenecksDetected: number;
}

/**
 * Profile query options
 */
export interface ProfileQueryOptions {
  limit?: number;
  offset?: number;
  slow?: boolean;              // Only slow requests
  method?: string;             // Filter by HTTP method
  path?: string;               // Filter by path pattern
  minDuration?: number;        // Min duration filter
  maxDuration?: number;        // Max duration filter
  startTime?: number;          // Time range start
  endTime?: number;            // Time range end
}
