/**
 * Complete Timeline Profiling Example
 * Demonstrates all profiling stages: Routing → Validation → Auth → Handler → Serialization
 */

import { z } from 'zod';
import { createApp } from '../../src/index.js';
import { profiledMiddleware } from '../../src/observability/profiler/index.js';
import { registerProfileRoutes } from '../../src/observability/profiler/routes.js';

const app = createApp({
  observability: {
    enabled: true,
    tracing: {
      enabled: true,
      serviceName: 'complete-timeline-demo',
      exporter: 'console',
      sampleRate: 1.0,
    },
    logging: {
      enabled: true,
      level: 'info',
      format: 'pretty',
    },
    profiling: {
      enabled: true,
      captureMemory: true,
      bufferSize: 50,
      slowThreshold: 100,  // Lower threshold to see warnings
      autoDetectBottlenecks: true,
    },
  },
});

// Register profile API routes
registerProfileRoutes(app as any);

// =============================================================================
// MIDDLEWARE DEFINITIONS (wrapped for profiling)
// =============================================================================

// Validation middleware (simulates Zod validation)
const validationMiddleware = profiledMiddleware('Validation', async (ctx, next) => {
  // Simulate validation time (e.g., Zod schema validation)
  await new Promise(resolve => setTimeout(resolve, 8));

  // Simulate validation logic
  if (ctx.path.includes('/protected') && !ctx.req.headers.authorization) {
    ctx.status(401);
    ctx.json({ error: 'Missing authorization header' });
    return;
  }

  await next();
});

// Authentication middleware (simulates JWT verification)
const authMiddleware = profiledMiddleware('Authentication', async (ctx, next) => {
  // Simulate auth time (e.g., JWT verification)
  await new Promise(resolve => setTimeout(resolve, 18));

  // Simulate auth logic
  const authHeader = ctx.req.headers.authorization;
  if (authHeader) {
    // Mock user extraction
    (ctx as any).user = { id: '123', role: 'user' };
  }

  await next();
});

// Rate limiting middleware
const rateLimitMiddleware = profiledMiddleware('RateLimit', async (ctx, next) => {
  // Simulate rate limit check
  await new Promise(resolve => setTimeout(resolve, 3));
  await next();
});

// =============================================================================
// ROUTES WITH PROFILED MIDDLEWARE
// =============================================================================

// Example 1: Simple endpoint with validation only
app.get('/simple', validationMiddleware, async (ctx) => {
  await new Promise(resolve => setTimeout(resolve, 50));
  ctx.json({
    message: 'Simple endpoint',
    traceId: ctx.trace?.traceId,
  });
});

// Example 2: Protected endpoint with validation + auth
app.get('/protected', validationMiddleware, authMiddleware, async (ctx) => {
  await new Promise(resolve => setTimeout(resolve, 195));
  ctx.json({
    message: 'Protected endpoint',
    user: (ctx as any).user,
    traceId: ctx.trace?.traceId,
  });
});

// Example 3: Full stack with all middleware
app.get('/full-stack',
  validationMiddleware,
  authMiddleware,
  rateLimitMiddleware,
  async (ctx) => {
    // Simulate slow handler (should show as bottleneck)
    await new Promise(resolve => setTimeout(resolve, 195));

    ctx.json({
      message: 'Full stack endpoint',
      user: (ctx as any).user,
      traceId: ctx.trace?.traceId,
    });
  }
);

// Example 4: Fast endpoint with middleware
app.get('/fast', validationMiddleware, authMiddleware, async (ctx) => {
  await new Promise(resolve => setTimeout(resolve, 10));
  ctx.json({
    message: 'Fast endpoint',
    traceId: ctx.trace?.traceId,
  });
});

// Example 5: Slow validation scenario
const slowValidationMiddleware = profiledMiddleware('Validation (Complex)', async (ctx, next) => {
  // Simulate complex validation (nested schemas, etc.)
  await new Promise(resolve => setTimeout(resolve, 45));
  await next();
});

app.post('/complex-validation', slowValidationMiddleware, async (ctx) => {
  await new Promise(resolve => setTimeout(resolve, 30));
  ctx.json({
    message: 'Complex validation complete',
    traceId: ctx.trace?.traceId,
  });
});

// Health endpoint
app.get('/health', async (ctx) => {
  ctx.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('🎯 Complete Timeline Profiling Demo');
  console.log('============================================================');
  console.log('');
  console.log(`Server: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Test Endpoints:');
  console.log('');
  console.log('  1. Simple (Validation only)');
  console.log('     curl http://localhost:3000/simple');
  console.log('');
  console.log('  2. Protected (Validation + Auth)');
  console.log('     curl -H "Authorization: Bearer token" http://localhost:3000/protected');
  console.log('');
  console.log('  3. Full Stack (All middleware)');
  console.log('     curl -H "Authorization: Bearer token" http://localhost:3000/full-stack');
  console.log('');
  console.log('  4. Fast (Should NOT be slow)');
  console.log('     curl -H "Authorization: Bearer token" http://localhost:3000/fast');
  console.log('');
  console.log('  5. Complex Validation');
  console.log('     curl -X POST http://localhost:3000/complex-validation');
  console.log('');
  console.log('📈 View Profiles:');
  console.log('');
  console.log('  # Get specific profile (use traceId from response)');
  console.log('  curl http://localhost:3000/profile/<TRACE_ID>');
  console.log('');
  console.log('  # View slowest requests');
  console.log('  curl http://localhost:3000/profile/slow');
  console.log('');
  console.log('  # View statistics');
  console.log('  curl http://localhost:3000/profile/stats');
  console.log('');
  console.log('💡 Expected Timeline:');
  console.log('  Routing → Validation → Authentication → Handler → Serialization');
  console.log('');
  console.log('============================================================');
  console.log('');
});
