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
import { loadProtoRuntime } from './proto-loader-runtime.js';
import { loadCompiledProto, generateAndCompileProto } from './proto-loader-build.js';
import { join } from 'path';

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
   * Start gRPC server (Hybrid Approach)
   * - Development: Runtime proto loading (convenient)
   * - Production: Pre-compiled protos (fast)
   */
  async start(): Promise<void> {
    // Skip if no operations registered
    if (this.operations.length === 0) {
      console.log('⏭️  gRPC: No operations registered, skipping gRPC server');
      return;
    }

    this.server = new Server();

    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Register all services
    for (const [, service] of this.services) {
      // Skip if no methods
      if (service.methods.size === 0) continue;

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

      // HYBRID APPROACH: Choose proto loading strategy based on environment
      let serviceDefinition: ServiceDefinition;
      const packageName = service.package || 'ramapi';

      if (isDevelopment) {
        // DEV MODE: Runtime proto loading (automatic, convenient for development)
        console.log(`🔧 gRPC [DEV]: Loading proto for ${service.name} at runtime...`);
        serviceDefinition = await loadProtoRuntime(
          packageName,
          service.name,
          this.operations.filter(op => op.grpc?.service === service.name)
        );
      } else {
        // PRODUCTION MODE: Load pre-compiled protos (zero-overhead, instant loading)
        console.log(`⚡ gRPC [PROD]: Loading pre-compiled proto for ${service.name}...`);
        serviceDefinition = loadCompiledProto(packageName, service.name);
      }

      // Add service with real definition
      this.server.addService(serviceDefinition, implementation);
      console.log(`✅ gRPC service registered: ${service.name}`);
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

  /**
   * Compile all registered services for production (build-time)
   * This should be called during npm run build:protos
   */
  async compileForProduction(
    outputDir: string = join(process.cwd(), '.ramapi', 'protos')
  ): Promise<void> {
    console.log('');
    console.log('🔨 Building gRPC proto files for production...');
    console.log('='.repeat(60));

    for (const [, service] of this.services) {
      if (service.methods.size === 0) continue;

      const packageName = service.package || 'ramapi';
      const serviceOps = this.operations.filter(op => op.grpc?.service === service.name);

      await generateAndCompileProto(
        packageName,
        service.name,
        serviceOps,
        outputDir
      );
    }

    console.log('='.repeat(60));
    console.log('✅ Production proto compilation complete!');
    console.log(`   Output: ${outputDir}`);
    console.log('');
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
