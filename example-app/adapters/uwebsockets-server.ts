/**
 * BlitzAPI Example - uWebSockets.js Adapter
 *
 * This example demonstrates using BlitzAPI with the uWebSockets.js adapter
 * for ultra-high performance (2-3x faster than Node.js http).
 *
 * Performance characteristics:
 * - ~200-400k req/s (2-3x faster than Node.js)
 * - Lower memory usage
 * - Better latency under load
 * - HTTP/1.1 and HTTP/2 support
 *
 * Requirements:
 * - npm install uWebSockets.js
 * - Native C++ dependencies (platform-specific)
 *
 * To run:
 * npm run example:adapter:uws
 */

import { createApp } from '../../src/index.js';
import { z } from 'zod';
import { validate } from '../../src/middleware/index.js';

// Create app with uWebSockets.js adapter
const app = createApp({
  port: 3001,
  adapter: {
    type: 'uwebsockets',
    // Optional: SSL configuration
    // options: {
    //   ssl: {
    //     key_file_name: 'key.pem',
    //     cert_file_name: 'cert.pem'
    //   }
    // }
  },
});

// Simple route
app.get('/', (ctx) => {
  ctx.json({
    message: 'Hello from BlitzAPI with uWebSockets.js adapter!',
    adapter: 'uwebsockets',
    features: [
      'Ultra-fast (2-3x Node.js)',
      'Lower memory usage',
      'HTTP/2 support',
      '~200-400k req/s',
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
    adapter: 'uwebsockets',
  });
});

// Route with query parameters
app.get('/search', (ctx) => {
  ctx.json({
    query: ctx.query,
    adapter: 'uwebsockets',
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
    adapter: 'uwebsockets',
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

// Performance comparison endpoint
app.get('/perf', (ctx) => {
  ctx.json({
    adapter: 'uwebsockets',
    performance: {
      expectedReqPerSec: '200-400k',
      vsNodeHttp: '2-3x faster',
      memoryUsage: 'Lower',
      latency: 'Better under load',
    },
  });
});

// Start server
app.listen().then(() => {
  console.log('');
  console.log('🚀 uWebSockets.js Adapter Example Running');
  console.log('');
  console.log('Try these endpoints:');
  console.log('  GET  http://localhost:3001/');
  console.log('  GET  http://localhost:3001/json');
  console.log('  GET  http://localhost:3001/users/123');
  console.log('  GET  http://localhost:3001/search?q=test');
  console.log('  POST http://localhost:3001/users');
  console.log('  GET  http://localhost:3001/benchmark');
  console.log('  GET  http://localhost:3001/perf');
  console.log('  GET  http://localhost:3001/error');
  console.log('');
  console.log('💡 Tip: Use benchmark tools (wrk, autocannon) to see performance difference');
  console.log('');
}).catch((err) => {
  console.error('Failed to start server:', err.message);
  console.log('');
  console.log('⚠️  uWebSockets.js not installed or failed to load.');
  console.log('   Install with: npm install uWebSockets.js');
  console.log('');
  process.exit(1);
});
