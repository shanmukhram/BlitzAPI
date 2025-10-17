import jwt from 'jsonwebtoken';
import type { Middleware } from '../core/types.js';
import { HTTPError } from '../core/types.js';

/**
 * JWT configuration
 */
export interface JWTConfig {
  secret: string;
  expiresIn?: number; // seconds, e.g., 86400 for 24h
  algorithm?: jwt.Algorithm;
  issuer?: string;
  audience?: string;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string; // Subject (user ID)
  [key: string]: unknown;
}

/**
 * JWT service for signing and verifying tokens
 */
export class JWTService {
  constructor(private config: JWTConfig) {}

  /**
   * Sign a JWT token
   */
  sign(payload: JWTPayload): string {
    const options: jwt.SignOptions = {
      algorithm: this.config.algorithm || 'HS256',
    };

    if (this.config.expiresIn !== undefined) {
      options.expiresIn = this.config.expiresIn;
    }
    if (this.config.issuer !== undefined) {
      options.issuer = this.config.issuer;
    }
    if (this.config.audience !== undefined) {
      options.audience = this.config.audience;
    }

    return jwt.sign(payload, this.config.secret, options);
  }

  /**
   * Verify and decode a JWT token
   */
  verify(token: string): JWTPayload {
    try {
      const options: jwt.VerifyOptions = {
        algorithms: [this.config.algorithm || 'HS256'],
      };

      if (this.config.issuer !== undefined) {
        options.issuer = this.config.issuer;
      }
      if (this.config.audience !== undefined) {
        options.audience = this.config.audience;
      }

      return jwt.verify(token, this.config.secret, options) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new HTTPError(401, 'Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new HTTPError(401, 'Invalid token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (use with caution)
   */
  decode(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }
}

/**
 * Authentication middleware using JWT
 */
export function authenticate(jwtService: JWTService): Middleware {
  return async (ctx, next) => {
    // Extract token from Authorization header
    const authHeader = ctx.headers.authorization as string;

    if (!authHeader) {
      throw new HTTPError(401, 'Authorization header missing');
    }

    // Check for Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HTTPError(401, 'Invalid authorization header format. Expected: Bearer <token>');
    }

    const token = parts[1];

    try {
      // Verify and decode token
      const payload = jwtService.verify(token);

      // Add user to context
      ctx.user = payload;
      ctx.state.userId = payload.sub;

      await next();
    } catch (error) {
      if (error instanceof HTTPError) {
        throw error;
      }
      throw new HTTPError(401, 'Authentication failed');
    }
  };
}

/**
 * Optional authentication middleware
 * Authenticates if token is present, but doesn't fail if missing
 */
export function optionalAuthenticate(jwtService: JWTService): Middleware {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization as string;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        try {
          const payload = jwtService.verify(parts[1]);
          ctx.user = payload;
          ctx.state.userId = payload.sub;
        } catch {
          // Silently ignore invalid tokens
        }
      }
    }

    await next();
  };
}
