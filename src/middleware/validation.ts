import type { ZodSchema } from 'zod';
import type { Middleware, ValidationError } from '../core/types.js';
import { HTTPError } from '../core/types.js';

/**
 * Validation middleware factory
 * Validates request body, query params, and route params using Zod schemas
 */
export interface ValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Create validation middleware from Zod schemas
 */
export function validate(schema: ValidationSchema): Middleware {
  return async (ctx, next) => {
    const errors: ValidationError[] = [];

    // Validate body
    if (schema.body) {
      const result = schema.body.safeParse(ctx.body);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            field: `body.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          });
        });
      } else {
        // Replace with validated/transformed data
        ctx.body = result.data;
      }
    }

    // Validate query
    if (schema.query) {
      const result = schema.query.safeParse(ctx.query);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            field: `query.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          });
        });
      } else {
        ctx.query = result.data;
      }
    }

    // Validate params
    if (schema.params) {
      const result = schema.params.safeParse(ctx.params);
      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            field: `params.${err.path.join('.')}`,
            message: err.message,
            code: err.code,
          });
        });
      } else {
        ctx.params = result.data;
      }
    }

    // If validation failed, throw error
    if (errors.length > 0) {
      throw new HTTPError(400, 'Validation failed', { errors });
    }

    await next();
  };
}

/**
 * Helper to create type-safe route handlers with validation
 */
export function createHandler<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown
>(
  schema: ValidationSchema,
  handler: (ctx: {
    body: TBody;
    query: TQuery;
    params: TParams;
    [key: string]: unknown;
  }) => void | Promise<void>
): Middleware[] {
  return [
    validate(schema),
    async (ctx) => {
      await handler(ctx as any);
    },
  ];
}
