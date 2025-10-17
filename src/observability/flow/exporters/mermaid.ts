import type { RequestFlow, FlowEvent, DatabaseCall, HTTPCall, CacheOperation } from '../types.js';

export interface MermaidOptions {
  /**
   * Include timing annotations in the diagram
   * @default true
   */
  includeTimings?: boolean;

  /**
   * Show metadata in notes
   * @default false
   */
  showMetadata?: boolean;

  /**
   * Maximum message length before truncating
   * @default 50
   */
  maxMessageLength?: number;
}

/**
 * Generates a Mermaid sequence diagram from request flow data
 *
 * @example
 * ```typescript
 * const flow = getRequestFlow(ctx);
 * const diagram = generateMermaidDiagram(flow);
 * console.log(diagram);
 * // Output can be rendered in GitHub markdown:
 * // ```mermaid
 * // sequenceDiagram
 * //   participant Client
 * //   participant API
 * //   ...
 * // ```
 * ```
 */
export function generateMermaidDiagram(
  flow: RequestFlow,
  options: MermaidOptions = {}
): string {
  const {
    includeTimings = true,
    showMetadata = false,
    maxMessageLength = 50,
  } = options;

  const lines: string[] = [];

  // Mermaid diagram header
  lines.push('sequenceDiagram');

  // Define participants
  lines.push('  participant Client');
  lines.push('  participant API');

  // Add dependency participants if they exist
  const hasDb = flow.dependencies.database.length > 0;
  const hasHttp = flow.dependencies.http.length > 0;
  const hasCache = flow.dependencies.cache.length > 0;

  if (hasDb) lines.push('  participant Database');
  if (hasHttp) lines.push('  participant External');
  if (hasCache) lines.push('  participant Cache');

  lines.push(''); // Empty line for readability

  // Request start
  const totalDuration = flow.stats.totalDuration.toFixed(2);
  lines.push(`  Client->>+API: ${flow.events[0]?.name || 'HTTP Request'}`);

  if (includeTimings) {
    lines.push(`  Note over Client,API: Started at 0ms`);
  }

  // Process events and dependencies in chronological order
  const allItems = buildChronologicalTimeline(flow);

  for (const item of allItems) {
    if (item.type === 'event') {
      const event = item.data as FlowEvent;
      processEvent(event, lines, includeTimings, showMetadata, maxMessageLength);
    } else if (item.type === 'database') {
      const db = item.data as DatabaseCall;
      processDatabaseCall(db, lines, includeTimings, maxMessageLength);
    } else if (item.type === 'http') {
      const http = item.data as HTTPCall;
      processHTTPCall(http, lines, includeTimings, maxMessageLength);
    } else if (item.type === 'cache') {
      const cache = item.data as CacheOperation;
      processCacheOperation(cache, lines, includeTimings, maxMessageLength);
    }
  }

  // Add bottlenecks as critical notes
  if (flow.bottlenecks.length > 0) {
    lines.push('');
    lines.push(`  critical Bottlenecks Detected`);
    for (const bottleneck of flow.bottlenecks) {
      lines.push(`    Note over API: ⚠️ ${truncate(bottleneck, maxMessageLength)}`);
    }
    lines.push('  end');
  }

  // Response
  lines.push('');
  lines.push(`  API-->>-Client: Response`);

  if (includeTimings) {
    lines.push(`  Note over Client,API: Total: ${totalDuration}ms ${flow.slow ? '🐌 SLOW' : '⚡ Fast'}`);
  }

  // Add performance statistics
  if (includeTimings) {
    lines.push('');
    lines.push(`  Note over Client,API: Performance Stats`);
    lines.push(`  Note over Client,API: Routing: ${flow.stats.routingDuration.toFixed(2)}ms (${flow.stats.routingPercentage.toFixed(1)}%)`);
    lines.push(`  Note over Client,API: Handler: ${flow.stats.handlerDuration.toFixed(2)}ms (${flow.stats.handlerPercentage.toFixed(1)}%)`);
    lines.push(`  Note over Client,API: Response: ${flow.stats.responseDuration.toFixed(2)}ms (${flow.stats.responsePercentage.toFixed(1)}%)`);
  }

  return lines.join('\n');
}

/**
 * Generates a simplified Mermaid diagram focusing only on dependencies
 */
export function generateCompactMermaidDiagram(flow: RequestFlow): string {
  const lines: string[] = [];

  lines.push('sequenceDiagram');
  lines.push('  participant Client');
  lines.push('  participant API');

  const hasDb = flow.dependencies.database.length > 0;
  const hasHttp = flow.dependencies.http.length > 0;
  const hasCache = flow.dependencies.cache.length > 0;

  if (hasDb) lines.push('  participant Database');
  if (hasHttp) lines.push('  participant External');
  if (hasCache) lines.push('  participant Cache');

  lines.push('');
  lines.push(`  Client->>+API: Request`);

  // Only show dependency calls
  for (const db of flow.dependencies.database) {
    const query = truncate(db.query, 40);
    lines.push(`  API->>+Database: ${query}`);
    lines.push(`  Database-->>-API: ${db.rowsAffected || 0} rows (${db.duration.toFixed(1)}ms)`);
  }

  for (const http of flow.dependencies.http) {
    const urlPath = extractUrlPath(http.url);
    lines.push(`  API->>+External: ${http.method} ${urlPath}`);
    lines.push(`  External-->>-API: ${http.statusCode || '?'} (${http.duration.toFixed(1)}ms)`);
  }

  for (const cache of flow.dependencies.cache) {
    const op = cache.operation.toUpperCase();
    lines.push(`  API->>+Cache: ${op} ${cache.key}`);
    lines.push(`  Cache-->>-API: ${cache.hit ? 'HIT' : 'MISS'} (${cache.duration.toFixed(1)}ms)`);
  }

  lines.push(`  API-->>-Client: Response (${flow.stats.totalDuration.toFixed(1)}ms)`);

  return lines.join('\n');
}

/**
 * Wraps the diagram in markdown code fence for direct GitHub rendering
 */
export function generateMarkdownDiagram(
  flow: RequestFlow,
  options: MermaidOptions = {}
): string {
  const diagram = generateMermaidDiagram(flow, options);
  return `\`\`\`mermaid\n${diagram}\n\`\`\``;
}

/**
 * Wraps the compact diagram in markdown code fence
 */
export function generateCompactMarkdownDiagram(flow: RequestFlow): string {
  const diagram = generateCompactMermaidDiagram(flow);
  return `\`\`\`mermaid\n${diagram}\n\`\`\``;
}

// Helper functions

interface TimelineItem {
  type: 'event' | 'database' | 'http' | 'cache';
  timestamp: number;
  data: any;
}

function buildChronologicalTimeline(flow: RequestFlow): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Add lifecycle events (excluding dependencies which are tracked separately)
  for (const event of flow.events) {
    if (['lifecycle', 'middleware', 'custom'].includes(event.type)) {
      items.push({
        type: 'event',
        timestamp: event.startTime,
        data: event,
      });
    }
  }

  // Add database calls
  for (const db of flow.dependencies.database) {
    items.push({
      type: 'database',
      timestamp: db.startTime,
      data: db,
    });
  }

  // Add HTTP calls
  for (const http of flow.dependencies.http) {
    items.push({
      type: 'http',
      timestamp: http.startTime,
      data: http,
    });
  }

  // Add cache operations
  for (const cache of flow.dependencies.cache) {
    items.push({
      type: 'cache',
      timestamp: cache.startTime,
      data: cache,
    });
  }

  // Sort by timestamp
  items.sort((a, b) => a.timestamp - b.timestamp);

  return items;
}

function processEvent(
  event: FlowEvent,
  lines: string[],
  includeTimings: boolean,
  showMetadata: boolean,
  maxLength: number
): void {
  const name = truncate(event.name, maxLength);
  const statusIcon = event.status === 'error' ? '❌' : event.status === 'completed' ? '✅' : '⏳';

  lines.push(`  Note over API: ${statusIcon} ${name}`);

  if (includeTimings && event.duration !== undefined) {
    lines.push(`  Note over API: Duration: ${event.duration.toFixed(2)}ms`);
  }

  if (showMetadata && event.metadata && Object.keys(event.metadata).length > 0) {
    const metadataStr = JSON.stringify(event.metadata);
    lines.push(`  Note over API: ${truncate(metadataStr, maxLength)}`);
  }

  if (event.error) {
    lines.push(`  Note over API: Error: ${truncate(event.error.message, maxLength)}`);
  }
}

function processDatabaseCall(
  db: DatabaseCall,
  lines: string[],
  includeTimings: boolean,
  maxLength: number
): void {
  const query = truncate(db.query, maxLength);

  lines.push(`  API->>+Database: ${query}`);

  if (db.error) {
    lines.push(`  Database-->>-API: ❌ Error: ${truncate(db.error, maxLength)}`);
  } else {
    const rows = db.rowsAffected !== undefined ? `${db.rowsAffected} rows` : 'OK';
    const timing = includeTimings ? ` (${db.duration.toFixed(2)}ms)` : '';
    lines.push(`  Database-->>-API: ${rows}${timing}`);
  }
}

function processHTTPCall(
  http: HTTPCall,
  lines: string[],
  includeTimings: boolean,
  maxLength: number
): void {
  const url = truncate(http.url, maxLength);

  lines.push(`  API->>+External: ${http.method} ${url}`);

  if (http.error) {
    lines.push(`  External-->>-API: ❌ Error: ${truncate(http.error, maxLength)}`);
  } else {
    const status = http.statusCode || '?';
    const timing = includeTimings ? ` (${http.duration.toFixed(2)}ms)` : '';
    const statusIcon = typeof status === 'number' && status >= 200 && status < 300 ? '✅' : typeof status === 'number' && status >= 400 ? '❌' : '⚠️';
    lines.push(`  External-->>-API: ${statusIcon} ${status}${timing}`);
  }
}

function processCacheOperation(
  cache: CacheOperation,
  lines: string[],
  includeTimings: boolean,
  maxLength: number
): void {
  const key = truncate(cache.key, maxLength);
  const op = cache.operation.toUpperCase();

  lines.push(`  API->>+Cache: ${op} ${key}`);

  if (cache.error) {
    lines.push(`  Cache-->>-API: ❌ Error: ${truncate(cache.error, maxLength)}`);
  } else {
    let result = '';
    if (cache.operation === 'get') {
      result = cache.hit ? '✅ HIT' : '❌ MISS';
    } else if (cache.operation === 'set') {
      result = cache.ttl ? `✅ OK (TTL: ${cache.ttl}s)` : '✅ OK';
    } else {
      result = '✅ OK';
    }

    const timing = includeTimings ? ` (${cache.duration.toFixed(2)}ms)` : '';
    lines.push(`  Cache-->>-API: ${result}${timing}`);
  }
}

/**
 * Safely extract URL path, handling both full URLs and relative paths
 */
function extractUrlPath(url: string): string {
  try {
    // Try to parse as full URL
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    // If it fails, it's likely a relative path or invalid URL
    // Return the URL as-is (it might be a relative path like "/api/users")
    return url;
  }
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}
