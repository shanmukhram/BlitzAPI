import type { Middleware } from '../core/types.js';
import { HTTPError } from '../core/types.js';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  keyGenerator?: (ctx: any) => string; // Function to generate unique key per client
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Simple in-memory rate limiter
 * For production, use Redis or similar
 */
class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  constructor(private config: Required<RateLimitConfig>) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // No entry or expired entry - allow and create new
    if (!entry || entry.resetTime < now) {
      const resetTime = now + this.config.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
      };
    }

    // Entry exists and not expired
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }
}

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig = {}): Middleware {
  const fullConfig: Required<RateLimitConfig> = {
    windowMs: config.windowMs || 60000, // 1 minute default
    maxRequests: config.maxRequests || 100, // 100 requests per window
    keyGenerator: config.keyGenerator || ((ctx) => {
      // Default: use IP address
      return ctx.headers['x-forwarded-for'] as string ||
             ctx.headers['x-real-ip'] as string ||
             ctx.req.socket.remoteAddress ||
             'unknown';
    }),
    message: config.message || 'Too many requests, please try again later',
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    skipFailedRequests: config.skipFailedRequests ?? false,
  };

  const limiter = new RateLimiter(fullConfig);

  return async (ctx, next) => {
    const key = fullConfig.keyGenerator(ctx);
    const result = limiter.check(key);

    // Set rate limit headers
    ctx.setHeader('X-RateLimit-Limit', fullConfig.maxRequests.toString());
    ctx.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    ctx.setHeader(
      'X-RateLimit-Reset',
      new Date(result.resetTime).toISOString()
    );

    if (!result.allowed) {
      ctx.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());
      throw new HTTPError(429, fullConfig.message);
    }

    await next();
  };
}
