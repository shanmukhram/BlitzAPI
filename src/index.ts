/**
 * BlitzAPI - Ultra-fast, secure, and observable API framework
 *
 * @module blitzapi
 */

// Core exports
export { Server, createApp } from './core/server.js';
export { Router } from './core/router.js';
export { HTTPError } from './core/types.js';

// Type exports
export type {
  Context,
  Handler,
  Middleware,
  Route,
  HTTPMethod,
  ServerConfig,
  RouterConfig,
  CorsConfig,
  ErrorHandler,
  ValidationError,
  InferSchema,
} from './core/types.js';

// Middleware exports
export {
  validate,
  createHandler,
  cors,
  logger,
  rateLimit,
} from './middleware/index.js';

// Auth exports
export {
  JWTService,
  authenticate,
  optionalAuthenticate,
  PasswordService,
  passwordService,
} from './auth/index.js';

export type {
  JWTConfig,
  JWTPayload,
} from './auth/index.js';

// Protocol exports
export {
  ProtocolManager,
  GraphQLAdapter,
  GRPCAdapter,
} from './protocols/index.js';

export type {
  Protocol,
  Operation,
  ProtocolAdapter,
  Resource,
  GraphQLConfig,
  GraphQLOperation,
  GRPCConfig,
  GRPCOperation,
} from './protocols/index.js';

// Adapter exports (Phase 3.2 & 3.3)
export {
  createAdapter,
  getAvailableAdapters,
  NodeHTTPAdapter,
  createNodeHTTPAdapter,
  UWebSocketsAdapter,
  createUWebSocketsAdapter,
} from './adapters/index.js';

export type {
  ServerAdapter,
  RequestHandler,
  RawRequestInfo,
  RawResponseData,
  AdapterConfig,
  AdapterFactory,
} from './adapters/index.js';
