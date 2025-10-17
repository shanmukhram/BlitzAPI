/**
 * Basic Flow Tracking Example
 *
 * Demonstrates:
 * - Setting up flow tracking middleware
 * - Automatic lifecycle event tracking
 * - Viewing flow visualizations
 */

import { createApp } from '../../src/core/server.js';
import { flowTrackingMiddleware } from '../../src/observability/flow/tracker.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import type { Context } from '../../src/core/types.js';

// Create app with tracing enabled (required for flow tracking)
const app = createApp({
  port: 3000,
  observability: {
    tracing: {
      enabled: true,
      exporter: 'console',
      serviceName: 'basic-flow-example',
      sampleRate: 1.0, // 100% sampling
    },
  },
});

// Enable flow tracking middleware
app.use(flowTrackingMiddleware());

// Register flow visualization routes
registerFlowRoutes(app as any);

// Simple endpoint - flow tracking is automatic
app.get('/', async (ctx: Context) => {
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 10));

  ctx.json({
    message: 'Hello, Flow Tracking!',
    traceId: ctx.trace?.traceId,
    tip: `View flow: http://localhost:3000/profile/${ctx.trace?.traceId}/waterfall`
  });
});

// Endpoint with artificial delay
app.get('/slow', async (ctx: Context) => {
  // Simulate slow operation
  await new Promise(resolve => setTimeout(resolve, 250));

  ctx.json({
    message: 'Slow endpoint',
    traceId: ctx.trace?.traceId,
  });
});

// Start server
app.listen(3000);

console.log('\n🚀 Basic Flow Tracking Example running on http://localhost:3000\n');
console.log('Try these endpoints:');
console.log('  GET  /                  - Simple endpoint');
console.log('  GET  /slow              - Slow endpoint (250ms)');
console.log('\nView flow visualizations:');
console.log('  GET  /profile/{traceId}/waterfall  - ASCII waterfall chart');
console.log('  GET  /profile/{traceId}/mermaid    - Mermaid sequence diagram');
console.log('  GET  /profile/{traceId}/flow       - Raw JSON data');
console.log('  GET  /flow/stats                   - Flow statistics');
console.log('  GET  /flow/slow                    - Slowest requests\n');
