/**
 * Phase 3.1: Performance Profiling Example
 * Demonstrates request timeline visualization, bottleneck detection, and performance budgets
 */

import { createApp } from '../../src/index.js';
import { registerProfileRoutes } from '../../src/observability/profiler/routes.js';

const app = createApp({
  observability: {
    enabled: true,

    // Tracing (Phase 3.0)
    tracing: {
      enabled: true,
      serviceName: 'ramapi-profiling-demo',
      serviceVersion: '1.0.0',
      exporter: 'console',
      sampleRate: 1.0,
    },

    // Logging
    logging: {
      enabled: true,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
    },

    // Metrics
    metrics: {
      enabled: true,
      collectInterval: 60000,
      prefix: 'ramapi_profiling',
    },

    // ⭐ NEW: Profiling (Phase 3.1)
    profiling: {
      enabled: true,
      captureMemory: true,           // Enable memory profiling
      bufferSize: 100,                // Keep last 100 profiles
      slowThreshold: 100,             // 100ms is considered slow
      enableBudgets: true,            // Enable performance budgets
      autoDetectBottlenecks: true,    // Automatic bottleneck detection
      captureStacks: false,           // Don't capture stack traces (overhead)
    },
  },
});

// Register profile API routes
registerProfileRoutes(app as any);

/**
 * Example 1: Fast endpoint (should not trigger slow detection)
 */
app.get('/fast', async (ctx) => {
  // Simulate fast operation
  await new Promise(resolve => setTimeout(resolve, 10));

  ctx.json({
    message: 'Fast response',
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 2: Slow endpoint (triggers slow detection)
 */
app.get('/slow', async (ctx) => {
  // Simulate slow operation
  await new Promise(resolve => setTimeout(resolve, 150));

  ctx.json({
    message: 'Slow response',
    traceId: ctx.trace?.traceId,
    warning: 'This endpoint is slow!',
  });
});

/**
 * Example 3: Very slow endpoint (triggers critical bottleneck detection)
 */
app.get('/very-slow', async (ctx) => {
  // Simulate very slow operation
  await new Promise(resolve => setTimeout(resolve, 300));

  ctx.json({
    message: 'Very slow response',
    traceId: ctx.trace?.traceId,
    warning: 'This endpoint is critically slow!',
  });
});

/**
 * Example 4: Multiple operations (demonstrates breakdown)
 */
app.get('/multi-stage', async (ctx) => {
  // Stage 1: "Database query"
  const dbSpan = ctx.startSpan!('database.query', {
    'db.operation': 'SELECT',
    'db.table': 'users',
  });
  await new Promise(resolve => setTimeout(resolve, 30));
  ctx.endSpan!(dbSpan);

  // Stage 2: "External API call"
  const apiSpan = ctx.startSpan!('external.api', {
    'http.url': 'https://api.example.com',
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  ctx.endSpan!(apiSpan);

  // Stage 3: "Processing"
  const processSpan = ctx.startSpan!('processing', {
    'operation': 'transform_data',
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  ctx.endSpan!(processSpan);

  ctx.json({
    message: 'Multi-stage operation complete',
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 5: Memory-intensive operation
 */
app.get('/memory-test', async (ctx) => {
  // Allocate large array to simulate memory usage
  const largeArray: number[] = [];
  for (let i = 0; i < 1000000; i++) {
    largeArray.push(Math.random());
  }

  // Force processing
  const sum = largeArray.reduce((a, b) => a + b, 0);

  ctx.json({
    message: 'Memory test complete',
    traceId: ctx.trace?.traceId,
    arraySize: largeArray.length,
    sum: sum.toFixed(2),
  });
});

/**
 * Example 6: Simulated N+1 query pattern
 */
app.get('/n-plus-one', async (ctx) => {
  // Simulate fetching list of users
  const userIds = [1, 2, 3, 4, 5];

  // N+1: One query for list, then one query per item
  for (const userId of userIds) {
    const span = ctx.startSpan!('database.query', {
      'db.operation': 'SELECT',
      'db.table': 'user_details',
      'db.user_id': userId,
    });
    await new Promise(resolve => setTimeout(resolve, 15));
    ctx.endSpan!(span);
  }

  ctx.json({
    message: 'N+1 query pattern (bottleneck detected)',
    traceId: ctx.trace?.traceId,
    userIds,
  });
});

/**
 * Example 7: Variable performance (demonstrates performance variance)
 */
app.get('/variable', async (ctx) => {
  // Random delay between 10-200ms
  const delay = Math.floor(Math.random() * 190) + 10;
  await new Promise(resolve => setTimeout(resolve, delay));

  ctx.json({
    message: 'Variable performance',
    traceId: ctx.trace?.traceId,
    delay: `${delay}ms`,
  });
});

// Health and metrics endpoints
app.get('/health', async (ctx) => {
  const stats = await import('../../src/observability/profiler/storage.js')
    .then(m => m.profileStorage.getStats());

  ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    profiling: stats,
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('🔍 RamAPI Performance Profiling Demo');
  console.log('============================================================');
  console.log('');
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Test Endpoints:');
  console.log('  GET  /fast            - Fast endpoint (10ms)');
  console.log('  GET  /slow            - Slow endpoint (150ms)');
  console.log('  GET  /very-slow       - Very slow endpoint (300ms)');
  console.log('  GET  /multi-stage     - Multi-stage operations');
  console.log('  GET  /memory-test     - Memory-intensive operation');
  console.log('  GET  /n-plus-one      - N+1 query pattern');
  console.log('  GET  /variable        - Variable performance');
  console.log('');
  console.log('📈 Profile API:');
  console.log('  GET  /profile/:traceId       - Get detailed profile');
  console.log('  GET  /profile/slow           - Slowest requests');
  console.log('  GET  /profile/stats          - Profile statistics');
  console.log('  GET  /profile/patterns       - Detect patterns');
  console.log('  GET  /profile/list           - List all profiles');
  console.log('');
  console.log('🎯 Try these commands:');
  console.log('  # Generate some traffic');
  console.log(`  curl http://localhost:${PORT}/slow`);
  console.log(`  curl http://localhost:${PORT}/very-slow`);
  console.log(`  curl http://localhost:${PORT}/n-plus-one`);
  console.log('');
  console.log('  # View slowest requests');
  console.log(`  curl http://localhost:${PORT}/profile/slow`);
  console.log('');
  console.log('  # View statistics');
  console.log(`  curl http://localhost:${PORT}/profile/stats`);
  console.log('');
  console.log('  # Get specific profile (copy traceId from response)');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>`);
  console.log('');
  console.log('💡 Watch the console for profiling output!');
  console.log('============================================================');
  console.log('');
});
