/**
 * Build script to compile gRPC proto files for production
 * Run this before deploying to production: npm run build:protos
 */

import { z } from 'zod';
import { createApp, type Operation } from '../../src/index.js';

// ============================================================================
// Import the same schemas and operations from server.ts
// ============================================================================

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  category: z.string(),
  inStock: z.boolean(),
});

const GetProductSchema = z.object({
  id: z.string(),
});

const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  category: z.string(),
  inStock: z.boolean().default(true),
});

const ListProductsSchema = z.object({
  category: z.string().optional(),
}).optional();

// Define operations (must match server.ts)
const operations: Operation[] = [
  {
    name: 'listProducts',
    description: 'List all products (optionally filter by category)',
    input: ListProductsSchema,
    output: z.array(ProductSchema),
    handler: async () => [], // Dummy handler for build
    rest: { method: 'GET', path: '/products' },
    graphql: { type: 'query' },
    grpc: { service: 'ProductService', method: 'ListProducts' },
  },
  {
    name: 'getProduct',
    description: 'Get a product by ID',
    input: GetProductSchema,
    output: ProductSchema.nullable(),
    handler: async () => null, // Dummy handler for build
    rest: { method: 'GET', path: '/products/:id' },
    graphql: { type: 'query' },
    grpc: { service: 'ProductService', method: 'GetProduct' },
  },
  {
    name: 'createProduct',
    description: 'Create a new product',
    input: CreateProductSchema,
    output: ProductSchema,
    handler: async () => ({} as Product), // Dummy handler for build
    rest: { method: 'POST', path: '/products' },
    graphql: { type: 'mutation' },
    grpc: { service: 'ProductService', method: 'CreateProduct' },
  },
  {
    name: 'deleteProduct',
    description: 'Delete a product',
    input: GetProductSchema,
    output: z.boolean(),
    handler: async () => false, // Dummy handler for build
    rest: { method: 'DELETE', path: '/products/:id' },
    graphql: { type: 'mutation' },
    grpc: { service: 'ProductService', method: 'DeleteProduct' },
  },
];

// ============================================================================
// Build proto files
// ============================================================================

async function buildProtos() {
  console.log('🚀 RamAPI Proto Compiler');
  console.log('');

  // Create app with gRPC enabled
  const app = createApp({
    protocols: {
      grpc: { port: 50051 },
    },
  });

  const protocolManager = app.getProtocolManager();
  if (!protocolManager) {
    throw new Error('Protocol manager not initialized');
  }

  // Register all operations
  for (const operation of operations) {
    protocolManager.registerOperation(operation);
  }

  // Get gRPC adapter and compile
  const grpcAdapter = (protocolManager as any).grpcAdapter;
  if (!grpcAdapter) {
    throw new Error('gRPC adapter not initialized');
  }

  // Compile for production
  await grpcAdapter.compileForProduction();

  console.log('💡 Tip: Add .ramapi/ to your .gitignore');
  console.log('   These files are generated and can be rebuilt anytime.');
  console.log('');
}

// Run build
buildProtos().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
