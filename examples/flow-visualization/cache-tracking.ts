/**
 * Cache Tracking Example
 *
 * Demonstrates:
 * - Tracking cache operations (get, set, delete)
 * - Cache hit/miss tracking
 * - Cache-aside pattern with flow visualization
 */

import { createApp } from '../../src/core/server.js';
import { flowTrackingMiddleware } from '../../src/observability/flow/tracker.js';
import { trackCache, trackDatabase } from '../../src/observability/flow/dependencies.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import type { Context } from '../../src/core/types.js';

// Mock cache
const mockCache = new Map<string, any>();

const cache = {
  async get(key: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 3));
    return mockCache.get(key) || null;
  },

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 3 + Math.random() * 2));
    mockCache.set(key, value);
    // In real implementation, would set TTL
  },

  async delete(key: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2));
    mockCache.delete(key);
  },
};

// Mock database
const mockDB = {
  async query(sql: string, params?: any[]): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    if (sql.includes('users')) {
      return [{ id: params?.[0], name: 'Alice', email: 'alice@example.com' }];
    } else if (sql.includes('products')) {
      return [{ id: params?.[0], name: 'Product A', price: 99.99 }];
    }
    return [];
  },
};

// Create app
const app = createApp({
  port: 3003,
  observability: {
    tracing: {
      enabled: true,
      exporter: 'console',
      serviceName: 'cache-tracking-example',
    },
  },
});

app.use(flowTrackingMiddleware());
registerFlowRoutes(app as any);

// Cache-aside pattern: Check cache, fallback to DB, update cache
app.get('/users/:id', async (ctx: Context) => {
  const userId = (ctx.params as any).id;
  const cacheKey = `user:${userId}`;

  // Try to get from cache
  const cachedUser = await trackCache(ctx, 'get', cacheKey, async () => {
    return cache.get(cacheKey);
  });

  if (cachedUser) {
    return ctx.json({
      user: cachedUser,
      source: 'cache',
      traceId: ctx.trace?.traceId,
    });
  }

  // Cache miss - fetch from database
  const users = await trackDatabase(
    ctx,
    'SELECT * FROM users WHERE id = ?',
    async () => mockDB.query('SELECT * FROM users WHERE id = ?', [userId]),
    { database: 'postgres' }
  );

  const user = users[0];

  // Store in cache for future requests
  await trackCache(ctx, 'set', cacheKey, async () => {
    return cache.set(cacheKey, user, 3600);
  }, {
    ttl: 3600,
    captureSize: true,
  });

  ctx.json({
    user,
    source: 'database',
    traceId: ctx.trace?.traceId,
  });
});

// Multiple cache operations
app.get('/products/:id', async (ctx: Context) => {
  const productId = (ctx.params as any).id;
  const cacheKey = `product:${productId}`;

  // Check cache
  const cachedProduct = await trackCache(ctx, 'get', cacheKey, async () => {
    return cache.get(cacheKey);
  });

  if (cachedProduct) {
    // Also check related products cache
    const relatedKey = `related:${productId}`;
    const cachedRelated = await trackCache(ctx, 'get', relatedKey, async () => {
      return cache.get(relatedKey);
    });

    return ctx.json({
      product: cachedProduct,
      related: cachedRelated || [],
      source: 'cache',
      traceId: ctx.trace?.traceId,
    });
  }

  // Cache miss - fetch from database
  const products = await trackDatabase(
    ctx,
    'SELECT * FROM products WHERE id = ?',
    async () => mockDB.query('SELECT * FROM products WHERE id = ?', [productId]),
    { database: 'postgres' }
  );

  const product = products[0];

  // Store product in cache
  await trackCache(ctx, 'set', cacheKey, async () => {
    return cache.set(cacheKey, product, 1800);
  }, {
    ttl: 1800,
  });

  // Also cache related products
  const relatedKey = `related:${productId}`;
  await trackCache(ctx, 'set', relatedKey, async () => {
    return cache.set(relatedKey, [], 1800);
  }, {
    ttl: 1800,
  });

  ctx.json({
    product,
    related: [],
    source: 'database',
    traceId: ctx.trace?.traceId,
  });
});

// Cache invalidation
app.put('/users/:id', async (ctx: Context) => {
  const userId = (ctx.params as any).id;
  const cacheKey = `user:${userId}`;

  // Update user in database
  const users = await trackDatabase(
    ctx,
    'UPDATE users SET ... WHERE id = ?',
    async () => mockDB.query('UPDATE users SET ... WHERE id = ?', [userId]),
    { database: 'postgres' }
  );

  const updatedUser = users[0];

  // Invalidate cache
  await trackCache(ctx, 'delete', cacheKey, async () => {
    return cache.delete(cacheKey);
  });

  ctx.json({
    user: updatedUser,
    message: 'User updated and cache invalidated',
    traceId: ctx.trace?.traceId,
  });
});

// Batch cache operations
app.get('/dashboard/stats', async (ctx: Context) => {
  // Check multiple cache keys
  const userCountKey = 'stats:users:count';
  const productCountKey = 'stats:products:count';
  const revenueKey = 'stats:revenue:total';

  const [userCount, productCount, revenue] = await Promise.all([
    trackCache(ctx, 'get', userCountKey, async () => cache.get(userCountKey)),
    trackCache(ctx, 'get', productCountKey, async () => cache.get(productCountKey)),
    trackCache(ctx, 'get', revenueKey, async () => cache.get(revenueKey)),
  ]);

  // If all cached, return immediately
  if (userCount !== null && productCount !== null && revenue !== null) {
    return ctx.json({
      stats: { userCount, productCount, revenue },
      source: 'cache',
      traceId: ctx.trace?.traceId,
    });
  }

  // Calculate stats from database
  const stats = {
    userCount: 1234,
    productCount: 567,
    revenue: 98765.43,
  };

  // Cache all stats
  await Promise.all([
    trackCache(ctx, 'set', userCountKey, async () => cache.set(userCountKey, stats.userCount, 300), { ttl: 300 }),
    trackCache(ctx, 'set', productCountKey, async () => cache.set(productCountKey, stats.productCount, 300), { ttl: 300 }),
    trackCache(ctx, 'set', revenueKey, async () => cache.set(revenueKey, stats.revenue, 300), { ttl: 300 }),
  ]);

  ctx.json({
    stats,
    source: 'calculated',
    traceId: ctx.trace?.traceId,
  });
});

// Cache warming endpoint
app.post('/cache/warm', async (ctx: Context) => {
  const items = ['user:1', 'user:2', 'product:1', 'product:2'];

  for (const key of items) {
    await trackCache(ctx, 'set', key, async () => {
      return cache.set(key, { data: 'warmed' }, 600);
    }, {
      ttl: 600,
    });
  }

  ctx.json({
    message: 'Cache warmed',
    items,
    traceId: ctx.trace?.traceId,
  });
});

// Start server
app.listen(3003);

console.log('\n💾 Cache Tracking Example running on http://localhost:3003\n');
console.log('Try these endpoints:');
console.log('  GET  /users/1              - Cache-aside pattern (first call: DB + cache SET)');
console.log('  GET  /users/1              - Second call should hit cache');
console.log('  GET  /products/1           - Multiple cache operations');
console.log('  PUT  /users/1              - Cache invalidation');
console.log('  GET  /dashboard/stats      - Batch cache operations');
console.log('  POST /cache/warm           - Cache warming');
console.log('\nView flow visualizations:');
console.log('  GET  /profile/{traceId}/waterfall');
console.log('  GET  /flow/stats\n');
console.log('Example workflow:');
console.log('  # First request - cache miss');
console.log('  curl http://localhost:3003/users/1');
console.log('  # Copy traceId and view flow (shows DB query + cache SET)');
console.log('  curl http://localhost:3003/profile/{traceId}/waterfall\n');
console.log('  # Second request - cache hit');
console.log('  curl http://localhost:3003/users/1');
console.log('  # View flow (shows only cache GET with hit=true)');
console.log('  curl http://localhost:3003/profile/{traceId}/waterfall\n');
console.log('Cache hit rate statistics:');
console.log('  curl http://localhost:3003/flow/stats | grep cacheHitRate\n');
