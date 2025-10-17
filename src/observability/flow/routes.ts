/**
 * Flow API endpoints
 * Provides REST API for accessing request flow visualization data
 */

import type { Router } from '../../core/router.js';
import type { Context } from '../../core/types.js';
import { flowStorage } from './storage.js';
import { generateWaterfall, generateCompactWaterfall } from './exporters/waterfall.js';
import {
  generateMermaidDiagram,
  generateCompactMermaidDiagram,
  generateMarkdownDiagram,
  generateCompactMarkdownDiagram,
} from './exporters/mermaid.js';

/**
 * Register flow routes on a router
 */
export function registerFlowRoutes(router: Router): void {
  // Register specific routes FIRST (before parameterized routes)

  // GET /flow/slow - Get slowest flows
  router.get('/flow/slow', async (ctx: Context) => {
    const limit = parseInt(((ctx.query as any)?.limit as string) || '10', 10);
    const format = ((ctx.query as any)?.format as string) || 'json';

    const slowFlows = flowStorage.getSlowest(limit);

    if (format === 'json') {
      ctx.json(slowFlows);
    } else {
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(
        `Top ${limit} Slowest Flows\n` +
          `${'='.repeat(60)}\n\n` +
          slowFlows
            .map(
              (f, i) =>
                `${i + 1}. [${f.traceId}] ${f.method} ${f.path}\n` +
                `   Duration: ${f.stats.totalDuration.toFixed(2)}ms\n` +
                `   Events: ${f.events.length} | DB: ${f.dependencies.database.length} | HTTP: ${f.dependencies.http.length} | Cache: ${f.dependencies.cache.length}\n` +
                `   Bottlenecks: ${f.bottlenecks.join(', ') || 'None'}`
            )
            .join('\n\n')
      );
    }
  });

  // GET /flow/bottlenecks - Get flows with bottlenecks
  router.get('/flow/bottlenecks', async (ctx: Context) => {
    const limit = parseInt(((ctx.query as any)?.limit as string) || '10', 10);
    const format = ((ctx.query as any)?.format as string) || 'json';

    const bottleneckFlows = flowStorage.getBottlenecks(limit);

    if (format === 'json') {
      ctx.json(bottleneckFlows);
    } else {
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(
        `Flows with Bottlenecks\n` +
          `${'='.repeat(60)}\n\n` +
          bottleneckFlows
            .map(
              (f, i) =>
                `${i + 1}. [${f.traceId}] ${f.method} ${f.path}\n` +
                `   Duration: ${f.stats.totalDuration.toFixed(2)}ms\n` +
                `   Bottlenecks:\n` +
                f.bottlenecks.map(b => `     - ${b}`).join('\n')
            )
            .join('\n\n')
      );
    }
  });

  // GET /flow/stats - Get flow statistics
  router.get('/flow/stats', async (ctx: Context) => {
    const format = ((ctx.query as any)?.format as string) || 'json';
    const stats = flowStorage.getStats();

    if (format === 'json') {
      ctx.json(stats);
    } else {
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(
        `Flow Statistics\n` +
          `${'='.repeat(60)}\n\n` +
          `Total Flows: ${stats.totalFlows}\n` +
          `Slow Flows: ${stats.slowFlows} (${((stats.slowFlows / stats.totalFlows) * 100).toFixed(1)}%)\n` +
          `Flows with Bottlenecks: ${stats.flowsWithBottlenecks}\n\n` +
          `Duration Metrics:\n` +
          `  Average: ${stats.averageDuration.toFixed(2)}ms\n` +
          `  P50: ${stats.p50Duration.toFixed(2)}ms\n` +
          `  P95: ${stats.p95Duration.toFixed(2)}ms\n` +
          `  P99: ${stats.p99Duration.toFixed(2)}ms\n\n` +
          `Dependencies:\n` +
          `  Database Calls: ${stats.totalDatabaseCalls}\n` +
          `  HTTP Calls: ${stats.totalHTTPCalls}\n` +
          `  Cache Operations: ${stats.totalCacheOperations}\n` +
          `  Cache Hit Rate: ${stats.cacheHitRate.toFixed(1)}%\n\n` +
          `Common Bottlenecks:\n` +
          stats.commonBottlenecks.map((b, i) => `  ${i + 1}. ${b.name} (${b.count} occurrences)`).join('\n')
      );
    }
  });

  // GET /flow/list - List all flows with filtering
  router.get('/flow/list', async (ctx: Context) => {
    const {
      limit,
      offset,
      slow,
      traceId,
      minDuration,
      maxDuration,
      eventType,
      eventName,
      hasBottlenecks,
      hasDependency,
      sortBy,
      sortDirection,
      format,
    } = ctx.query as any;

    const flows = flowStorage.query({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      slow: slow === 'true' ? true : slow === 'false' ? false : undefined,
      traceId,
      minDuration: minDuration ? parseFloat(minDuration) : undefined,
      maxDuration: maxDuration ? parseFloat(maxDuration) : undefined,
      eventType,
      eventName,
      hasBottlenecks: hasBottlenecks === 'true' ? true : hasBottlenecks === 'false' ? false : undefined,
      hasDependency,
      sortBy,
      sortDirection,
    });

    if (format === 'json') {
      ctx.json(flows);
    } else {
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(
        `Request Flows (${flows.length} results)\n` +
          `${'='.repeat(60)}\n\n` +
          flows
            .map(
              (f, i) =>
                `${i + 1}. [${f.traceId}] ${f.method} ${f.path}\n` +
                `   Duration: ${f.stats.totalDuration.toFixed(2)}ms ${f.slow ? '🐌 SLOW' : ''}\n` +
                `   Dependencies: DB=${f.dependencies.database.length} HTTP=${f.dependencies.http.length} Cache=${f.dependencies.cache.length}`
            )
            .join('\n\n')
      );
    }
  });

  // DELETE /flow/clear - Clear all flows
  router.delete('/flow/clear', async (ctx: Context) => {
    const count = flowStorage.count();
    flowStorage.clear();

    ctx.json({
      message: 'Flows cleared',
      cleared: count,
    });
  });

  // GET /profile/:traceId/flow - Get flow data as JSON
  router.get('/profile/:traceId/flow', async (ctx: Context) => {
    const { traceId } = ctx.params as any;

    const flow = flowStorage.get(traceId);

    if (!flow) {
      ctx.json({ error: 'Flow not found', traceId }, 404);
      return;
    }

    ctx.json(flow);
  });

  // GET /profile/:traceId/waterfall - Get ASCII waterfall chart
  router.get('/profile/:traceId/waterfall', async (ctx: Context) => {
    const { traceId } = ctx.params as any;
    const format = ((ctx.query as any)?.format as string) || 'full';
    const width = parseInt(((ctx.query as any)?.width as string) || '80', 10);
    const slowThreshold = parseFloat(((ctx.query as any)?.slowThreshold as string) || '100');
    const showMetadata = ((ctx.query as any)?.showMetadata as string) === 'true';

    const flow = flowStorage.get(traceId);

    if (!flow) {
      ctx.json({ error: 'Flow not found', traceId }, 404);
      return;
    }

    let waterfall: string;
    if (format === 'compact') {
      waterfall = generateCompactWaterfall(flow);
    } else {
      waterfall = generateWaterfall(flow, {
        width,
        slowThreshold,
        showMetadata,
      });
    }

    ctx.res.setHeader('Content-Type', 'text/plain');
    ctx.text(waterfall);
  });

  // GET /profile/:traceId/mermaid - Get Mermaid sequence diagram
  router.get('/profile/:traceId/mermaid', async (ctx: Context) => {
    const { traceId } = ctx.params as any;
    const format = ((ctx.query as any)?.format as string) || 'full';
    const includeTimings = ((ctx.query as any)?.includeTimings as string) !== 'false';
    const showMetadata = ((ctx.query as any)?.showMetadata as string) === 'true';
    const maxMessageLength = parseInt(((ctx.query as any)?.maxMessageLength as string) || '50', 10);
    const markdown = ((ctx.query as any)?.markdown as string) === 'true';

    const flow = flowStorage.get(traceId);

    if (!flow) {
      ctx.json({ error: 'Flow not found', traceId }, 404);
      return;
    }

    let diagram: string;
    if (format === 'compact') {
      diagram = markdown
        ? generateCompactMarkdownDiagram(flow)
        : generateCompactMermaidDiagram(flow);
    } else {
      diagram = markdown
        ? generateMarkdownDiagram(flow, { includeTimings, showMetadata, maxMessageLength })
        : generateMermaidDiagram(flow, { includeTimings, showMetadata, maxMessageLength });
    }

    if (markdown) {
      ctx.res.setHeader('Content-Type', 'text/markdown');
    } else {
      ctx.res.setHeader('Content-Type', 'text/plain');
    }
    ctx.text(diagram);
  });

  // GET /profile/:traceId - Enhanced to support format parameter for flow visualization
  router.get('/profile/:traceId', async (ctx: Context) => {
    const { traceId } = ctx.params as any;
    const format = ((ctx.query as any)?.format as string) || 'json';

    const flow = flowStorage.get(traceId);

    if (!flow) {
      ctx.json({ error: 'Flow not found', traceId }, 404);
      return;
    }

    // Support multiple formats via format parameter
    if (format === 'waterfall') {
      const waterfall = generateWaterfall(flow);
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(waterfall);
    } else if (format === 'mermaid') {
      const diagram = generateMermaidDiagram(flow);
      ctx.res.setHeader('Content-Type', 'text/plain');
      ctx.text(diagram);
    } else if (format === 'markdown') {
      const diagram = generateMarkdownDiagram(flow);
      ctx.res.setHeader('Content-Type', 'text/markdown');
      ctx.text(diagram);
    } else {
      // Default: JSON
      ctx.json(flow);
    }
  });
}
