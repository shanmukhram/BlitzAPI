/**
 * BlitzAPI Multi-Protocol Example
 * Single API supporting REST, GraphQL, and gRPC simultaneously!
 */

import { z } from 'zod';
import { createApp, logger, cors, type Operation } from '../../src/index.js';

// ============================================================================
// 1. DATA MODEL - Single source of truth
// ============================================================================

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  inStock: boolean;
}

const products: Product[] = [
  { id: '1', name: 'Laptop', price: 999.99, category: 'Electronics', inStock: true },
  { id: '2', name: 'Mouse', price: 29.99, category: 'Electronics', inStock: true },
  { id: '3', name: 'Desk', price: 299.99, category: 'Furniture', inStock: false },
];

let productIdCounter = 4;

// ============================================================================
// 2. VALIDATION SCHEMAS
// ============================================================================

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

// ============================================================================
// 3. DEFINE OPERATIONS - Works for ALL protocols!
// ============================================================================

const operations: Operation[] = [
  {
    name: 'listProducts',
    description: 'List all products (optionally filter by category)',
    input: ListProductsSchema,
    output: z.array(ProductSchema),
    handler: async (input) => {
      if (input?.category) {
        return products.filter(p => p.category === input.category);
      }
      return products;
    },
    // REST endpoint
    rest: {
      method: 'GET',
      path: '/products',
    },
    // GraphQL query
    graphql: {
      type: 'query',
    },
    // gRPC method (foundation ready, needs proto compilation for full support)
    // grpc: {
    //   service: 'ProductService',
    //   method: 'ListProducts',
    // },
  },

  {
    name: 'getProduct',
    description: 'Get a product by ID',
    input: GetProductSchema,
    output: ProductSchema.nullable(),
    handler: async (input) => {
      const product = products.find(p => p.id === input.id);
      return product || null;
    },
    rest: {
      method: 'GET',
      path: '/products/:id',
    },
    graphql: {
      type: 'query',
    },
    // grpc: {
    //   service: 'ProductService',
    //   method: 'GetProduct',
    // },
  },

  {
    name: 'createProduct',
    description: 'Create a new product',
    input: CreateProductSchema,
    output: ProductSchema,
    handler: async (input) => {
      const newProduct: Product = {
        id: String(productIdCounter++),
        ...input,
      };
      products.push(newProduct);
      return newProduct;
    },
    rest: {
      method: 'POST',
      path: '/products',
    },
    graphql: {
      type: 'mutation',
    },
    // grpc: {
    //   service: 'ProductService',
    //   method: 'CreateProduct',
    // },
  },

  {
    name: 'deleteProduct',
    description: 'Delete a product',
    input: GetProductSchema,
    output: z.boolean(),
    handler: async (input) => {
      const index = products.findIndex(p => p.id === input.id);
      if (index === -1) return false;
      products.splice(index, 1);
      return true;
    },
    rest: {
      method: 'DELETE',
      path: '/products/:id',
    },
    graphql: {
      type: 'mutation',
    },
    // grpc: {
    //   service: 'ProductService',
    //   method: 'DeleteProduct',
    // },
  },
];

// ============================================================================
// 4. CREATE SERVER - ALL PROTOCOLS ENABLED!
// ============================================================================

const app = createApp({
  middleware: [logger(), cors()],
  protocols: {
    graphql: {
      path: '/graphql',
      playground: true,
    },
    // gRPC is available but requires proto file compilation
    // See example-app/grpc/ for full gRPC implementation
    // grpc: {
    //   port: 50051,
    // },
  },
});

const protocolManager = app.getProtocolManager();

// Register operations with ALL protocols
for (const operation of operations) {
  if (protocolManager) {
    protocolManager.registerOperation(operation);
  }

  // Register REST routes
  if (operation.rest) {
    const { method, path } = operation.rest;

    switch (method) {
      case 'GET':
        app.get(path, async (ctx) => {
          const input = { ...ctx.query, ...ctx.params };
          const result = await operation.handler(input as any, ctx);
          ctx.json(result);
        });
        break;

      case 'POST':
        app.post(path, async (ctx) => {
          const result = await operation.handler(ctx.body as any, ctx);
          ctx.json(result, 201);
        });
        break;

      case 'DELETE':
        app.delete(path, async (ctx) => {
          const input = { ...ctx.params };
          const result = await operation.handler(input as any, ctx);
          ctx.json({ success: result });
        });
        break;
    }
  }
}

// ============================================================================
// 5. START SERVER
// ============================================================================

app.listen(3000, '0.0.0.0').then(() => {
  console.log('');
  console.log('🛍️  Product API - Multi-Protocol Example');
  console.log('='.repeat(60));
  console.log('');
  console.log('✅ REST API:');
  console.log('   http://localhost:3000/products');
  console.log('   GET    /products');
  console.log('   GET    /products/:id');
  console.log('   POST   /products');
  console.log('   DELETE /products/:id');
  console.log('');
  console.log('✅ GraphQL API:');
  console.log('   http://localhost:3000/graphql');
  console.log('   Playground: http://localhost:3000/graphql');
  console.log('');
  console.log('💡 gRPC:');
  console.log('   Foundation ready - see example-app/grpc/ for full implementation');
  console.log('   (gRPC requires proto file compilation)');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 The same data is accessible via REST and GraphQL!');
  console.log('   Try accessing products via both protocols.');
  console.log('   Changes made in one are immediately visible in the other.');
  console.log('');
});
