/**
 * Raw request information extracted by adapter
 */
export interface RawRequestInfo {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
}

/**
 * Raw response data to be sent by adapter
 */
export interface RawResponseData {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

/**
 * Request handler that processes requests and returns responses
 */
export type RequestHandler = (
  requestInfo: RawRequestInfo,
  rawRequest: any
) => Promise<RawResponseData>;

/**
 * Server Adapter Interface
 *
 * Abstracts the underlying HTTP server implementation (Node.js http, uWebSockets.js, etc.)
 * Allows BlitzAPI to work with different server backends without changing core logic
 */
export interface ServerAdapter {
  /**
   * Name of the adapter (e.g., "node-http", "uwebsockets")
   */
  readonly name: string;

  /**
   * Start listening for incoming requests
   *
   * @param port - Port number to listen on
   * @param host - Host address to bind to
   * @returns Promise that resolves when server is listening
   */
  listen(port: number, host: string): Promise<void>;

  /**
   * Stop the server and close all connections
   *
   * @returns Promise that resolves when server is fully closed
   */
  close(): Promise<void>;

  /**
   * Register the request handler that will process all incoming requests
   *
   * @param handler - Function that processes requests and returns responses
   */
  onRequest(handler: RequestHandler): void;

  /**
   * Extract request information from the raw request object
   * Used for creating Context objects
   *
   * @param raw - Raw request object (type depends on adapter)
   * @returns Normalized request information
   */
  getRequestInfo(raw: any): RawRequestInfo;

  /**
   * Send response to client
   *
   * @param raw - Raw request/response object (type depends on adapter)
   * @param statusCode - HTTP status code
   * @param headers - Response headers
   * @param body - Response body as Buffer or string
   */
  sendResponse(
    raw: any,
    statusCode: number,
    headers: Record<string, string>,
    body: Buffer | string
  ): void;

  /**
   * Parse request body from raw request
   *
   * @param raw - Raw request object
   * @returns Promise resolving to parsed body
   */
  parseBody(raw: any): Promise<unknown>;

  /**
   * Check if adapter supports streaming
   */
  readonly supportsStreaming?: boolean;

  /**
   * Check if adapter supports HTTP/2
   */
  readonly supportsHTTP2?: boolean;
}

/**
 * Configuration for adapter selection
 */
export interface AdapterConfig {
  /**
   * Type of adapter to use
   * - 'node-http': Standard Node.js http module (default)
   * - 'uwebsockets': Ultra-fast uWebSockets.js
   */
  type?: 'node-http' | 'uwebsockets';

  /**
   * Adapter-specific options
   */
  options?: Record<string, any>;
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = (config?: Record<string, any>) => ServerAdapter;
