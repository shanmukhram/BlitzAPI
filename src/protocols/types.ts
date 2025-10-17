/**
 * Protocol abstraction layer types
 * Allows a single handler to support multiple protocols (REST, GraphQL, gRPC)
 */

import type { Context } from '../core/types.js';
import type { ZodSchema } from 'zod';

/**
 * Protocol types supported by BlitzAPI
 */
export type Protocol = 'REST' | 'GraphQL' | 'gRPC';

/**
 * Unified operation definition that works across protocols
 */
export interface Operation<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  input?: ZodSchema<TInput>;
  output?: ZodSchema<TOutput>;
  handler: (input: TInput, ctx: Context) => Promise<TOutput> | TOutput;

  // Protocol-specific metadata
  rest?: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
  };
  graphql?: {
    type: 'query' | 'mutation' | 'subscription';
  };
  grpc?: {
    service: string;
    method: string;
  };
}

/**
 * Protocol adapter interface
 * Each protocol implements this to translate operations
 */
export interface ProtocolAdapter {
  protocol: Protocol;
  register(operation: Operation): void;
  handle(ctx: Context): Promise<void>;
}

/**
 * Resource definition (CRUD operations)
 * Automatically generates operations for all protocols
 */
export interface Resource<T = unknown> {
  name: string;
  schema: ZodSchema<T>;

  operations: {
    list?: (ctx: Context) => Promise<T[]>;
    get?: (id: string, ctx: Context) => Promise<T | null>;
    create?: (input: Partial<T>, ctx: Context) => Promise<T>;
    update?: (id: string, input: Partial<T>, ctx: Context) => Promise<T>;
    delete?: (id: string, ctx: Context) => Promise<boolean>;
  };
}
