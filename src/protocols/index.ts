/**
 * Protocol abstraction exports
 */

export { ProtocolManager } from './manager.js';
export type { Protocol, Operation, ProtocolAdapter, Resource } from './types.js';

// GraphQL exports
export { GraphQLAdapter, buildGraphQLSchema } from './graphql/index.js';
export type { GraphQLConfig, GraphQLOperation } from './graphql/index.js';

// gRPC exports
export { GRPCAdapter, buildProtoFile } from './grpc/index.js';
export type { GRPCConfig, GRPCOperation } from './grpc/index.js';
