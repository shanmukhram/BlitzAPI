/**
 * gRPC protocol types
 */

import type { ServerCredentials } from '@grpc/grpc-js';
import type { Operation } from '../types.js';

/**
 * gRPC configuration
 */
export interface GRPCConfig {
  port?: number; // gRPC server port (separate from HTTP)
  host?: string;
  credentials?: ServerCredentials;
  protoPath?: string; // Path to .proto files
}

/**
 * gRPC operation metadata
 */
export interface GRPCOperation extends Operation {
  grpc: {
    service: string; // Service name (e.g., "UserService")
    method: string; // Method name (e.g., "GetUser")
    package?: string; // Proto package name
  };
}

/**
 * gRPC service definition
 */
export interface GRPCService {
  name: string;
  package?: string;
  methods: Map<string, GRPCMethod>;
}

/**
 * gRPC method definition
 */
export interface GRPCMethod {
  name: string;
  requestType: string;
  responseType: string;
  handler: (request: any, context: any) => Promise<any>;
}
