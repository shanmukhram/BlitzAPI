/**
 * gRPC protocol adapter
 * Handles gRPC requests via @grpc/grpc-js
 */

import {
  Server,
  ServerCredentials,
  type ServiceDefinition,
  type UntypedServiceImplementation,
} from '@grpc/grpc-js';
import type { ProtocolAdapter, Operation } from '../types.js';
import type { GRPCConfig, GRPCService } from './types.js';
import { buildProtoFile } from './proto-builder.js';

/**
 * gRPC adapter
 */
export class GRPCAdapter implements ProtocolAdapter {
  protocol = 'gRPC' as const;
  private operations: Operation[] = [];
  private server?: Server;
  private services: Map<string, GRPCService> = new Map();
  private config: Required<GRPCConfig>;

  constructor(config: GRPCConfig = {}) {
    this.config = {
      port: config.port || 50051,
      host: config.host || '0.0.0.0',
      credentials: config.credentials || ServerCredentials.createInsecure(),
      protoPath: config.protoPath || './proto',
    };
  }

  /**
   * Register an operation
   */
  register(operation: Operation): void {
    if (!operation.grpc) {
      throw new Error(`Operation ${operation.name} does not have gRPC metadata`);
    }

    this.operations.push(operation);

    // Organize by service
    const serviceName = operation.grpc.service;
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        name: serviceName,
        package: (operation.grpc as any).package,
        methods: new Map(),
      });
    }

    const service = this.services.get(serviceName)!;
    service.methods.set(operation.name, {
      name: operation.name,
      requestType: `${capitalize(operation.name)}Request`,
      responseType: `${capitalize(operation.name)}Response`,
      handler: async (request: any, context: any) => {
        return await operation.handler(request, context);
      },
    });
  }

  /**
   * Handle gRPC request (N/A - gRPC uses its own server)
   */
  async handle(): Promise<void> {
    // gRPC doesn't use HTTP context
    throw new Error('gRPC adapter uses separate server. Call start() instead.');
  }

  /**
   * Start gRPC server
   */
  async start(): Promise<void> {
    this.server = new Server();

    // Register all services
    for (const [, service] of this.services) {
      const implementation: UntypedServiceImplementation = {};

      for (const [methodName, method] of service.methods) {
        implementation[methodName] = async (call: any, callback: any) => {
          try {
            const result = await method.handler(call.request, { call });
            callback(null, result);
          } catch (error) {
            callback(error);
          }
        };
      }

      // Create simple service definition
      const serviceDefinition: ServiceDefinition = {} as any;

      this.server.addService(serviceDefinition, implementation);
    }

    // Start server
    return new Promise((resolve, reject) => {
      const address = `${this.config.host}:${this.config.port}`;
      this.server!.bindAsync(
        address,
        this.config.credentials,
        (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`🚀 gRPC server running at ${address}`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Stop gRPC server
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.tryShutdown(() => {
        console.log('🛑 gRPC server stopped');
        resolve();
      });
    });
  }

  /**
   * Get proto file content
   */
  getProtoFile(packageName: string, serviceName: string): string {
    return buildProtoFile(packageName, serviceName, this.operations);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
