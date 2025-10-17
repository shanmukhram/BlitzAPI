/**
 * HTTP Call Tracking Example
 *
 * Demonstrates:
 * - Tracking external API calls
 * - Sequential vs parallel HTTP requests
 * - Error handling in tracked calls
 */

import { createApp } from '../../src/core/server.js';
import { flowTrackingMiddleware } from '../../src/observability/flow/tracker.js';
import { trackHTTP } from '../../src/observability/flow/dependencies.js';
import { registerFlowRoutes } from '../../src/observability/flow/routes.js';
import type { Context } from '../../src/core/types.js';

// Mock external API calls
const mockAPI = {
  async getUserProfile(userId: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    return { id: userId, name: 'Alice', avatar: 'https://example.com/avatar.jpg' };
  },

  async getWeather(city: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 40));
    return { city, temp: 72, condition: 'Sunny' };
  },

  async getExchangeRate(from: string, to: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
    return { from, to, rate: 1.23 };
  },

  async slowAPI(): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { data: 'slow response' };
  },
};

// Create app
const app = createApp({
  port: 3002,
  observability: {
    tracing: {
      enabled: true,
      exporter: 'console',
      serviceName: 'http-tracking-example',
    },
  },
});

app.use(flowTrackingMiddleware());
registerFlowRoutes(app as any);

// Single HTTP call
app.get('/profile/:userId', async (ctx: Context) => {
  const userId = (ctx.params as any).userId;
  const profile = await trackHTTP(
    ctx,
    'GET',
    `https://api.example.com/users/${userId}`,
    async () => mockAPI.getUserProfile(userId)
  );

  ctx.json({
    profile,
    traceId: ctx.trace?.traceId,
  });
});

// Multiple sequential HTTP calls
app.get('/user-dashboard/:userId', async (ctx: Context) => {
  const userId = (ctx.params as any).userId;
  // Call 1: Get user profile
  const profile = await trackHTTP(
    ctx,
    'GET',
    `https://api.users.com/profile/${userId}`,
    async () => mockAPI.getUserProfile(userId)
  );

  // Call 2: Get weather for user's city
  const weather = await trackHTTP(
    ctx,
    'GET',
    'https://api.weather.com/current?city=NewYork',
    async () => mockAPI.getWeather('NewYork')
  );

  // Call 3: Get exchange rate
  const exchangeRate = await trackHTTP(
    ctx,
    'GET',
    'https://api.exchange.com/rates?from=USD&to=EUR',
    async () => mockAPI.getExchangeRate('USD', 'EUR')
  );

  ctx.json({
    profile,
    weather,
    exchangeRate,
    traceId: ctx.trace?.traceId,
  });
});

// Multiple parallel HTTP calls (faster)
app.get('/aggregate/:userId', async (ctx: Context) => {
  const userId = (ctx.params as any).userId;
  // Execute all HTTP calls in parallel
  const [profile, weather, exchangeRate] = await Promise.all([
    trackHTTP(
      ctx,
      'GET',
      `https://api.users.com/profile/${userId}`,
      async () => mockAPI.getUserProfile(userId)
    ),
    trackHTTP(
      ctx,
      'GET',
      'https://api.weather.com/current?city=NewYork',
      async () => mockAPI.getWeather('NewYork')
    ),
    trackHTTP(
      ctx,
      'GET',
      'https://api.exchange.com/rates?from=USD&to=EUR',
      async () => mockAPI.getExchangeRate('USD', 'EUR')
    ),
  ]);

  ctx.json({
    profile,
    weather,
    exchangeRate,
    traceId: ctx.trace?.traceId,
    note: 'These HTTP calls were made in parallel for better performance',
  });
});

// Slow HTTP call (bottleneck)
app.get('/slow-api', async (ctx: Context) => {
  const data = await trackHTTP(
    ctx,
    'GET',
    'https://slow-api.example.com/data',
    async () => mockAPI.slowAPI()
  );

  ctx.json({
    data,
    traceId: ctx.trace?.traceId,
    note: 'This API call is intentionally slow (>100ms) to demonstrate bottleneck detection',
  });
});

// HTTP call with error handling
app.get('/api-with-error', async (ctx: Context) => {
  try {
    const data = await trackHTTP(
      ctx,
      'GET',
      'https://api.example.com/might-fail',
      async () => {
        // Simulate API error
        if (Math.random() > 0.5) {
          throw new Error('API returned 500 Internal Server Error');
        }
        return mockAPI.getUserProfile('123');
      }
    );

    ctx.json({ data, traceId: ctx.trace?.traceId });
  } catch (error) {
    ctx.json({
      error: 'API call failed',
      message: (error as Error).message,
      traceId: ctx.trace?.traceId,
      note: 'Check the flow visualization to see the failed HTTP call',
    }, 500);
  }
});

// POST request with body
app.post('/create-user', async (ctx: Context) => {
  const userData = ctx.body as any;

  const result = await trackHTTP(
    ctx,
    'POST',
    'https://api.users.com/users',
    async () => {
      // Simulate POST request
      await new Promise(resolve => setTimeout(resolve, 75));
      return { id: '123', ...userData };
    }
  );

  ctx.json({
    result,
    traceId: ctx.trace?.traceId,
  });
});

// Start server
app.listen(3002);

console.log('\n🌐 HTTP Tracking Example running on http://localhost:3002\n');
console.log('Try these endpoints:');
console.log('  GET  /profile/123          - Single HTTP call');
console.log('  GET  /user-dashboard/123   - Multiple sequential HTTP calls');
console.log('  GET  /aggregate/123        - Multiple parallel HTTP calls (faster)');
console.log('  GET  /slow-api             - Slow HTTP call (bottleneck)');
console.log('  GET  /api-with-error       - HTTP call with potential error');
console.log('  POST /create-user          - POST request');
console.log('\nView flow visualizations:');
console.log('  GET  /profile/{traceId}/waterfall');
console.log('  GET  /profile/{traceId}/mermaid\n');
console.log('Example:');
console.log('  curl http://localhost:3002/aggregate/123');
console.log('  # Copy the traceId from response');
console.log('  curl http://localhost:3002/profile/{traceId}/waterfall\n');
console.log('Compare sequential vs parallel:');
console.log('  curl http://localhost:3002/user-dashboard/123  # Slower (sequential)');
console.log('  curl http://localhost:3002/aggregate/123       # Faster (parallel)\n');
