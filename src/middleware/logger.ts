import type { Middleware } from '../core/types.js';

/**
 * Logger middleware
 * Logs incoming requests and response times
 */
export function logger(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    const { method, path } = ctx;

    try {
      await next();
      const duration = Date.now() - start;
      const status = ctx.res.statusCode;

      // Color coding for status
      const statusColor = status >= 500 ? '31' : status >= 400 ? '33' : '32';

      console.log(
        `[\x1b[${statusColor}m${status}\x1b[0m] ${method} ${path} - ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - start;
      console.error(
        `[\x1b[31mERROR\x1b[0m] ${method} ${path} - ${duration}ms`,
        error
      );
      throw error;
    }
  };
}
