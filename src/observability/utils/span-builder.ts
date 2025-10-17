/**
 * Span builder helpers for creating well-structured spans
 */

import type { Span } from '@opentelemetry/api';
import { startSpan, endSpan } from '../context.js';

/**
 * Span builder for fluent API
 */
export class SpanBuilder {
  private name: string;
  private attributes: Record<string, any> = {};

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Add attribute to span
   */
  attr(key: string, value: any): this {
    this.attributes[key] = value;
    return this;
  }

  /**
   * Add multiple attributes
   */
  attrs(attributes: Record<string, any>): this {
    Object.assign(this.attributes, attributes);
    return this;
  }

  /**
   * Start the span
   */
  start(): Span | undefined {
    return startSpan(this.name, this.attributes);
  }
}

/**
 * Create a new span builder
 */
export function span(name: string): SpanBuilder {
  return new SpanBuilder(name);
}

/**
 * Wrap async function with automatic span
 */
export async function traced<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const span = startSpan(name, attributes);

  try {
    const result = await fn();
    endSpan(span);
    return result;
  } catch (error) {
    endSpan(span, error as Error);
    throw error;
  }
}

/**
 * Wrap sync function with automatic span
 */
export function tracedSync<T>(
  name: string,
  fn: () => T,
  attributes?: Record<string, any>
): T {
  const span = startSpan(name, attributes);

  try {
    const result = fn();
    endSpan(span);
    return result;
  } catch (error) {
    endSpan(span, error as Error);
    throw error;
  }
}
