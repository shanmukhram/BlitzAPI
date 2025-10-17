/**
 * ASCII Waterfall Chart Generator
 * Phase 3.6: Visual timeline showing request flow with dependencies
 */

import type { RequestFlow, FlowEvent } from '../types.js';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

// Event type icons
const icons = {
  lifecycle: '⚡',
  middleware: '🔧',
  database: '🗄️',
  http: '🌐',
  cache: '💾',
  custom: '⚙️',
};

/**
 * Format duration with appropriate color
 */
function formatDuration(ms: number, threshold: number = 100): string {
  const formatted = `${ms.toFixed(2)}ms`;

  if (ms < threshold * 0.3) {
    return `${colors.green}${formatted}${colors.reset}`;
  } else if (ms < threshold) {
    return `${colors.yellow}${formatted}${colors.reset}`;
  } else {
    return `${colors.red}${formatted}${colors.reset}`;
  }
}

/**
 * Create a visual bar for the timeline
 */
function createBar(
  startTime: number,
  duration: number,
  totalDuration: number,
  width: number,
  color: string
): string {
  const startPos = Math.floor((startTime / totalDuration) * width);
  const barWidth = Math.max(1, Math.floor((duration / totalDuration) * width));

  const spaces = ' '.repeat(startPos);
  const bar = '▓'.repeat(barWidth);

  return `${spaces}${color}${bar}${colors.reset}`;
}

/**
 * Get color for event type
 */
function getEventColor(event: FlowEvent, slowThreshold: number = 100): string {
  // Color based on duration
  if (event.duration) {
    if (event.duration > slowThreshold) {
      return colors.red;
    } else if (event.duration > slowThreshold * 0.5) {
      return colors.yellow;
    }
  }

  // Default colors by type
  switch (event.type) {
    case 'database':
      return colors.blue;
    case 'http':
      return colors.magenta;
    case 'cache':
      return colors.cyan;
    case 'middleware':
      return colors.yellow;
    default:
      return colors.green;
  }
}

/**
 * Create timeline ruler
 */
function createTimelineRuler(totalDuration: number, width: number): string {
  const lines: string[] = [];

  // Timeline markers
  const markers: string[] = [];
  const step = totalDuration / 4; // 4 segments

  for (let i = 0; i <= 4; i++) {
    const time = i * step;
    markers.push(`${time.toFixed(0)}ms`);
  }

  // Create ruler line
  const ruler = markers.join(' '.repeat(Math.floor(width / 4) - 5));
  lines.push(`${colors.gray}${ruler}${colors.reset}`);

  // Create tick marks
  const ticks = '|' + '-'.repeat(Math.floor(width / 4) - 1) + '|' +
                 '-'.repeat(Math.floor(width / 4) - 1) + '|' +
                 '-'.repeat(Math.floor(width / 4) - 1) + '|' +
                 '-'.repeat(Math.floor(width / 4) - 1) + '|';
  lines.push(`${colors.gray}${ticks.substring(0, width)}${colors.reset}`);

  return lines.join('\n');
}

/**
 * Format event name with icon and truncation
 */
function formatEventName(event: FlowEvent, maxLength: number = 40): string {
  const icon = icons[event.type] || icons.custom;
  let name = event.name;

  // Truncate if too long
  if (name.length > maxLength) {
    name = name.substring(0, maxLength - 3) + '...';
  }

  return `${icon} ${name}`;
}

/**
 * Generate ASCII waterfall chart for request flow
 */
export function generateWaterfall(flow: RequestFlow, options?: {
  width?: number;
  slowThreshold?: number;
  showMetadata?: boolean;
}): string {
  const width = options?.width || 60;
  const slowThreshold = options?.slowThreshold || 100;
  const showMetadata = options?.showMetadata ?? false;

  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${colors.bold}${colors.cyan}Request Flow Timeline${colors.reset} ${colors.dim}(${formatDuration(flow.duration || 0)} total)${colors.reset}`);
  lines.push(`${colors.gray}${'═'.repeat(80)}${colors.reset}`);
  lines.push('');

  // Request info
  lines.push(`${colors.bold}Request:${colors.reset}      ${colors.white}${flow.method} ${flow.path}${colors.reset}`);
  lines.push(`${colors.bold}Trace ID:${colors.reset}     ${colors.dim}${flow.traceId}${colors.reset}`);
  lines.push(`${colors.bold}Duration:${colors.reset}     ${formatDuration(flow.duration || 0)}`);

  if (flow.slow) {
    lines.push(`${colors.bold}Status:${colors.reset}       ${colors.red}⚠️  SLOW REQUEST${colors.reset}`);
  } else {
    lines.push(`${colors.bold}Status:${colors.reset}       ${colors.green}✓ OK${colors.reset}`);
  }

  lines.push('');

  // Timeline ruler
  lines.push(`${colors.bold}Timeline:${colors.reset}`);
  lines.push('');
  lines.push(createTimelineRuler(flow.duration || 1, width));
  lines.push('');

  // Sort events by start time
  const sortedEvents = [...flow.events]
    .filter(e => e.startTime !== undefined && e.duration !== undefined)
    .sort((a, b) => a.startTime - b.startTime);

  // Render each event
  sortedEvents.forEach(event => {
    if (!event.duration) return;

    const relativeStart = event.startTime - flow.startTime;
    const color = getEventColor(event, slowThreshold);
    const bar = createBar(relativeStart, event.duration, flow.duration || 1, width, color);
    const name = formatEventName(event, 35);
    const duration = formatDuration(event.duration, slowThreshold);

    // Warning indicator for slow operations
    const warning = event.duration > slowThreshold ? ` ${colors.red}⚠️${colors.reset}` : '';

    lines.push(`${bar} ${name.padEnd(45)} ${duration}${warning}`);

    // Show metadata if requested and available
    if (showMetadata && event.metadata) {
      const metadataStr = JSON.stringify(event.metadata, null, 0);
      if (metadataStr.length > 2 && metadataStr !== '{}') {
        lines.push(`${colors.dim}${'  '.repeat(2)}↳ ${metadataStr}${colors.reset}`);
      }
    }
  });

  lines.push('');

  // Dependencies summary
  if (flow.stats.databaseCalls > 0 || flow.stats.httpCalls > 0 || flow.stats.cacheOperations > 0) {
    lines.push(`${colors.bold}Dependencies:${colors.reset}`);
    lines.push('');

    // Database
    if (flow.stats.databaseCalls > 0) {
      const avgTime = flow.stats.totalDatabaseTime / flow.stats.databaseCalls;
      lines.push(`  ${icons.database} ${colors.bold}Database Queries:${colors.reset} ${flow.stats.databaseCalls} ${colors.dim}(${formatDuration(flow.stats.totalDatabaseTime)} total, ${formatDuration(avgTime)} avg)${colors.reset}`);

      if (flow.dependencies.database.length > 0) {
        flow.dependencies.database.forEach(db => {
          const queryPreview = db.query.substring(0, 50) + (db.query.length > 50 ? '...' : '');
          const dbDuration = formatDuration(db.duration, slowThreshold);
          lines.push(`    ${colors.gray}•${colors.reset} ${queryPreview} ${colors.dim}(${dbDuration})${colors.reset}`);
          if (db.error) {
            lines.push(`      ${colors.red}✗ Error: ${db.error}${colors.reset}`);
          }
        });
      }
    }

    // HTTP
    if (flow.stats.httpCalls > 0) {
      const avgTime = flow.stats.totalHTTPTime / flow.stats.httpCalls;
      lines.push(`  ${icons.http} ${colors.bold}HTTP Calls:${colors.reset} ${flow.stats.httpCalls} ${colors.dim}(${formatDuration(flow.stats.totalHTTPTime)} total, ${formatDuration(avgTime)} avg)${colors.reset}`);

      if (flow.dependencies.http.length > 0) {
        flow.dependencies.http.forEach(http => {
          const httpDuration = formatDuration(http.duration, slowThreshold);
          const statusColor = http.statusCode && http.statusCode >= 400 ? colors.red : colors.green;
          const status = http.statusCode ? `${statusColor}${http.statusCode}${colors.reset}` : '';
          lines.push(`    ${colors.gray}•${colors.reset} ${http.method} ${http.url} ${status} ${colors.dim}(${httpDuration})${colors.reset}`);
          if (http.error) {
            lines.push(`      ${colors.red}✗ Error: ${http.error}${colors.reset}`);
          }
        });
      }
    }

    // Cache
    if (flow.stats.cacheOperations > 0) {
      const avgTime = flow.stats.totalCacheTime / flow.stats.cacheOperations;
      const hits = flow.dependencies.cache.filter(c => c.hit === true).length;
      const misses = flow.dependencies.cache.filter(c => c.hit === false).length;
      const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : 'N/A';

      lines.push(`  ${icons.cache} ${colors.bold}Cache Operations:${colors.reset} ${flow.stats.cacheOperations} ${colors.dim}(${formatDuration(flow.stats.totalCacheTime)} total, ${formatDuration(avgTime)} avg)${colors.reset}`);
      if (hits + misses > 0) {
        lines.push(`    ${colors.green}Hits: ${hits}${colors.reset} ${colors.gray}|${colors.reset} ${colors.red}Misses: ${misses}${colors.reset} ${colors.gray}|${colors.reset} ${colors.cyan}Hit Rate: ${hitRate}%${colors.reset}`);
      }

      if (flow.dependencies.cache.length > 0) {
        flow.dependencies.cache.forEach(cache => {
          const cacheDuration = formatDuration(cache.duration, slowThreshold);
          const hitStatus = cache.hit === true ? `${colors.green}HIT${colors.reset}` :
                           cache.hit === false ? `${colors.red}MISS${colors.reset}` : '';
          lines.push(`    ${colors.gray}•${colors.reset} ${cache.operation.toUpperCase()} ${cache.key} ${hitStatus} ${colors.dim}(${cacheDuration})${colors.reset}`);
          if (cache.error) {
            lines.push(`      ${colors.red}✗ Error: ${cache.error}${colors.reset}`);
          }
        });
      }
    }

    lines.push('');
  }

  // Bottlenecks
  if (flow.bottlenecks.length > 0) {
    lines.push(`${colors.bold}${colors.red}⚠️  Bottlenecks Detected:${colors.reset}`);
    lines.push('');
    flow.bottlenecks.forEach(bottleneck => {
      lines.push(`  ${colors.red}•${colors.reset} ${bottleneck}`);
    });
    lines.push('');
  }

  // Performance insights
  const insights: string[] = [];

  // Check if dependencies dominate the request time
  const dependencyTime = flow.stats.totalDatabaseTime + flow.stats.totalHTTPTime + flow.stats.totalCacheTime;
  const dependencyPercentage = flow.duration ? (dependencyTime / flow.duration) * 100 : 0;

  if (dependencyPercentage > 70) {
    insights.push(`${colors.yellow}⚡${colors.reset} Dependencies account for ${dependencyPercentage.toFixed(1)}% of request time`);
  }

  if (flow.stats.databaseCalls > 10) {
    insights.push(`${colors.yellow}⚡${colors.reset} High number of database queries (${flow.stats.databaseCalls}) - consider optimization`);
  }

  if (flow.stats.httpCalls > 5) {
    insights.push(`${colors.yellow}⚡${colors.reset} Multiple HTTP calls (${flow.stats.httpCalls}) - consider parallel execution or caching`);
  }

  const cacheHits = flow.dependencies.cache.filter(c => c.hit === true).length;
  const cacheMisses = flow.dependencies.cache.filter(c => c.hit === false).length;
  if (cacheMisses > cacheHits && cacheMisses > 3) {
    insights.push(`${colors.yellow}⚡${colors.reset} Low cache hit rate - consider cache warming or TTL adjustment`);
  }

  if (insights.length > 0) {
    lines.push(`${colors.bold}${colors.cyan}💡 Performance Insights:${colors.reset}`);
    lines.push('');
    insights.forEach(insight => {
      lines.push(`  ${insight}`);
    });
    lines.push('');
  }

  // Footer
  lines.push(`${colors.gray}${'═'.repeat(80)}${colors.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a compact waterfall (one-line per event)
 */
export function generateCompactWaterfall(flow: RequestFlow): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${colors.bold}${flow.method} ${flow.path}${colors.reset} ${colors.dim}(${formatDuration(flow.duration || 0)})${colors.reset}`);
  lines.push('');

  const sortedEvents = [...flow.events]
    .filter(e => e.duration !== undefined)
    .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

  sortedEvents.forEach(event => {
    const icon = icons[event.type] || icons.custom;
    const duration = formatDuration(event.duration || 0);
    lines.push(`  ${icon} ${event.name.padEnd(40)} ${duration}`);
  });

  lines.push('');

  return lines.join('\n');
}
