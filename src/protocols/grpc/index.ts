/**
 * gRPC protocol exports
 */

export { GRPCAdapter } from './adapter.js';
export { buildProtoFile, saveProtoFile, zodToProtoMessage } from './proto-builder.js';
export type { GRPCConfig, GRPCOperation, GRPCService, GRPCMethod } from './types.js';
