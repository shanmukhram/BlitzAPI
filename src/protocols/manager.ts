/**
 * Protocol manager
 * Coordinates multiple protocol adapters and handles protocol negotiation
 */

import type { Context } from '../core/types.js';
import type { ProtocolAdapter, Operation } from './types.js';
import { GraphQLAdapter } from './graphql/adapter.js';
import { GRPCAdapter } from './grpc/adapter.js';

/**
 * Protocol manager configuration
 */
export interface ProtocolManagerConfig {
  graphql?: boolean | { path?: string; playground?: boolean };
  grpc?: boolean | { port?: number };
}

/**
 * Protocol manager
 * Manages multiple protocol adapters
 */
export class ProtocolManager {
  private adapters: Map<string, ProtocolAdapter> = new Map();
  private graphqlAdapter?: GraphQLAdapter;
  private grpcAdapter?: GRPCAdapter;

  constructor(config: ProtocolManagerConfig = {}) {
    // Initialize GraphQL adapter if enabled
    if (config.graphql) {
      const graphqlConfig = typeof config.graphql === 'object' ? config.graphql : {};
      this.graphqlAdapter = new GraphQLAdapter(graphqlConfig);
      this.adapters.set('graphql', this.graphqlAdapter);
    }

    // Initialize gRPC adapter if enabled
    if (config.grpc) {
      const grpcConfig = typeof config.grpc === 'object' ? config.grpc : {};
      this.grpcAdapter = new GRPCAdapter(grpcConfig);
      this.adapters.set('grpc', this.grpcAdapter);
    }
  }

  /**
   * Register an operation with all applicable adapters
   */
  registerOperation(operation: Operation): void {
    // Register with GraphQL if metadata present
    if (operation.graphql && this.graphqlAdapter) {
      this.graphqlAdapter.register(operation);
    }

    // Register with gRPC if metadata present
    if (operation.grpc && this.grpcAdapter) {
      this.grpcAdapter.register(operation);
    }
  }

  /**
   * Handle request with protocol negotiation
   */
  async handle(ctx: Context): Promise<boolean> {
    // Try GraphQL first if path matches
    if (this.graphqlAdapter) {
      const graphqlPath = (this.graphqlAdapter as any).config.path || '/graphql';
      if (ctx.path.startsWith(graphqlPath)) {
        await this.graphqlAdapter.handle(ctx);
        return true;
      }
    }

    // Check content-type header for protocol hints
    const contentType = ctx.headers['content-type'] as string || '';

    // GraphQL requests (application/graphql or application/json with GraphQL query)
    if (contentType.includes('application/graphql') && this.graphqlAdapter) {
      await this.graphqlAdapter.handle(ctx);
      return true;
    }

    // gRPC requests (application/grpc)
    if (contentType.includes('application/grpc') && this.grpcAdapter) {
      // gRPC uses its own server, not HTTP
      return false;
    }

    return false; // No protocol match, fall through to REST
  }

  /**
   * Start gRPC server if enabled
   */
  async startGRPC(): Promise<void> {
    if (this.grpcAdapter) {
      await this.grpcAdapter.start();
    }
  }

  /**
   * Stop gRPC server
   */
  async stopGRPC(): Promise<void> {
    if (this.grpcAdapter) {
      await this.grpcAdapter.stop();
    }
  }

  /**
   * Get GraphQL adapter
   */
  getGraphQLAdapter(): GraphQLAdapter | undefined {
    return this.graphqlAdapter;
  }

  /**
   * Get gRPC adapter
   */
  getGRPCAdapter(): GRPCAdapter | undefined {
    return this.grpcAdapter;
  }
}
