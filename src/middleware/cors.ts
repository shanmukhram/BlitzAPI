import type { Middleware, CorsConfig } from '../core/types.js';

/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing headers
 */
export function cors(config: CorsConfig = {}): Middleware {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400, // 24 hours
  } = config;

  return async (ctx, next) => {
    const requestOrigin = ctx.headers.origin as string;

    // Determine if origin is allowed
    let allowOrigin = '*';
    if (typeof origin === 'string') {
      allowOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (origin.includes(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    } else if (typeof origin === 'function') {
      if (origin(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    }

    // Set CORS headers
    ctx.setHeader('Access-Control-Allow-Origin', allowOrigin);

    if (credentials) {
      ctx.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (methods.length > 0) {
      ctx.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    }

    if (allowedHeaders.length > 0) {
      ctx.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    if (exposedHeaders.length > 0) {
      ctx.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    if (maxAge) {
      ctx.setHeader('Access-Control-Max-Age', maxAge.toString());
    }

    // Handle preflight requests
    if (ctx.method === 'OPTIONS') {
      ctx.status(204);
      ctx.res.end();
      return;
    }

    await next();
  };
}
