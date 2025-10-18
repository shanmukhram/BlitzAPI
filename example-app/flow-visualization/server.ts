/**
 * Phase 3.6: Flow Visualization Example
 * Demonstrates request flow tracking with database, HTTP, and cache dependencies
 */

import { createApp } from '../../src/index.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import { flowTrackingMiddleware, trackDatabase, trackHTTP, trackCache } from '../../src/observability/flow/index.js';
import { configureStorage } from '../../src/observability/flow/storage.js';

const app = createApp({
  observability: {
    enabled: true,

    // Tracing (Phase 3.0)
    tracing: {
      enabled: true,
      serviceName: 'ramapi-flow-demo',
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
      prefix: 'ramapi_flow',
    },

    // Profiling (Phase 3.1)
    profiling: {
      enabled: true,
      captureMemory: true,
      bufferSize: 100,
      slowThreshold: 100,
      enableBudgets: true,
      autoDetectBottlenecks: true,
      captureStacks: false,
    },
  },
});

// Configure flow storage
configureStorage({
  flowMaxSize: 200,
  profileMaxSize: 200,
});

// Enable flow tracking middleware
app.use(flowTrackingMiddleware());

// Register flow API routes
registerFlowRoutes(app as any);

/**
 * Example 1: Simple endpoint (minimal flow)
 */
app.get('/simple', async (ctx) => {
  await new Promise(resolve => setTimeout(resolve, 10));

  ctx.json({
    message: 'Simple endpoint',
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 2: Database queries (demonstrates DB tracking)
 */
app.get('/users', async (ctx) => {
  // Simulate database query
  const users = await trackDatabase(
    ctx,
    'SELECT * FROM users WHERE active = true',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ];
    },
    { database: 'postgres', sanitize: true }
  );

  // Simulate another query for user details
  await trackDatabase(
    ctx,
    'SELECT * FROM user_profiles WHERE user_id IN (1, 2, 3)',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return [];
    },
    { database: 'postgres' }
  );

  ctx.json({
    message: 'Users fetched',
    count: users.length,
    users,
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 3: HTTP calls (demonstrates external API tracking)
 */
app.get('/weather', async (ctx) => {
  const city = (ctx.query as any)?.city || 'London';

  // Simulate external API call
  const weatherData = await trackHTTP(
    ctx,
    'GET',
    `https://api.weather.com/v1/current?city=${city}`,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 45));
      return {
        temperature: 20,
        condition: 'Sunny',
        humidity: 65,
      };
    }
  );

  ctx.json({
    message: 'Weather fetched',
    city,
    weather: weatherData,
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 4: Cache operations (demonstrates cache tracking)
 */
app.get('/products/:id', async (ctx) => {
  const productId = (ctx.params as any).id;
  const cacheKey = `product:${productId}`;

  // Try to get from cache
  let product = await trackCache(
    ctx,
    'get',
    cacheKey,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      // Simulate cache miss
      return null;
    }
  );

  if (!product) {
    // Cache miss - fetch from database
    product = await trackDatabase(
      ctx,
      `SELECT * FROM products WHERE id = ${productId}`,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return {
          id: productId,
          name: 'Awesome Product',
          price: 99.99,
        };
      },
      { database: 'postgres' }
    );

    // Store in cache
    await trackCache(
      ctx,
      'set',
      cacheKey,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 3));
        return 'OK';
      },
      { ttl: 3600, captureSize: true }
    );
  }

  ctx.json({
    message: 'Product fetched',
    product,
    cached: false,
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 5: Complex flow with all dependency types
 */
app.get('/dashboard', async (ctx) => {
  const userId = (ctx.query as any)?.userId || '123';

  // 1. Check cache for user data
  const cachedUser = await trackCache(
    ctx,
    'get',
    `user:${userId}`,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 3));
      return null; // Cache miss
    }
  );

  // 2. Fetch user from database
  const user = await trackDatabase(
    ctx,
    'SELECT * FROM users WHERE id = ?',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { id: userId, name: 'John Doe', email: 'john@example.com' };
    },
    { database: 'mysql' }
  );

  // 3. Cache the user
  await trackCache(
    ctx,
    'set',
    `user:${userId}`,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      return 'OK';
    },
    { ttl: 300 }
  );

  // 4. Fetch user's recent orders from database
  const orders = await trackDatabase(
    ctx,
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 35));
      return [
        { id: 1, total: 150.0 },
        { id: 2, total: 75.5 },
      ];
    },
    { database: 'mysql' }
  );

  // 5. Fetch analytics from external service
  const analytics = await trackHTTP(
    ctx,
    'POST',
    'https://analytics.example.com/api/user-stats',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 60));
      return {
        totalSpent: 225.5,
        orderCount: 2,
        lastPurchase: '2024-01-15',
      };
    }
  );

  // 6. Fetch recommendations from another service
  const recommendations = await trackHTTP(
    ctx,
    'GET',
    `https://recommendations.example.com/api/users/${userId}/recommended`,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
      return [
        { id: 101, name: 'Product A' },
        { id: 102, name: 'Product B' },
      ];
    }
  );

  ctx.json({
    message: 'Dashboard data fetched',
    user,
    orders,
    analytics,
    recommendations,
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 6: Slow endpoint with bottlenecks
 */
app.get('/slow-report', async (ctx) => {
  // Slow database query (bottleneck)
  await trackDatabase(
    ctx,
    'SELECT * FROM analytics_events WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 150)); // 150ms - slow!
      return [];
    },
    { database: 'postgres' }
  );

  // Another slow query
  await trackDatabase(
    ctx,
    'SELECT * FROM aggregated_stats GROUP BY date',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 120)); // 120ms - slow!
      return [];
    },
    { database: 'postgres' }
  );

  // Slow external API
  await trackHTTP(
    ctx,
    'GET',
    'https://legacy-system.example.com/api/report',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms - very slow!
      return { status: 'generated' };
    }
  );

  ctx.json({
    message: 'Report generated (with bottlenecks)',
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 7: N+1 query pattern (anti-pattern)
 */
app.get('/posts-with-authors', async (ctx) => {
  // Fetch posts
  const posts = await trackDatabase(
    ctx,
    'SELECT * FROM posts LIMIT 5',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return [
        { id: 1, authorId: 10, title: 'Post 1' },
        { id: 2, authorId: 11, title: 'Post 2' },
        { id: 3, authorId: 12, title: 'Post 3' },
        { id: 4, authorId: 10, title: 'Post 4' },
        { id: 5, authorId: 13, title: 'Post 5' },
      ];
    },
    { database: 'postgres' }
  );

  // N+1: Individual query for each author (BAD!)
  const postsWithAuthors = [];
  for (const post of posts) {
    const author = await trackDatabase(
      ctx,
      `SELECT * FROM users WHERE id = ${post.authorId}`,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 15));
        return { id: post.authorId, name: `Author ${post.authorId}` };
      },
      { database: 'postgres' }
    );
    postsWithAuthors.push({ ...post, author });
  }

  ctx.json({
    message: 'Posts with authors (N+1 pattern detected)',
    posts: postsWithAuthors,
    traceId: ctx.trace?.traceId,
  });
});

/**
 * Example 8: Optimized version (should be faster)
 */
app.get('/posts-optimized', async (ctx) => {
  // Fetch posts
  const posts = await trackDatabase(
    ctx,
    'SELECT * FROM posts LIMIT 5',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return [
        { id: 1, authorId: 10, title: 'Post 1' },
        { id: 2, authorId: 11, title: 'Post 2' },
        { id: 3, authorId: 12, title: 'Post 3' },
        { id: 4, authorId: 10, title: 'Post 4' },
        { id: 5, authorId: 13, title: 'Post 5' },
      ];
    },
    { database: 'postgres' }
  );

  // Optimized: Single query for all authors
  const authorIds = Array.from(new Set(posts.map(p => p.authorId)));
  const authors = await trackDatabase(
    ctx,
    `SELECT * FROM users WHERE id IN (${authorIds.join(',')})`,
    async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
      return authorIds.map(id => ({ id, name: `Author ${id}` }));
    },
    { database: 'postgres' }
  );

  const authorsMap = Object.fromEntries(authors.map(a => [a.id, a]));
  const postsWithAuthors = posts.map(post => ({
    ...post,
    author: authorsMap[post.authorId],
  }));

  ctx.json({
    message: 'Posts with authors (optimized)',
    posts: postsWithAuthors,
    traceId: ctx.trace?.traceId,
  });
});

// Health endpoint
app.get('/health', async (ctx) => {
  const { flowStorage } = await import('../../src/observability/flow/storage.js');
  const stats = flowStorage.getStats();

  ctx.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    flowStats: stats,
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log('');
  console.log('🌊 RamAPI Flow Visualization Demo');
  console.log('============================================================');
  console.log('');
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Demo Endpoints:');
  console.log('  GET  /simple                - Simple endpoint (minimal flow)');
  console.log('  GET  /users                 - Database queries');
  console.log('  GET  /weather?city=London   - HTTP external API call');
  console.log('  GET  /products/:id          - Cache operations');
  console.log('  GET  /dashboard?userId=123  - Complex flow (DB + HTTP + Cache)');
  console.log('  GET  /slow-report           - Slow endpoint with bottlenecks');
  console.log('  GET  /posts-with-authors    - N+1 query pattern (anti-pattern)');
  console.log('  GET  /posts-optimized       - Optimized queries');
  console.log('');
  console.log('🔍 Flow Visualization API:');
  console.log('  GET  /profile/:traceId/flow       - Flow data (JSON)');
  console.log('  GET  /profile/:traceId/waterfall  - ASCII waterfall chart');
  console.log('  GET  /profile/:traceId/mermaid    - Mermaid sequence diagram');
  console.log('  GET  /profile/:traceId?format=... - Smart format (json/waterfall/mermaid)');
  console.log('');
  console.log('  GET  /flow/slow                   - Slowest flows');
  console.log('  GET  /flow/bottlenecks            - Flows with bottlenecks');
  console.log('  GET  /flow/stats                  - Flow statistics');
  console.log('  GET  /flow/list                   - List all flows');
  console.log('');
  console.log('🎯 Try these commands:');
  console.log('');
  console.log('  # 1. Generate some traffic');
  console.log(`  curl http://localhost:${PORT}/dashboard?userId=123`);
  console.log('');
  console.log('  # 2. Copy the traceId from the response, then visualize:');
  console.log('');
  console.log('  # Get flow as JSON');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>/flow`);
  console.log('');
  console.log('  # Get ASCII waterfall (full details)');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>/waterfall`);
  console.log('');
  console.log('  # Get compact waterfall');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>/waterfall?format=compact`);
  console.log('');
  console.log('  # Get Mermaid diagram');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>/mermaid`);
  console.log('');
  console.log('  # Get Mermaid as markdown (for GitHub/docs)');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>/mermaid?markdown=true`);
  console.log('');
  console.log('  # Smart format parameter');
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>?format=waterfall`);
  console.log(`  curl http://localhost:${PORT}/profile/<TRACE_ID>?format=mermaid`);
  console.log('');
  console.log('  # 3. View statistics');
  console.log(`  curl http://localhost:${PORT}/flow/stats`);
  console.log('');
  console.log('  # 4. Find slow requests');
  console.log(`  curl http://localhost:${PORT}/flow/slow`);
  console.log('');
  console.log('  # 5. Find bottlenecks');
  console.log(`  curl http://localhost:${PORT}/flow/bottlenecks`);
  console.log('');
  console.log('💡 Examples with specific use cases:');
  console.log('');
  console.log('  # Compare N+1 vs optimized queries:');
  console.log(`  curl http://localhost:${PORT}/posts-with-authors  # Slow N+1`);
  console.log(`  curl http://localhost:${PORT}/posts-optimized     # Fast optimized`);
  console.log('  # Then compare their waterfalls!');
  console.log('');
  console.log('  # Detect slow operations:');
  console.log(`  curl http://localhost:${PORT}/slow-report`);
  console.log('  # Then check its bottlenecks in the waterfall');
  console.log('');
  console.log('  # Cache efficiency:');
  console.log(`  curl http://localhost:${PORT}/products/1  # First call (cache miss)`);
  console.log(`  curl http://localhost:${PORT}/products/1  # Second call (cache hit)`);
  console.log('  # Compare the waterfalls to see cache impact');
  console.log('');
  console.log('============================================================');
  console.log('');
});
