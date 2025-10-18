/**
 * RamAPI Observability Example
 * Demonstrates CORE USP: Best-in-class tracing, logging, and metrics
 *
 * Run in DEV:  npm run example:observability
 * Run in PROD: NODE_ENV=production npm run example:observability
 */

import { z } from 'zod';
import { createApp } from '../../src/index.js';
import { logger, startSpan, endSpan } from '../../src/observability/index.js';
import type { Context } from '../../src/core/types.js';

// ============================================================================
// 1. CREATE APP WITH FULL OBSERVABILITY CONFIGURATION
// ============================================================================

const app = createApp({
  observability: {
    enabled: true,

    // Tracing configuration
    tracing: {
      enabled: true,
      serviceName: 'ramapi-demo',
      serviceVersion: '1.0.0',
      exporter: 'console',  // Use 'console' for demo (in prod: 'otlp')
      sampleRate: 1.0,      // 100% sampling for demo

      // Advanced options
      captureStackTraces: true,
      maxSpanAttributes: 128,
      redactHeaders: ['authorization', 'cookie', 'x-api-key'],
      captureRequestBody: false,   // Security first
      captureResponseBody: false,
      spanNaming: 'http.route',
      defaultAttributes: {
        'service.environment': process.env.NODE_ENV || 'development',
        'service.team': 'ramapi',
      },
    },

    // Logging configuration
    logging: {
      enabled: true,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: process.env.NODE_ENV === 'production' ? 'json' : 'pretty',
      redactFields: ['password', 'token', 'secret', 'apiKey'],
      includeStackTrace: true,
    },

    // Metrics configuration
    metrics: {
      enabled: true,
      collectInterval: 60000,  // 1 minute
      prefix: 'ramapi_demo',
    },
  },
});

// ============================================================================
// 2. EXAMPLE: SIMPLE ENDPOINT WITH AUTOMATIC TRACING
// ============================================================================

app.get('/hello', async (ctx) => {
  // Automatically traced! Trace ID in logs
  logger.info('Hello endpoint called', { user: 'demo' });

  ctx.json({
    message: 'Hello, RamAPI!',
    traceId: ctx.trace?.traceId,
  });
});

// ============================================================================
// 3. EXAMPLE: DEMONSTRATE ALL LOG LEVELS
// ============================================================================

app.get('/logs', async (ctx) => {
  logger.trace('Ultra-verbose trace log', { detail: 'very detailed' });
  logger.debug('Debug information', { debugData: 123 });
  logger.info('Information log', { info: 'normal operation' });
  logger.warn('Warning log', { warning: 'something to watch' });
  logger.error('Error log', { error: 'something went wrong' });
  logger.fatal('Fatal log', { fatal: 'critical error' });

  ctx.json({ message: 'Check console for all log levels!' });
});

// ============================================================================
// 4. EXAMPLE: CUSTOM SPANS FOR DETAILED TRACING
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

app.get('/users/:id', async (ctx) => {
  logger.info('Fetching user', { userId: ctx.params.id });

  // Create custom span for database operation
  const dbSpan = ctx.startSpan!('database.query', {
    'db.operation': 'SELECT',
    'db.table': 'users',
    'db.user_id': ctx.params.id,
  });

  try {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50));

    const user: User = {
      id: ctx.params.id as string,
      name: 'John Doe',
      email: 'john@example.com',
    };

    dbSpan.setAttribute('db.rows_returned', 1);
    ctx.endSpan!(dbSpan);

    logger.info('User fetched successfully', { userId: user.id });

    ctx.json(user);
  } catch (error) {
    ctx.endSpan!(dbSpan, error as Error);
    throw error;
  }
});

// ============================================================================
// 5. EXAMPLE: COMPLEX OPERATION WITH MULTIPLE SPANS
// ============================================================================

app.post('/orders', async (ctx) => {
  const orderId = Math.random().toString(36).substring(7);

  logger.info('Creating order', { orderId });

  // Span 1: Validate inventory
  const inventorySpan = ctx.startSpan!('inventory.check', {
    'order.id': orderId,
  });
  await new Promise(resolve => setTimeout(resolve, 30));
  inventorySpan.setAttribute('inventory.available', true);
  ctx.endSpan!(inventorySpan);

  // Span 2: Process payment
  const paymentSpan = ctx.startSpan!('payment.process', {
    'order.id': orderId,
    'payment.method': 'credit_card',
  });
  await new Promise(resolve => setTimeout(resolve, 100));
  paymentSpan.setAttribute('payment.status', 'success');
  ctx.endSpan!(paymentSpan);

  // Span 3: Send notification
  const notifySpan = ctx.startSpan!('notification.send', {
    'order.id': orderId,
    'notification.type': 'email',
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  ctx.endSpan!(notifySpan);

  logger.info('Order created successfully', { orderId });

  ctx.json({
    orderId,
    status: 'completed',
    traceId: ctx.trace?.traceId,
  });
});

// ============================================================================
// 6. EXAMPLE: ERROR HANDLING WITH TRACING
// ============================================================================

app.get('/error', async (ctx) => {
  logger.warn('About to trigger an error');

  const errorSpan = ctx.startSpan!('error.simulation');

  try {
    throw new Error('Simulated error for testing!');
  } catch (error) {
    logger.error('Error occurred', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    ctx.endSpan!(errorSpan, error as Error);

    ctx.status(500).json({
      error: 'Internal server error',
      traceId: ctx.trace?.traceId,
    });
  }
});

// ============================================================================
// 7. EXAMPLE: NESTED OPERATIONS (Child Spans)
// ============================================================================

async function fetchUserData(ctx: Context, userId: string) {
  const span = ctx.startSpan!('user.fetch', { userId });

  logger.debug('Fetching user data', { userId });
  await new Promise(resolve => setTimeout(resolve, 30));

  ctx.endSpan!(span);
  return { id: userId, name: 'Jane Doe' };
}

async function fetchUserOrders(ctx: Context, userId: string) {
  const span = ctx.startSpan!('orders.fetch', { userId });

  logger.debug('Fetching user orders', { userId });
  await new Promise(resolve => setTimeout(resolve, 40));

  ctx.endSpan!(span);
  return [{ id: 'order1', total: 100 }, { id: 'order2', total: 200 }];
}

app.get('/profile/:userId', async (ctx) => {
  const userId = ctx.params.userId as string;

  logger.info('Building user profile', { userId });

  // Parallel operations with child spans
  const profileSpan = ctx.startSpan!('profile.build', { userId });

  const [user, orders] = await Promise.all([
    fetchUserData(ctx, userId),
    fetchUserOrders(ctx, userId),
  ]);

  ctx.endSpan!(profileSpan);

  logger.info('Profile built successfully', {
    userId,
    ordersCount: orders.length,
  });

  ctx.json({
    user,
    orders,
    totalOrders: orders.length,
    traceId: ctx.trace?.traceId,
  });
});

// ============================================================================
// 8. METRICS ENDPOINT (PROMETHEUS FORMAT)
// ============================================================================

import { exportPrometheusMetrics } from '../../src/observability/metrics.js';

app.get('/metrics', async (ctx) => {
  const metrics = exportPrometheusMetrics();
  ctx.res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  ctx.text(metrics);
});

// ============================================================================
// 9. HEALTH CHECK ENDPOINT
// ============================================================================

import { getMetrics } from '../../src/observability/metrics.js';

app.get('/health', async (ctx) => {
  const metrics = getMetrics();

  ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    metrics: {
      totalRequests: metrics.totalRequests,
      requestsPerSecond: Math.round(metrics.requestsPerSecond * 100) / 100,
      averageLatency: Math.round(metrics.averageLatency * 100) / 100,
      p50Latency: Math.round(metrics.p50Latency * 100) / 100,
      p95Latency: Math.round(metrics.p95Latency * 100) / 100,
      p99Latency: Math.round(metrics.p99Latency * 100) / 100,
      errorRate: Math.round(metrics.errorRate * 10000) / 100,
    },
  });
});

// ============================================================================
// 10. START SERVER
// ============================================================================

const PORT = 3000;

app.listen(PORT, '0.0.0.0').then(() => {
  console.log('');
  console.log('🔍 RamAPI Observability Demo');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Endpoints:');
  console.log('  GET  /hello           - Simple traced endpoint');
  console.log('  GET  /logs            - Demonstrate all log levels');
  console.log('  GET  /users/:id       - Custom spans example');
  console.log('  POST /orders          - Multiple spans example');
  console.log('  GET  /error           - Error handling with traces');
  console.log('  GET  /profile/:userId - Nested operations example');
  console.log('  GET  /health          - Health check with metrics');
  console.log('  GET  /metrics         - Prometheus metrics');
  console.log('');
  console.log('🎯 Try these:');
  console.log('  curl http://localhost:3000/hello');
  console.log('  curl http://localhost:3000/users/123');
  console.log('  curl -X POST http://localhost:3000/orders');
  console.log('  curl http://localhost:3000/profile/456');
  console.log('  curl http://localhost:3000/health');
  console.log('  curl http://localhost:3000/metrics');
  console.log('');
  console.log('💡 Watch the console for structured logs with trace IDs!');
  console.log('='.repeat(60));
  console.log('');
});
