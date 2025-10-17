/**
 * Multi-Protocol Profiling Test
 * Tests profiling across REST, GraphQL, and gRPC protocols
 */

import { z } from 'zod';
import { createApp, type Operation } from '../../src/index.js';
import { registerProfileRoutes } from '../../src/observability/profiler/routes.js';

// Create app with profiling enabled
const app = createApp({
  observability: {
    enabled: true,
    tracing: {
      enabled: true,
      serviceName: 'multi-protocol-profiling',
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
      slowThreshold: 50,  // Lower threshold for testing
      autoDetectBottlenecks: true,
    },
  },

  protocols: {
    rest: { enabled: true },
    graphql: { enabled: true },
    grpc: { enabled: true },
  },
});

// Register profile routes
registerProfileRoutes(app as any);

// Define operations that work across all protocols
const operations: Operation[] = [
  {
    name: 'fastOperation',
    description: 'Fast operation (10ms)',
    input: z.object({}).optional(),
    output: z.object({
      message: z.string(),
      duration: z.string(),
    }),
    handler: async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { message: 'Fast operation complete', duration: '10ms' };
    },
    rest: { method: 'GET', path: '/api/fast' },
    graphql: { type: 'query' },
    grpc: { service: 'TestService', method: 'FastOperation' },
  },

  {
    name: 'slowOperation',
    description: 'Slow operation (100ms)',
    input: z.object({}).optional(),
    output: z.object({
      message: z.string(),
      duration: z.string(),
    }),
    handler: async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { message: 'Slow operation complete', duration: '100ms' };
    },
    rest: { method: 'GET', path: '/api/slow' },
    graphql: { type: 'query' },
    grpc: { service: 'TestService', method: 'SlowOperation' },
  },

  {
    name: 'createItem',
    description: 'Create an item',
    input: z.object({
      name: z.string(),
      value: z.number(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      value: z.number(),
    }),
    handler: async (input) => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return {
        id: Math.random().toString(36).substr(2, 9),
        name: input.name,
        value: input.value,
      };
    },
    rest: { method: 'POST', path: '/api/items' },
    graphql: { type: 'mutation' },
    grpc: { service: 'TestService', method: 'CreateItem' },
  },
];

// Register operations
app.registerOperations(operations);

const PORT = 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('🔍 Multi-Protocol Profiling Demo');
  console.log('============================================================');
  console.log('');
  console.log(`REST:     http://localhost:${PORT}/api/*`);
  console.log(`GraphQL:  http://localhost:${PORT}/graphql`);
  console.log(`gRPC:     localhost:${PORT + 1}`);
  console.log('');
  console.log('📊 Test Commands:');
  console.log('');
  console.log('# REST');
  console.log(`curl http://localhost:${PORT}/api/fast`);
  console.log(`curl http://localhost:${PORT}/api/slow`);
  console.log(`curl -X POST http://localhost:${PORT}/api/items -H "Content-Type: application/json" -d '{"name":"test","value":42}'`);
  console.log('');
  console.log('# GraphQL');
  console.log(`curl -X POST http://localhost:${PORT}/graphql -H "Content-Type: application/json" -d '{"query":"{ fastOperation { message } }"}'`);
  console.log(`curl -X POST http://localhost:${PORT}/graphql -H "Content-Type: application/json" -d '{"query":"{ slowOperation { message } }"}'`);
  console.log('');
  console.log('# Profile API');
  console.log(`curl http://localhost:${PORT}/profile/stats`);
  console.log(`curl http://localhost:${PORT}/profile/slow`);
  console.log('');
  console.log('💡 Watch for profiling output across all protocols!');
  console.log('============================================================');
  console.log('');
});
