/**
 * Flow Visualization Tests - Phase 3.6
 * Comprehensive tests for request flow tracking and visualization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../../core/server.js';
import type { Server } from '../../../core/server.js';
import type { Context } from '../../../core/types.js';
import { flowTrackingMiddleware } from '../tracker.js';
import { trackDatabase, trackHTTP, trackCache } from '../dependencies.js';
import { flowStorage, configureStorage } from '../storage.js';
import { generateWaterfall, generateCompactWaterfall } from '../exporters/waterfall.js';
import { generateMermaidDiagram, generateCompactMermaidDiagram, generateMarkdownDiagram } from '../exporters/mermaid.js';
import { registerFlowRoutes } from '../routes.js';

describe('Flow Visualization - Phase 3.6', () => {
  let server: Server;
  let testPort = 3456;

  beforeEach(async () => {
    flowStorage.clear();
    configureStorage({ flowMaxSize: 100 });
    testPort = 3456 + Math.floor(Math.random() * 1000);
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    flowStorage.clear();
  });

  describe('Flow Event Capture', () => {
    it('should capture lifecycle events (routing, handler, response)', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/lifecycle', (ctx: Context) => ctx.json({ ok: true }));

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/lifecycle`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/lifecycle');

      expect(flow).toBeDefined();
      expect(flow!.events.length).toBeGreaterThan(0);

      const eventNames = flow!.events.map(e => e.name);
      expect(eventNames).toContain('Request Started');
      expect(eventNames).toContain('Routing');
      expect(eventNames).toContain('Response Serialization');
    });

    it('should track event durations correctly', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/duration', async (ctx: Context) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/duration`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/duration');

      expect(flow).toBeDefined();
      expect(flow!.stats.totalDuration).toBeGreaterThan(50);

      // Check that all completed events have duration
      const completedEvents = flow!.events.filter(e => e.status === 'completed');
      completedEvents.forEach(event => {
        expect(event.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should capture request metadata (method, path, traceId)', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/metadata', (ctx: Context) => ctx.json({ ok: true }));

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/metadata`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/metadata');

      expect(flow).toBeDefined();
      expect(flow!.method).toBe('GET');
      expect(flow!.path).toBe('/metadata');
      expect(flow!.traceId).toBeDefined();
      expect(flow!.traceId).toHaveLength(32);
    });

    it('should calculate performance statistics (routing, handler, response percentages)', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/stats', async (ctx: Context) => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/stats`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/stats');

      expect(flow).toBeDefined();
      expect(flow!.stats.routingDuration).toBeGreaterThanOrEqual(0);
      expect(flow!.stats.handlerDuration).toBeGreaterThan(0);
      expect(flow!.stats.responseDuration).toBeGreaterThanOrEqual(0);
      expect(flow!.stats.routingPercentage).toBeGreaterThanOrEqual(0);
      expect(flow!.stats.handlerPercentage).toBeGreaterThan(0);
      expect(flow!.stats.responsePercentage).toBeGreaterThanOrEqual(0);

      // Percentages should roughly add up to 100
      const totalPercentage = flow!.stats.routingPercentage +
                              flow!.stats.handlerPercentage +
                              flow!.stats.responsePercentage;
      expect(totalPercentage).toBeGreaterThan(99);
      expect(totalPercentage).toBeLessThan(101);
    });

    it('should detect slow requests based on threshold', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/slow', async (ctx: Context) => {
        await new Promise(resolve => setTimeout(resolve, 1100)); // Over 1000ms threshold
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/slow`);
      await new Promise(resolve => setTimeout(resolve, 200));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/slow');

      expect(flow).toBeDefined();
      expect(flow!.slow).toBe(true);
      expect(flow!.stats.totalDuration).toBeGreaterThan(1000);
    });
  });

  describe('Dependency Tracking', () => {
    it('should track database query with duration and metadata', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/db-detailed', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT * FROM users WHERE id = ?', async () => {
          await new Promise(r => setTimeout(r, 35));
          return [];
        }, { database: 'postgres', sanitize: true });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/db-detailed`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/db-detailed');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.database.length).toBe(1);

      const dbCall = flow!.dependencies.database[0];
      expect(dbCall.query).toContain('SELECT * FROM users');
      expect(dbCall.duration).toBeGreaterThan(30);
      expect(dbCall.database).toBe('postgres');
      expect(dbCall.startTime).toBeGreaterThan(0);
      expect(dbCall.endTime).toBeGreaterThan(dbCall.startTime);
    });

    it('should track multiple database queries in sequence', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/multi-db', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT * FROM users', async () => {
          await new Promise(r => setTimeout(r, 20));
          return [];
        }, { database: 'postgres' });

        await trackDatabase(ctx, 'SELECT * FROM posts', async () => {
          await new Promise(r => setTimeout(r, 15));
          return [];
        }, { database: 'postgres' });

        await trackDatabase(ctx, 'SELECT * FROM comments', async () => {
          await new Promise(r => setTimeout(r, 10));
          return [];
        }, { database: 'postgres' });

        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/multi-db`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/multi-db');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.database.length).toBe(3);
      expect(flow!.stats.databaseCalls).toBe(3);
      expect(flow!.stats.totalDatabaseTime).toBeGreaterThan(40);

      // Verify queries are in order
      expect(flow!.dependencies.database[0].query).toContain('users');
      expect(flow!.dependencies.database[1].query).toContain('posts');
      expect(flow!.dependencies.database[2].query).toContain('comments');
    });

    it('should track HTTP call with method, URL, and status code', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/http-detailed', async (ctx: Context) => {
        await trackHTTP(ctx, 'POST', 'https://api.example.com/users', async () => {
          await new Promise(r => setTimeout(r, 45));
          return { id: 123, name: 'Test User' };
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/http-detailed`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/http-detailed');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.http.length).toBe(1);

      const httpCall = flow!.dependencies.http[0];
      expect(httpCall.method).toBe('POST');
      expect(httpCall.url).toContain('api.example.com/users');
      expect(httpCall.duration).toBeGreaterThan(40);
      expect(httpCall.startTime).toBeGreaterThan(0);
      expect(httpCall.endTime).toBeGreaterThan(httpCall.startTime);
    });

    it('should track multiple HTTP calls in parallel', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/parallel-http', async (ctx: Context) => {
        await Promise.all([
          trackHTTP(ctx, 'GET', 'https://api1.example.com', async () => {
            await new Promise(r => setTimeout(r, 30));
            return { data: 1 };
          }),
          trackHTTP(ctx, 'GET', 'https://api2.example.com', async () => {
            await new Promise(r => setTimeout(r, 25));
            return { data: 2 };
          }),
          trackHTTP(ctx, 'GET', 'https://api3.example.com', async () => {
            await new Promise(r => setTimeout(r, 35));
            return { data: 3 };
          }),
        ]);
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/parallel-http`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/parallel-http');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.http.length).toBe(3);
      expect(flow!.stats.httpCalls).toBe(3);
    });

    it('should track cache operations with hit/miss status', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/cache-detailed', async (ctx: Context) => {
        // Cache miss
        const cached = await trackCache(ctx, 'get', 'user:123', async () => {
          await new Promise(r => setTimeout(r, 5));
          return null;
        });

        // Cache set
        await trackCache(ctx, 'set', 'user:123', async () => {
          await new Promise(r => setTimeout(r, 3));
          return 'OK';
        }, { ttl: 600, captureSize: true });

        // Cache delete
        await trackCache(ctx, 'delete', 'old:key', async () => {
          await new Promise(r => setTimeout(r, 2));
          return 'OK';
        });

        return ctx.json({ cached });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/cache-detailed`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/cache-detailed');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.cache.length).toBe(3);

      const cacheGet = flow!.dependencies.cache[0];
      expect(cacheGet.operation).toBe('get');
      expect(cacheGet.key).toBe('user:123');
      expect(cacheGet.hit).toBe(false);

      const cacheSet = flow!.dependencies.cache[1];
      expect(cacheSet.operation).toBe('set');
      expect(cacheSet.ttl).toBe(600);

      const cacheDelete = flow!.dependencies.cache[2];
      expect(cacheDelete.operation).toBe('delete');
    });

    it('should track mixed dependencies (DB + HTTP + Cache)', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mixed', async (ctx: Context) => {
        // Check cache
        await trackCache(ctx, 'get', 'user:1', async () => null);

        // Query database
        await trackDatabase(ctx, 'SELECT * FROM users WHERE id = 1', async () => {
          await new Promise(r => setTimeout(r, 25));
          return [{ id: 1, name: 'User' }];
        }, { database: 'mysql' });

        // Call external API
        await trackHTTP(ctx, 'GET', 'https://api.example.com/user/1/profile', async () => {
          await new Promise(r => setTimeout(r, 30));
          return { avatar: 'url' };
        });

        // Store in cache
        await trackCache(ctx, 'set', 'user:1', async () => 'OK', { ttl: 300 });

        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mixed`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mixed');

      expect(flow).toBeDefined();
      expect(flow!.dependencies.database.length).toBe(1);
      expect(flow!.dependencies.http.length).toBe(1);
      expect(flow!.dependencies.cache.length).toBe(2);
      expect(flow!.stats.totalDatabaseTime).toBeGreaterThan(20);
      expect(flow!.stats.totalHTTPTime).toBeGreaterThan(25);
      expect(flow!.stats.totalCacheTime).toBeGreaterThan(0);
    });

    it('should detect bottlenecks in slow operations', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/bottleneck', async (ctx: Context) => {
        // Slow database query (bottleneck)
        await trackDatabase(ctx, 'SELECT * FROM large_table', async () => {
          await new Promise(r => setTimeout(r, 150)); // > 100ms threshold
          return [];
        }, { database: 'postgres' });

        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/bottleneck`);
      await new Promise(resolve => setTimeout(resolve, 200));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/bottleneck');

      expect(flow).toBeDefined();
      expect(flow!.bottlenecks.length).toBeGreaterThan(0);
      // Bottleneck format: "DB: SELECT * FROM large_table... (150.XXms)"
      const bottleneckStr = flow!.bottlenecks.join(' ');
      expect(bottleneckStr).toContain('DB:');
    });
  });

  describe('Waterfall Generation', () => {
    it('should generate complete waterfall with all sections', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/waterfall', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT * FROM users', async () => {
          await new Promise(r => setTimeout(r, 25));
          return [];
        }, { database: 'postgres' });

        await trackHTTP(ctx, 'GET', 'https://api.example.com/data', async () => {
          await new Promise(r => setTimeout(r, 35));
          return {};
        });

        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/waterfall`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/waterfall');
      expect(flow).toBeDefined();

      const waterfall = generateWaterfall(flow!);

      // Check header section
      expect(waterfall).toContain('Request Flow Timeline');
      expect(waterfall).toContain('Trace ID:');
      expect(waterfall).toContain(flow!.traceId);
      expect(waterfall).toContain('Request:');
      expect(waterfall).toContain('GET /waterfall');

      // Check timeline section
      expect(waterfall).toContain('Timeline:');
      expect(waterfall).toContain('0ms');

      // Check dependencies section
      expect(waterfall).toContain('Dependencies:');
      expect(waterfall).toContain('Database Queries:');
      expect(waterfall).toContain('HTTP Calls:');
      expect(waterfall).toContain('SELECT * FROM users');
      expect(waterfall).toContain('api.example.com');
    });

    it('should generate compact waterfall format', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/compact', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT 1', async () => {
          await new Promise(r => setTimeout(r, 15));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/compact`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/compact');
      expect(flow).toBeDefined();

      const waterfall = generateCompactWaterfall(flow!);

      expect(waterfall).toContain('GET /compact');
      expect(waterfall.length).toBeGreaterThan(0);
      // Compact version should be shorter
      expect(waterfall.length).toBeLessThan(500);
    });

    it('should show bottlenecks in waterfall', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/slow-waterfall', async (ctx: Context) => {
        await trackDatabase(ctx, 'SLOW QUERY', async () => {
          await new Promise(r => setTimeout(r, 150));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/slow-waterfall`);
      await new Promise(resolve => setTimeout(resolve, 200));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/slow-waterfall');
      expect(flow).toBeDefined();

      const waterfall = generateWaterfall(flow!);

      expect(waterfall).toContain('Bottlenecks Detected');
      expect(waterfall).toContain('SLOW QUERY');
    });

    it('should show cache hit rate in waterfall', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/cache-waterfall', async (ctx: Context) => {
        await trackCache(ctx, 'get', 'key1', async () => null); // miss
        await trackCache(ctx, 'get', 'key2', async () => null); // miss
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/cache-waterfall`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/cache-waterfall');
      expect(flow).toBeDefined();

      const waterfall = generateWaterfall(flow!);

      expect(waterfall).toContain('Cache Operations:');
      expect(waterfall).toContain('Hit Rate:');
    });
  });

  describe('Mermaid Diagram Generation', () => {
    it('should generate complete mermaid sequence diagram', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mermaid-full', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT * FROM users', async () => {
          await new Promise(r => setTimeout(r, 20));
          return [];
        }, { database: 'postgres' });

        await trackHTTP(ctx, 'POST', 'https://api.example.com/notify', async () => {
          await new Promise(r => setTimeout(r, 30));
          return { sent: true };
        });

        await trackCache(ctx, 'set', 'result', async () => 'OK', { ttl: 300 });

        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mermaid-full`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mermaid-full');
      expect(flow).toBeDefined();

      const diagram = generateMermaidDiagram(flow!);

      // Check diagram structure
      expect(diagram).toContain('sequenceDiagram');
      expect(diagram).toContain('participant Client');
      expect(diagram).toContain('participant API');
      expect(diagram).toContain('participant Database');
      expect(diagram).toContain('participant External');
      expect(diagram).toContain('participant Cache');

      // Check database interaction
      expect(diagram).toContain('API->>+Database:');
      expect(diagram).toContain('Database-->>-API:');
      expect(diagram).toContain('SELECT');

      // Check HTTP interaction
      expect(diagram).toContain('API->>+External:');
      expect(diagram).toContain('External-->>-API:');
      expect(diagram).toContain('POST');

      // Check cache interaction
      expect(diagram).toContain('API->>+Cache:');
      expect(diagram).toContain('Cache-->>-API:');
      expect(diagram).toContain('SET');
    });

    it('should include timing annotations in diagram', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mermaid-timing', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT 1', async () => {
          await new Promise(r => setTimeout(r, 25));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mermaid-timing`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mermaid-timing');
      expect(flow).toBeDefined();

      const diagram = generateMermaidDiagram(flow!, { includeTimings: true });

      expect(diagram).toContain('ms)'); // Should contain timing info
      expect(diagram).toContain('Duration:');
      expect(diagram).toContain('Total:');
    });

    it('should generate compact mermaid diagram', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mermaid-compact', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT 1', async () => {
          await new Promise(r => setTimeout(r, 20));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mermaid-compact`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mermaid-compact');
      expect(flow).toBeDefined();

      const compactDiagram = generateCompactMermaidDiagram(flow!);
      const fullDiagram = generateMermaidDiagram(flow!);

      expect(compactDiagram).toContain('sequenceDiagram');
      expect(compactDiagram.length).toBeLessThan(fullDiagram.length);
    });

    it('should generate markdown-wrapped diagram', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mermaid-md', async (ctx: Context) => {
        await trackDatabase(ctx, 'SELECT 1', async () => {
          await new Promise(r => setTimeout(r, 20));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mermaid-md`);
      await new Promise(resolve => setTimeout(resolve, 100));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mermaid-md');
      expect(flow).toBeDefined();

      const markdown = generateMarkdownDiagram(flow!);

      expect(markdown).toContain('```mermaid');
      expect(markdown).toContain('sequenceDiagram');
      expect(markdown).toContain('```');
    });

    it('should show bottlenecks as critical blocks', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());

      server.get('/mermaid-bottleneck', async (ctx: Context) => {
        await trackDatabase(ctx, 'SLOW QUERY', async () => {
          await new Promise(r => setTimeout(r, 150));
          return [];
        });
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/mermaid-bottleneck`);
      await new Promise(resolve => setTimeout(resolve, 200));

      const flows = flowStorage.getAll();
      const flow = flows.find(f => f.path === '/mermaid-bottleneck');
      expect(flow).toBeDefined();

      const diagram = generateMermaidDiagram(flow!);

      expect(diagram).toContain('critical Bottlenecks Detected');
      expect(diagram).toContain('⚠️');
    });
  });

  describe('Integration Tests', () => {
    it('should serve flow JSON via /profile/:traceId/flow', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/api-flow', (ctx: Context) => {
        return ctx.json({ traceId: ctx.trace?.traceId });
      });

      await server.listen(testPort);
      const res = await fetch(`http://localhost:${testPort}/api-flow`);
      const data: any = await res.json();

      await new Promise(resolve => setTimeout(resolve, 100));

      const flowRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}/flow`);
      expect(flowRes.status).toBe(200);
      expect(flowRes.headers.get('content-type')).toContain('application/json');

      const flow: any = await flowRes.json();
      expect(flow.traceId).toBe(data.traceId);
      expect(flow.method).toBe('GET');
      expect(flow.path).toBe('/api-flow');
      expect(flow.events).toBeDefined();
      expect(flow.dependencies).toBeDefined();
      expect(flow.stats).toBeDefined();
    });

    it('should serve waterfall via /profile/:traceId/waterfall', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/api-waterfall', (ctx: Context) => {
        return ctx.json({ traceId: ctx.trace?.traceId });
      });

      await server.listen(testPort);
      const res = await fetch(`http://localhost:${testPort}/api-waterfall`);
      const data: any = await res.json();

      await new Promise(resolve => setTimeout(resolve, 100));

      const waterfallRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}/waterfall`);
      expect(waterfallRes.status).toBe(200);
      expect(waterfallRes.headers.get('content-type')).toContain('text/plain');

      const waterfall = await waterfallRes.text();
      expect(waterfall).toContain('Request Flow Timeline');
      expect(waterfall).toContain(data.traceId);
    });

    it('should serve mermaid via /profile/:traceId/mermaid', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/api-mermaid', (ctx: Context) => {
        return ctx.json({ traceId: ctx.trace?.traceId });
      });

      await server.listen(testPort);
      const res = await fetch(`http://localhost:${testPort}/api-mermaid`);
      const data: any = await res.json();

      await new Promise(resolve => setTimeout(resolve, 100));

      const mermaidRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}/mermaid`);
      expect(mermaidRes.status).toBe(200);
      expect(mermaidRes.headers.get('content-type')).toContain('text/plain');

      const mermaid = await mermaidRes.text();
      expect(mermaid).toContain('sequenceDiagram');
    });

    it('should support format query parameter on /profile/:traceId', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/api-format', (ctx: Context) => {
        return ctx.json({ traceId: ctx.trace?.traceId });
      });

      await server.listen(testPort);
      const res = await fetch(`http://localhost:${testPort}/api-format`);
      const data: any = await res.json();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Test different formats
      const jsonRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}?format=json`);
      expect(jsonRes.headers.get('content-type')).toContain('application/json');

      const waterfallRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}?format=waterfall`);
      expect(waterfallRes.headers.get('content-type')).toContain('text/plain');
      const waterfallText = await waterfallRes.text();
      expect(waterfallText).toContain('Request Flow Timeline');

      const mermaidRes = await fetch(`http://localhost:${testPort}/profile/${data.traceId}?format=mermaid`);
      expect(mermaidRes.headers.get('content-type')).toContain('text/plain');
      const mermaidText = await mermaidRes.text();
      expect(mermaidText).toContain('sequenceDiagram');
    });

    it('should return 404 for non-existent flow', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      await server.listen(testPort);
      await new Promise(resolve => setTimeout(resolve, 50));

      const response = await fetch(`http://localhost:${testPort}/profile/nonexistent123/flow`);
      expect(response.status).toBe(404);

      const data: any = await response.json();
      expect(data.error).toBe('Flow not found');
      expect(data.traceId).toBe('nonexistent123');
    });

    it('should serve flow statistics via /flow/stats', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/stats-test', (ctx: Context) => ctx.json({ ok: true }));

      await server.listen(testPort);

      // Generate some flows
      await fetch(`http://localhost:${testPort}/stats-test`);
      await fetch(`http://localhost:${testPort}/stats-test`);
      await fetch(`http://localhost:${testPort}/stats-test`);

      await new Promise(resolve => setTimeout(resolve, 200));

      const statsRes = await fetch(`http://localhost:${testPort}/flow/stats?format=json`);
      expect(statsRes.status).toBe(200);

      const stats: any = await statsRes.json();
      expect(stats.totalFlows).toBeGreaterThanOrEqual(3);
      expect(stats.slowFlows).toBeGreaterThanOrEqual(0);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.p50Duration).toBeGreaterThanOrEqual(0);
    });

    it('should serve slowest flows via /flow/slow', async () => {
      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      registerFlowRoutes(server as any);

      server.get('/slow1', async (ctx: Context) => {
        await new Promise(r => setTimeout(r, 1100));
        return ctx.json({ ok: true });
      });

      await server.listen(testPort);
      await fetch(`http://localhost:${testPort}/slow1`);
      await new Promise(resolve => setTimeout(resolve, 200));

      const slowRes = await fetch(`http://localhost:${testPort}/flow/slow?format=json&limit=5`);
      expect(slowRes.status).toBe(200);

      const slowFlows: any = await slowRes.json();
      expect(Array.isArray(slowFlows)).toBe(true);
    });

    it('should handle circular buffer limits', async () => {
      configureStorage({ flowMaxSize: 3 });

      server = createApp({
        port: testPort,
        observability: {
          tracing: { enabled: true, exporter: 'memory', serviceName: 'test' },
        },
      });
      server.use(flowTrackingMiddleware());
      server.get('/buffer', (ctx: Context) => ctx.json({ ok: true }));

      await server.listen(testPort);

      // Make more requests than buffer size
      for (let i = 0; i < 5; i++) {
        await fetch(`http://localhost:${testPort}/buffer`);
        await new Promise(r => setTimeout(r, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const count = flowStorage.count();
      expect(count).toBeLessThanOrEqual(3);
      expect(count).toBeGreaterThan(0);
    });
  });
});
