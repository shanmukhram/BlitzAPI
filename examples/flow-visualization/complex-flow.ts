/**
 * Complex Flow Example
 *
 * Demonstrates:
 * - Real-world application flow with multiple dependencies
 * - Cache-aside pattern with database fallback
 * - Parallel HTTP calls for performance
 * - Complete request lifecycle visualization
 */

import { createApp } from '../../src/core/server.js';
import { flowTrackingMiddleware } from '../../src/observability/flow/tracker.js';
import { trackCache, trackDatabase, trackHTTP } from '../../src/observability/flow/dependencies.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import type { Context } from '../../src/core/types.js';

// Mock services
const cache = new Map<string, any>();
const mockCache = {
  async get(key: string) {
    await new Promise(r => setTimeout(r, 2));
    return cache.get(key) || null;
  },
  async set(key: string, value: any) {
    await new Promise(r => setTimeout(r, 3));
    cache.set(key, value);
  },
};

const mockDB = {
  async query(sql: string, params?: any[]) {
    const delay = sql.includes('JOIN') ? 50 : 25;
    await new Promise(r => setTimeout(r, delay + Math.random() * 10));

    if (sql.includes('users')) {
      return [{ id: params?.[0], name: 'Alice', email: 'alice@example.com', city: 'NYC' }];
    } else if (sql.includes('orders')) {
      return [
        { id: 1, userId: params?.[0], total: 99.99, status: 'completed' },
        { id: 2, userId: params?.[0], total: 149.99, status: 'pending' },
      ];
    } else if (sql.includes('preferences')) {
      return [{ userId: params?.[0], theme: 'dark', notifications: true }];
    }
    return [];
  },
};

const mockAPI = {
  async getRecommendations(userId: string) {
    await new Promise(r => setTimeout(r, 80));
    return [
      { id: 1, name: 'Product A', score: 0.95 },
      { id: 2, name: 'Product B', score: 0.87 },
    ];
  },
  async getWeather(city: string) {
    await new Promise(r => setTimeout(r, 60));
    return { city, temp: 72, condition: 'Sunny' };
  },
  async getNotifications(userId: string) {
    await new Promise(r => setTimeout(r, 40));
    return [
      { id: 1, message: 'Your order has shipped', read: false },
    ];
  },
};

// Create app
const app = createApp({
  port: 3004,
  observability: {
    tracing: {
      enabled: true,
      exporter: 'console',
      serviceName: 'complex-flow-example',
    },
  },
});

app.use(flowTrackingMiddleware());
registerFlowRoutes(app as any);

// Complex endpoint: User dashboard with multiple dependencies
app.get('/users/:id/dashboard', async (ctx: Context) => {
  const userId = (ctx.params as any).id;

  // Step 1: Check cache for complete dashboard
  const dashboardKey = `dashboard:${userId}`;
  const cachedDashboard = await trackCache(ctx, 'get', dashboardKey, async () => {
    return mockCache.get(dashboardKey);
  });

  if (cachedDashboard) {
    return ctx.json({
      ...cachedDashboard,
      source: 'cache',
      traceId: ctx.trace?.traceId,
    });
  }

  // Step 2: Fetch user data from database (with cache check first)
  const userKey = `user:${userId}`;
  let user = await trackCache(ctx, 'get', userKey, async () => {
    return mockCache.get(userKey);
  });

  if (!user) {
    const users = await trackDatabase(
      ctx,
      'SELECT * FROM users WHERE id = ?',
      async () => mockDB.query('SELECT * FROM users WHERE id = ?', [userId]),
      { database: 'postgres' }
    );
    user = users[0];

    await trackCache(ctx, 'set', userKey, async () => {
      return mockCache.set(userKey, user);
    }, { ttl: 3600 });
  }

  // Step 3: Fetch orders from database
  const orders = await trackDatabase(
    ctx,
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    async () => mockDB.query('SELECT * FROM orders WHERE user_id = ?', [userId]),
    { database: 'postgres' }
  );

  // Step 4: Fetch user preferences
  const prefs = await trackDatabase(
    ctx,
    'SELECT * FROM user_preferences WHERE user_id = ?',
    async () => mockDB.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]),
    { database: 'postgres' }
  );

  // Step 5: Fetch external data in parallel
  const [recommendations, weather, notifications] = await Promise.all([
    trackHTTP(
      ctx,
      'GET',
      `https://api.recommendations.com/users/${userId}`,
      async () => mockAPI.getRecommendations(userId)
    ),
    trackHTTP(
      ctx,
      'GET',
      `https://api.weather.com/current?city=${user.city}`,
      async () => mockAPI.getWeather(user.city)
    ),
    trackHTTP(
      ctx,
      'GET',
      `https://api.notifications.com/users/${userId}`,
      async () => mockAPI.getNotifications(userId)
    ),
  ]);

  // Step 6: Build dashboard response
  const dashboard = {
    user,
    orders,
    preferences: prefs[0],
    recommendations,
    weather,
    notifications,
  };

  // Step 7: Cache the complete dashboard
  await trackCache(ctx, 'set', dashboardKey, async () => {
    return mockCache.set(dashboardKey, dashboard);
  }, { ttl: 300 });

  ctx.json({
    ...dashboard,
    source: 'computed',
    traceId: ctx.trace?.traceId,
  });
});

// E-commerce checkout flow
app.post('/checkout', async (ctx: Context) => {
  const { userId, items } = ctx.body as any;

  // Step 1: Validate cart items from database
  const cartValidation = await trackDatabase(
    ctx,
    'SELECT * FROM products WHERE id IN (?)',
    async () => mockDB.query('SELECT * FROM products WHERE id IN (?)', [items]),
    { database: 'postgres' }
  );

  // Step 2: Check inventory via HTTP
  const inventoryCheck = await trackHTTP(
    ctx,
    'POST',
    'https://api.inventory.com/check',
    async () => {
      await new Promise(r => setTimeout(r, 45));
      return { available: true, items };
    }
  );

  // Step 3: Process payment via HTTP
  const payment = await trackHTTP(
    ctx,
    'POST',
    'https://api.payments.com/charge',
    async () => {
      await new Promise(r => setTimeout(r, 120)); // Payment processing is slow
      return { success: true, transactionId: 'txn_123' };
    }
  );

  // Step 4: Create order in database
  const order = await trackDatabase(
    ctx,
    'INSERT INTO orders (user_id, items, total, status) VALUES (?, ?, ?, ?)',
    async () => mockDB.query('INSERT INTO orders VALUES (?)', [userId, items, 99.99, 'completed']),
    { database: 'postgres' }
  );

  // Step 5: Invalidate cart cache
  await trackCache(ctx, 'delete', `cart:${userId}`, async () => {
    return mockCache.set(`cart:${userId}`, null);
  });

  // Step 6: Send confirmation email via HTTP
  await trackHTTP(
    ctx,
    'POST',
    'https://api.email.com/send',
    async () => {
      await new Promise(r => setTimeout(r, 30));
      return { sent: true };
    }
  );

  ctx.json({
    success: true,
    orderId: (order[0] as any)?.id,
    transactionId: payment.transactionId,
    traceId: ctx.trace?.traceId,
  });
});

// Analytics endpoint with complex queries
app.get('/analytics/report', async (ctx: Context) => {
  // Complex JOIN query (slow)
  const salesData = await trackDatabase(
    ctx,
    'SELECT ... FROM orders JOIN users JOIN products WHERE ...',
    async () => {
      await new Promise(r => setTimeout(r, 150)); // Complex query
      return [{ total: 12345, count: 567 }];
    },
    { database: 'postgres' }
  );

  // Another complex query
  const userData = await trackDatabase(
    ctx,
    'SELECT ... FROM users JOIN user_preferences WHERE ...',
    async () => {
      await new Promise(r => setTimeout(r, 120));
      return [{ activeUsers: 1234, newUsers: 89 }];
    },
    { database: 'postgres' }
  );

  ctx.json({
    sales: salesData[0],
    users: userData[0],
    traceId: ctx.trace?.traceId,
    note: 'This endpoint has slow database queries (bottlenecks)',
  });
});

// Start server
app.listen(3004);

console.log('\n🔥 Complex Flow Example running on http://localhost:3004\n');
console.log('Try these endpoints:');
console.log('  GET  /users/1/dashboard    - Complex dashboard (cache + DB + HTTP)');
console.log('  POST /checkout             - E-commerce checkout flow');
console.log('  GET  /analytics/report     - Analytics with slow queries\n');
console.log('View flow visualizations:');
console.log('  GET  /profile/{traceId}/waterfall  - See complete request flow');
console.log('  GET  /profile/{traceId}/mermaid    - See sequence diagram');
console.log('  GET  /flow/stats                   - See aggregate statistics');
console.log('  GET  /flow/slow                    - See slowest requests\n');
console.log('Example workflow:');
console.log('  # First request - cache miss (full flow)');
console.log('  curl http://localhost:3004/users/1/dashboard');
console.log('  # Copy traceId from response');
console.log('  curl http://localhost:3004/profile/{traceId}/waterfall\n');
console.log('  # Second request - cache hit (much faster)');
console.log('  curl http://localhost:3004/users/1/dashboard');
console.log('  curl http://localhost:3004/profile/{traceId}/waterfall\n');
console.log('Checkout flow:');
console.log('  curl -X POST http://localhost:3004/checkout \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"userId": "1", "items": [1, 2, 3]}\'');
console.log('  # View the complete checkout flow');
console.log('  curl http://localhost:3004/profile/{traceId}/mermaid\n');
console.log('Find bottlenecks:');
console.log('  curl http://localhost:3004/analytics/report');
console.log('  # See which queries are slow');
console.log('  curl http://localhost:3004/profile/{traceId}/waterfall\n');
