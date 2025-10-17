/**
 * Request Flow Visualization Types
 * Phase 3.6: Track complete request journey with dependencies
 */

/**
 * Flow event types categorize different kinds of events in the request lifecycle
 */
export type FlowEventType =
  | 'lifecycle'      // Request lifecycle events (routing, handler, etc.)
  | 'middleware'     // Middleware execution
  | 'database'       // Database queries
  | 'http'           // External HTTP calls
  | 'cache'          // Cache operations
  | 'custom';        // Custom user-defined events

/**
 * Flow event status
 */
export type FlowEventStatus = 'started' | 'completed' | 'error';

/**
 * Individual flow event during request processing
 * Represents a single operation or step in the request journey
 */
export interface FlowEvent {
  id: string;                    // Unique event ID
  traceId: string;               // Associated trace ID
  type: FlowEventType;           // Event category
  name: string;                  // Event name (e.g., "DB: SELECT users", "HTTP: GET /api")
  status: FlowEventStatus;       // Event status
  startTime: number;             // performance.now() when event started
  endTime?: number;              // performance.now() when event completed
  duration?: number;             // Duration in milliseconds (calculated)
  parentId?: string;             // Parent event ID (for nested events)
  metadata?: Record<string, any>; // Additional event-specific data
  error?: {                      // Error information if status is 'error'
    message: string;
    stack?: string;
  };
}

/**
 * Database call details
 */
export interface DatabaseCall {
  id: string;
  query: string;                 // SQL query or operation name
  duration: number;              // Duration in milliseconds
  startTime: number;             // When query started
  endTime: number;               // When query completed
  rowsAffected?: number;         // Rows returned/modified
  database?: string;             // Database name
  error?: string;                // Error message if failed
}

/**
 * HTTP call details (external API calls)
 */
export interface HTTPCall {
  id: string;
  method: string;                // HTTP method (GET, POST, etc.)
  url: string;                   // Full URL
  duration: number;              // Duration in milliseconds
  startTime: number;             // When call started
  endTime: number;               // When call completed
  statusCode?: number;           // Response status code
  requestSize?: number;          // Request body size in bytes
  responseSize?: number;         // Response body size in bytes
  error?: string;                // Error message if failed
}

/**
 * Cache operation details
 */
export interface CacheOperation {
  id: string;
  operation: 'get' | 'set' | 'delete' | 'clear';
  key: string;                   // Cache key
  duration: number;              // Duration in milliseconds
  startTime: number;             // When operation started
  endTime: number;               // When operation completed
  hit?: boolean;                 // Cache hit/miss (for 'get')
  size?: number;                 // Value size in bytes
  ttl?: number;                  // TTL in seconds (for 'set')
  error?: string;                // Error message if failed
}

/**
 * Request flow aggregates all events and dependencies for a single request
 */
export interface RequestFlow {
  traceId: string;               // Trace ID from OpenTelemetry
  spanId: string;                // Root span ID
  operationName: string;         // Operation name (e.g., "GET /users/:id")
  method: string;                // HTTP method
  path: string;                  // Request path
  startTime: number;             // Request start time (performance.now())
  endTime?: number;              // Request end time
  duration?: number;             // Total duration in milliseconds

  // All events in chronological order
  events: FlowEvent[];

  // Categorized dependencies
  dependencies: {
    database: DatabaseCall[];
    http: HTTPCall[];
    cache: CacheOperation[];
  };

  // Summary statistics
  stats: {
    totalEvents: number;
    databaseCalls: number;
    httpCalls: number;
    cacheOperations: number;
    totalDatabaseTime: number;   // Sum of all DB query durations
    totalHTTPTime: number;        // Sum of all HTTP call durations
    totalCacheTime: number;       // Sum of all cache operation durations
    totalDuration: number;        // Total request duration in milliseconds
    routingDuration: number;      // Routing phase duration
    handlerDuration: number;      // Handler execution duration
    responseDuration: number;     // Response serialization duration
    routingPercentage: number;    // Routing as % of total
    handlerPercentage: number;    // Handler as % of total
    responsePercentage: number;   // Response as % of total
  };

  // Performance flags
  slow: boolean;                 // Exceeds slow threshold
  bottlenecks: string[];         // Detected bottlenecks
}

/**
 * Flow configuration
 */
export interface FlowConfig {
  enabled: boolean;              // Enable flow tracking
  captureDatabase?: boolean;     // Capture database queries (default: true)
  captureHTTP?: boolean;         // Capture HTTP calls (default: true)
  captureCache?: boolean;        // Capture cache operations (default: true)
  captureMetadata?: boolean;     // Capture detailed metadata (default: false, adds overhead)
  bufferSize?: number;           // Number of flows to keep in memory (default: 100)
  slowThreshold?: number;        // Threshold for slow requests in ms (default: 1000)
}

/**
 * Flow query options
 */
export interface FlowQueryOptions {
  limit?: number;                // Max number of flows to return
  offset?: number;               // Offset for pagination
  method?: string;               // Filter by HTTP method
  path?: string;                 // Filter by path pattern
  minDuration?: number;          // Minimum duration filter
  maxDuration?: number;          // Maximum duration filter
  hasDatabaseCalls?: boolean;    // Filter flows with DB calls
  hasHTTPCalls?: boolean;        // Filter flows with HTTP calls
  hasCacheOperations?: boolean;  // Filter flows with cache ops
  slow?: boolean;                // Filter slow requests only
  startTime?: number;            // Time range start
  endTime?: number;              // Time range end
}

/**
 * Flow statistics
 */
export interface FlowStats {
  totalFlows: number;
  slowFlows: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  totalDatabaseCalls: number;
  totalHTTPCalls: number;
  totalCacheOperations: number;
  averageDatabaseTime: number;
  averageHTTPTime: number;
  averageCacheTime: number;
}
