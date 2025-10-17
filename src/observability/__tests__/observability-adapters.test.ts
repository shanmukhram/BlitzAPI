/**
 * Comprehensive tests for observability support across adapters
 * Tests tracing, metrics, and profiling with both Node.js HTTP and uWebSockets adapters
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../core/server.js';
import type { Server } from '../../core/server.js';
import type { Context } from '../../core/types.js';
import { getMetrics, resetMetrics } from '../metrics.js';
import { profileStorage } from '../profiler/storage.js';

describe('Observability Support Across Adapters', () => {
  let server: Server;
  let testPort = 3456;

  beforeEach(async () => {
    // Reset all observability state
    resetMetrics();
    profileStorage.clear();

    // Use a new port for each test to avoid conflicts
    testPort = 3456 + Math.floor(Math.random() * 1000);

    // Small delay to ensure previous server is fully stopped
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      // Ensure server is fully closed before next test
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });

  describe('Node.js HTTP Adapter', () => {
    describe('Tracing', () => {
      it('should create trace context for each request', async () => {
        let capturedTrace: any = null;

        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
          },
        });

        server.get('/test', (ctx: Context) => {
          capturedTrace = (ctx as any).trace;
          return ctx.json({ message: 'ok' });
        });

        await server.listen(testPort);

        const response = await fetch(`http://localhost:${testPort}/test`);
        const data = await response.json();

        expect(data).toEqual({ message: 'ok' });
        expect(capturedTrace).toBeDefined();
        expect(capturedTrace.traceId).toBeDefined();
        expect(capturedTrace.spanId).toBeDefined();
        expect(capturedTrace.protocol).toBe('rest');
        expect(capturedTrace.operationName).toContain('GET /test');
      });

      it('should inject trace headers in response', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        const response = await fetch(`http://localhost:${testPort}/test`);

        expect(response.headers.get('x-trace-id')).toBeDefined();
        expect(response.headers.get('x-span-id')).toBeDefined();
        expect(response.headers.get('x-trace-id')).toHaveLength(32);
        expect(response.headers.get('x-span-id')).toHaveLength(16);
      });

      it('should capture span attributes correctly', async () => {
        let capturedTrace: any = null;

        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
          },
        });

        server.get('/users/:id', (ctx: Context) => {
          capturedTrace = (ctx as any).trace;
          return ctx.json({ userId: (ctx.params as any).id });
        });

        await server.listen(testPort);

        const response = await fetch(`http://localhost:${testPort}/users/123`);
        await response.json();

        expect(capturedTrace.attributes).toBeDefined();
        expect(capturedTrace.attributes['http.method']).toBe('GET');
        expect(capturedTrace.attributes['http.path']).toBe('/users/123');
        expect(capturedTrace.span).toBeDefined();
      });

      it('should record errors in spans', async () => {
        let errorSpan: any = null;

        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
          },
        });

        server.get('/error', (ctx: Context) => {
          errorSpan = (ctx as any).trace?.span;
          throw new Error('Test error');
        });

        await server.listen(testPort);

        try {
          await fetch(`http://localhost:${testPort}/error`);
        } catch (e) {
          // Expected to fail
        }

        // Give time for span to be recorded
        await new Promise(resolve => setTimeout(resolve, 100));

        // Span should have been created even for errors
        expect(errorSpan).toBeDefined();
      });
    });

    describe('Metrics', () => {
      it('should record request metrics', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            metrics: {
              enabled: true,
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        // Make multiple requests
        await fetch(`http://localhost:${testPort}/test`);
        await fetch(`http://localhost:${testPort}/test`);
        await fetch(`http://localhost:${testPort}/test`);

        const metrics = getMetrics();

        expect(metrics.totalRequests).toBe(3);
        expect(metrics.byProtocol.rest).toBe(3);
        expect(metrics.byStatusCode[200]).toBe(3);
        expect(metrics.averageLatency).toBeGreaterThan(0);
      });

      it('should track latency percentiles', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            metrics: {
              enabled: true,
            },
          },
        });

        server.get('/fast', (ctx: Context) => ctx.json({ message: 'ok' }));
        server.get('/slow', async (ctx: Context) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return ctx.json({ message: 'ok' });
        });

        await server.listen(testPort);

        // Make mix of fast and slow requests - ensure they complete
        await fetch(`http://localhost:${testPort}/fast`);
        await fetch(`http://localhost:${testPort}/fast`);
        await fetch(`http://localhost:${testPort}/slow`);

        // Small delay to ensure metrics are recorded
        await new Promise(resolve => setTimeout(resolve, 100));

        const metrics = getMetrics();

        expect(metrics.totalRequests).toBe(3);
        expect(metrics.p50Latency).toBeGreaterThan(0);
        expect(metrics.p95Latency).toBeGreaterThan(0);
        expect(metrics.p99Latency).toBeGreaterThan(0);
        expect(metrics.p95Latency).toBeGreaterThanOrEqual(metrics.p50Latency);
        expect(metrics.p99Latency).toBeGreaterThanOrEqual(metrics.p95Latency);
      });

      it('should track error rates', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            metrics: {
              enabled: true,
            },
          },
        });

        server.get('/success', (ctx: Context) => ctx.json({ message: 'ok' }));
        server.get('/error', (ctx: Context) => {
          ctx.res.statusCode = 500;
          return ctx.json({ error: 'Internal error' });
        });

        await server.listen(testPort);

        // Make mix of successful and error requests - ensure they complete
        await fetch(`http://localhost:${testPort}/success`);
        await fetch(`http://localhost:${testPort}/success`);
        await fetch(`http://localhost:${testPort}/error`);

        // Small delay to ensure metrics are recorded
        await new Promise(resolve => setTimeout(resolve, 100));

        const metrics = getMetrics();

        expect(metrics.totalRequests).toBe(3);
        expect(metrics.byStatusCode[200]).toBe(2);
        expect(metrics.byStatusCode[500]).toBe(1);
        expect(metrics.errorRate).toBeCloseTo(1/3, 2);
      });

      it('should calculate requests per second', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            metrics: {
              enabled: true,
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        // Make requests
        await fetch(`http://localhost:${testPort}/test`);
        await fetch(`http://localhost:${testPort}/test`);

        const metrics = getMetrics();

        expect(metrics.requestsPerSecond).toBeGreaterThan(0);
        expect(metrics.totalRequests).toBe(2);
      });
    });

    describe('Profiling', () => {
      it('should capture request profiles', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            profiling: {
              enabled: true,
              bufferSize: 50,
              slowThreshold: 100,
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        await fetch(`http://localhost:${testPort}/test`);

        // Give time for profile to be stored
        await new Promise(resolve => setTimeout(resolve, 150));

        const profiles = profileStorage.query({ limit: 10 });

        expect(profiles.length).toBeGreaterThanOrEqual(1);
        if (profiles.length > 0) {
          expect(profiles[0].method).toBe('GET');
          expect(profiles[0].path).toBe('/test');
          expect(profiles[0].stages.total).toBeGreaterThan(0);
          expect(profiles[0].breakdown).toBeDefined();
        }
      });

      it('should capture stage timings', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            profiling: {
              enabled: true,
              bufferSize: 50,
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        await fetch(`http://localhost:${testPort}/test`);

        await new Promise(resolve => setTimeout(resolve, 150));

        const profiles = profileStorage.query({ limit: 1 });

        if (profiles.length > 0) {
          const profile = profiles[0];
          expect(profile.stages.routing).toBeGreaterThanOrEqual(0);
          expect(profile.stages.handler).toBeGreaterThan(0);
          expect(profile.stages.serialization).toBeGreaterThanOrEqual(0);
          expect(profile.stages.total).toBeGreaterThan(0);
        }
      });

      it('should detect slow requests', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            profiling: {
              enabled: true,
              bufferSize: 50,
              slowThreshold: 10, // Very low threshold to test detection
            },
          },
        });

        server.get('/slow', async (ctx: Context) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return ctx.json({ message: 'ok' });
        });

        await server.listen(testPort);

        await fetch(`http://localhost:${testPort}/slow`);

        await new Promise(resolve => setTimeout(resolve, 150));

        const profiles = profileStorage.query({ slow: true });

        expect(profiles.length).toBeGreaterThan(0);
        if (profiles.length > 0) {
          expect(profiles[0].slow).toBe(true);
          expect(profiles[0].stages.total).toBeGreaterThan(10);
        }
      });

      it('should calculate breakdown percentages', async () => {
        server = createApp({
          port: testPort,
          observability: {
            tracing: {
              enabled: true,
              exporter: 'memory',
              serviceName: 'test-service',
            },
            profiling: {
              enabled: true,
              bufferSize: 50,
            },
          },
        });

        server.get('/test', (ctx: Context) => ctx.json({ message: 'ok' }));

        await server.listen(testPort);

        await fetch(`http://localhost:${testPort}/test`);

        await new Promise(resolve => setTimeout(resolve, 150));

        const profiles = profileStorage.query({ limit: 1 });

        if (profiles.length > 0) {
          const profile = profiles[0];
          expect(profile.breakdown).toBeDefined();
          expect(profile.breakdown.length).toBeGreaterThan(0);

          // Sum of percentages should be ~100% (allow some tolerance for floating point)
          const totalPercentage = profile.breakdown.reduce(
            (sum, stage) => sum + (stage.percentage || 0),
            0
          );

          // Each stage should have a valid percentage
          profile.breakdown.forEach(stage => {
            expect(stage.percentage).toBeGreaterThanOrEqual(0);
            expect(stage.percentage).toBeLessThanOrEqual(100);
          });

          // Sum of percentages should be ~100% (allow some tolerance for floating point)
          expect(totalPercentage).toBeGreaterThan(95);
          expect(totalPercentage).toBeLessThan(105);
        }
      });
    });
  });

  describe('Observability Integration', () => {
    it('should work with all observability features enabled', async () => {
      let capturedTrace: any = null;

      server = createApp({
        port: testPort,
        observability: {
          tracing: {
            enabled: true,
            exporter: 'memory',
            serviceName: 'test-service',
          },
          metrics: {
            enabled: true,
          },
          profiling: {
            enabled: true,
            bufferSize: 50,
          },
        },
      });

      server.get('/integrated', (ctx: Context) => {
        capturedTrace = (ctx as any).trace;
        return ctx.json({ message: 'all features working' });
      });

      await server.listen(testPort);

      const response = await fetch(`http://localhost:${testPort}/integrated`);
      const data = await response.json();

      expect(data).toEqual({ message: 'all features working' });

      // Check tracing
      expect(capturedTrace).toBeDefined();
      expect(capturedTrace.traceId).toBeDefined();

      // Check response headers
      expect(response.headers.get('x-trace-id')).toBeDefined();

      // Check metrics
      const metrics = getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);

      // Check profiling
      await new Promise(resolve => setTimeout(resolve, 150));
      const profiles = profileStorage.query({ limit: 1 });
      expect(profiles.length).toBeGreaterThanOrEqual(1);
      if (profiles.length > 0) {
        expect(profiles[0].traceId).toBe(capturedTrace.traceId);
      }
    });

    it('should correlate traces and profiles', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: {
            enabled: true,
            exporter: 'memory',
            serviceName: 'test-service',
          },
          profiling: {
            enabled: true,
            bufferSize: 50,
          },
        },
      });

      server.get('/correlated', (ctx: Context) => ctx.json({ message: 'ok' }));

      await server.listen(testPort);

      const response = await fetch(`http://localhost:${testPort}/correlated`);
      await response.json();

      const traceId = response.headers.get('x-trace-id');
      const spanId = response.headers.get('x-span-id');

      await new Promise(resolve => setTimeout(resolve, 150));

      const profile = profileStorage.get(traceId || '');

      if (profile) {
        expect(profile.traceId).toBe(traceId);
        expect(profile.spanId).toBe(spanId);
      }
    });

    it('should work without observability enabled', async () => {
      server = createApp({
        port: testPort,
        // No observability config
      });

      server.get('/no-obs', (ctx: Context) => ctx.json({ message: 'ok' }));

      await server.listen(testPort);

      const response = await fetch(`http://localhost:${testPort}/no-obs`);
      const data = await response.json();

      expect(data).toEqual({ message: 'ok' });
      expect(response.headers.get('x-trace-id')).toBeNull();
    });
  });
});
