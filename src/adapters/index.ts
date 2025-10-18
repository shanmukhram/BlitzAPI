/**
 * Server Adapters
 *
 * Adapters abstract the underlying HTTP server implementation,
 * allowing RamAPI to work with different server backends.
 *
 * Available adapters:
 * - node-http: Standard Node.js http module (default)
 * - uwebsockets: Ultra-fast uWebSockets.js (2-3x faster)
 */

// Types
export type {
  ServerAdapter,
  RequestHandler,
  RawRequestInfo,
  RawResponseData,
  AdapterConfig,
  AdapterFactory,
} from './types.js';

// Adapters
export { NodeHTTPAdapter, createNodeHTTPAdapter } from './node-http.js';
export { UWebSocketsAdapter, createUWebSocketsAdapter } from './uwebsockets.js';

// Factory map for dynamic adapter selection
import { createNodeHTTPAdapter } from './node-http.js';
import { createUWebSocketsAdapter } from './uwebsockets.js';
import type { ServerAdapter, AdapterFactory } from './types.js';

const ADAPTER_FACTORIES: Record<string, AdapterFactory> = {
  'node-http': createNodeHTTPAdapter,
  'uwebsockets': createUWebSocketsAdapter,
};

/**
 * Create a server adapter based on type
 *
 * @param type - Adapter type ('node-http' or 'uwebsockets')
 * @param options - Adapter-specific options
 * @returns ServerAdapter instance
 *
 * @example
 * ```ts
 * // Create Node.js HTTP adapter (default)
 * const adapter = createAdapter('node-http');
 *
 * // Create uWebSockets adapter
 * const adapter = createAdapter('uwebsockets');
 *
 * // Create uWebSockets adapter with SSL
 * const adapter = createAdapter('uwebsockets', {
 *   ssl: {
 *     key_file_name: 'key.pem',
 *     cert_file_name: 'cert.pem'
 *   }
 * });
 * ```
 */
export function createAdapter(
  type: 'node-http' | 'uwebsockets' = 'node-http',
  options?: Record<string, any>
): ServerAdapter {
  const factory = ADAPTER_FACTORIES[type];

  if (!factory) {
    throw new Error(
      `Unknown adapter type: ${type}. Available adapters: ${Object.keys(ADAPTER_FACTORIES).join(', ')}`
    );
  }

  return factory(options);
}

/**
 * Get list of available adapter types
 */
export function getAvailableAdapters(): string[] {
  return Object.keys(ADAPTER_FACTORIES);
}
