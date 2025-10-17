/**
 * Database Tracking Example
 *
 * Demonstrates:
 * - Tracking database queries
 * - Sequential vs parallel queries
 * - Query metadata and sanitization
 */

import { createApp } from '../../src/core/server.js';
import { flowTrackingMiddleware } from '../../src/observability/flow/tracker.js';
import { trackDatabase } from '../../src/observability/flow/dependencies.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import type { Context } from '../../src/core/types.js';

// Mock database for demonstration
const mockDB = {
  async query(sql: string, params?: any[]): Promise<any[]> {
    // Simulate database delay
    const delay = sql.includes('SLOW') ? 150 : 20 + Math.random() * 30;
    await new Promise(resolve => setTimeout(resolve, delay));

    // Return mock data
    if (sql.includes('users')) {
      return [{ id: 1, name: 'Alice', email: 'alice@example.com' }];
    } else if (sql.includes('posts')) {
      return [
        { id: 1, title: 'Post 1', userId: 1 },
        { id: 2, title: 'Post 2', userId: 1 },
      ];
    } else if (sql.includes('COUNT')) {
      return [{ count: 42 }];
    }
    return [];
  }
};

// Create app
const app = createApp({
  port: 3001,
  observability: {
    tracing: {
      enabled: true,
      exporter: 'console',
      serviceName: 'database-tracking-example',
    },
  },
});

app.use(flowTrackingMiddleware());
registerFlowRoutes(app as any);

// Single database query
app.get('/users/:id', async (ctx: Context) => {
  const userId = (ctx.params as any).id;

  const user = await trackDatabase(
    ctx,
    `SELECT * FROM users WHERE id = ${userId}`,
    async () => mockDB.query('SELECT * FROM users WHERE id = ?', [userId]),
    { database: 'postgres' }
  );

  ctx.json({
    user: user[0],
    traceId: ctx.trace?.traceId,
  });
});

// Multiple sequential queries
app.get('/users/:id/posts', async (ctx: Context) => {
  const userId = (ctx.params as any).id;

  // Query 1: Get user
  const users = await trackDatabase(
    ctx,
    'SELECT * FROM users WHERE id = ?',
    async () => mockDB.query('SELECT * FROM users WHERE id = ?', [userId]),
    { database: 'postgres' }
  );

  // Query 2: Get user's posts
  const posts = await trackDatabase(
    ctx,
    'SELECT * FROM posts WHERE user_id = ?',
    async () => mockDB.query('SELECT * FROM posts WHERE user_id = ?', [userId]),
    { database: 'postgres' }
  );

  // Query 3: Get post count
  const postCount = await trackDatabase(
    ctx,
    'SELECT COUNT(*) FROM posts WHERE user_id = ?',
    async () => mockDB.query('SELECT COUNT(*) FROM posts WHERE user_id = ?', [userId]),
    { database: 'postgres' }
  );

  ctx.json({
    user: users[0],
    posts,
    postCount: postCount[0].count,
    traceId: ctx.trace?.traceId,
  });
});

// Multiple parallel queries (dashboard)
app.get('/dashboard', async (ctx: Context) => {
  // Execute queries in parallel for better performance
  const [users, posts, comments] = await Promise.all([
    trackDatabase(
      ctx,
      'SELECT COUNT(*) FROM users',
      async () => mockDB.query('SELECT COUNT(*) FROM users'),
      { database: 'postgres' }
    ),
    trackDatabase(
      ctx,
      'SELECT COUNT(*) FROM posts',
      async () => mockDB.query('SELECT COUNT(*) FROM posts'),
      { database: 'postgres' }
    ),
    trackDatabase(
      ctx,
      'SELECT COUNT(*) FROM comments',
      async () => mockDB.query('SELECT COUNT(*) FROM comments'),
      { database: 'postgres' }
    ),
  ]);

  ctx.json({
    stats: {
      users: users[0].count,
      posts: posts[0].count,
      comments: comments[0].count,
    },
    traceId: ctx.trace?.traceId,
  });
});

// Slow query (demonstrates bottleneck detection)
app.get('/reports/slow', async (ctx: Context) => {
  const report = await trackDatabase(
    ctx,
    'SELECT * FROM large_table JOIN other_table WHERE complex_condition',
    async () => mockDB.query('SLOW QUERY'),
    { database: 'postgres' }
  );

  ctx.json({
    report,
    traceId: ctx.trace?.traceId,
    note: 'This query is intentionally slow (>100ms) to demonstrate bottleneck detection',
  });
});

// Query with sanitization (hides sensitive data)
app.post('/auth/login', async (ctx: Context) => {
  const { email, password } = ctx.body as any;

  const user = await trackDatabase(
    ctx,
    `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`,
    async () => mockDB.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]),
    {
      database: 'postgres',
      sanitize: true, // Replaces values with ? in visualization
    }
  );

  ctx.json({
    user: user[0] || null,
    traceId: ctx.trace?.traceId,
  });
});

// Start server
app.listen(3001);

console.log('\n🗄️  Database Tracking Example running on http://localhost:3001\n');
console.log('Try these endpoints:');
console.log('  GET  /users/1              - Single query');
console.log('  GET  /users/1/posts        - Multiple sequential queries');
console.log('  GET  /dashboard            - Multiple parallel queries');
console.log('  GET  /reports/slow         - Slow query (bottleneck)');
console.log('  POST /auth/login           - Query with sanitization');
console.log('\nView flow visualizations:');
console.log('  GET  /profile/{traceId}/waterfall');
console.log('  GET  /flow/stats\n');
console.log('Example:');
console.log('  curl http://localhost:3001/users/1');
console.log('  # Copy the traceId from response');
console.log('  curl http://localhost:3001/profile/{traceId}/waterfall\n');
