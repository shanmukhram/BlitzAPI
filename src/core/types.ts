import type { IncomingMessage, ServerResponse } from 'http';
import type { ZodSchema, z } from 'zod';

/**
 * HTTP Methods supported by BlitzAPI
 */
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/**
 * Context object passed to handlers and middleware
 * Contains request data, response helpers, and shared state
 */
export interface Context<TBody = unknown, TQuery = unknown, TParams = unknown> {
  // Request properties
  req: IncomingMessage;
  res: ServerResponse;
  method: HTTPMethod;
  url: string;
  path: string;
  query: TQuery;
  params: TParams;
  body: TBody;
  headers: Record<string, string | string[] | undefined>;

  // Response helpers
  json: (data: unknown, status?: number) => void;
  text: (data: string, status?: number) => void;
  status: (code: number) => Context<TBody, TQuery, TParams>;
  setHeader: (key: string, value: string) => Context<TBody, TQuery, TParams>;

  // Shared state for middleware communication
  state: Record<string, unknown>;

  // User/auth context (populated by auth middleware)
  user?: unknown;
}

/**
 * Handler function for routes
 * Can be async and receives typed context
 */
export type Handler<TBody = unknown, TQuery = unknown, TParams = unknown> = (
  ctx: Context<TBody, TQuery, TParams>
) => void | Promise<void>;

/**
 * Middleware function
 * Can modify context and control flow with next()
 */
export type Middleware = (
  ctx: Context,
  next: () => Promise<void>
) => void | Promise<void>;

/**
 * Route definition with validation schemas
 */
export interface Route {
  method: HTTPMethod;
  path: string;
  handler: Handler;
  middleware?: Middleware[];
  schema?: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
  };
  meta?: {
    description?: string;
    tags?: string[];
    auth?: boolean;
  };
}

/**
 * Router configuration
 */
export interface RouterConfig {
  prefix?: string;
  middleware?: Middleware[];
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port?: number;
  host?: string;
  cors?: boolean | CorsConfig;
  middleware?: Middleware[];
  onError?: ErrorHandler;
  onNotFound?: Handler;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: HTTPMethod[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Error handler function
 */
export type ErrorHandler = (
  error: Error,
  ctx: Context
) => void | Promise<void>;

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * HTTP Error with status code
 */
export class HTTPError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HTTPError';
  }
}

/**
 * Type helper to infer types from Zod schemas
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;
