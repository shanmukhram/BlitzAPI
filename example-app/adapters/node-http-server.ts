/**
 * BlitzAPI Example - Node.js HTTP Adapter
 *
 * This example demonstrates using BlitzAPI with the Node.js HTTP adapter.
 * This is the default adapter with maximum ecosystem compatibility.
 *
 * Performance characteristics:
 * - ~50-100k req/s
 * - Battle-tested and stable
 * - Full Node.js ecosystem compatibility
 * - Cross-platform (no native dependencies)
 *
 * To run:
 * npm run example:adapter:node
 */

import { createApp } from '../../src/index.js';
import { z } from 'zod';
import { validate } from '../../src/middleware/index.js';

// Create app with Node.js HTTP adapter (explicitly configured)
const app = createApp({
  port: 3000,
  adapter: {
    type: 'node-http',
  },
});

// Simple route
app.get('/', (ctx) => {
  ctx.json({
    message: 'Hello from BlitzAPI with Node.js HTTP adapter!',
    adapter: 'node-http',
    features: [
      'Battle-tested',
      'Ecosystem compatible',
      'Cross-platform',
      '~50-100k req/s',
    ],
  });
});

// JSON route
app.get('/json', (ctx) => {
  ctx.json({ message: 'Simple JSON response' });
});

// Route with parameters
app.get('/users/:id', (ctx) => {
  ctx.json({
    userId: ctx.params.id,
    adapter: 'node-http',
  });
});

// Route with query parameters
app.get('/search', (ctx) => {
  ctx.json({
    query: ctx.query,
    adapter: 'node-http',
  });
});

// POST route with validation
const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

app.post('/users', validate({ body: createUserSchema }), (ctx) => {
  ctx.json({
    message: 'User created',
    user: ctx.body,
    adapter: 'node-http',
  }, 201);
});

// Route to test performance
app.get('/benchmark', (ctx) => {
  ctx.json({ message: 'Hello World', timestamp: Date.now() });
});

// Middleware example
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${ctx.method}] ${ctx.path} - ${duration}ms`);
});

// Error handling example
app.get('/error', () => {
  throw new Error('This is a test error');
});

// Start server
app.listen().then(() => {
  console.log('');
  console.log('✅ Node.js HTTP Adapter Example Running');
  console.log('');
  console.log('Try these endpoints:');
  console.log('  GET  http://localhost:3000/');
  console.log('  GET  http://localhost:3000/json');
  console.log('  GET  http://localhost:3000/users/123');
  console.log('  GET  http://localhost:3000/search?q=test');
  console.log('  POST http://localhost:3000/users');
  console.log('  GET  http://localhost:3000/benchmark');
  console.log('  GET  http://localhost:3000/error');
  console.log('');
});
