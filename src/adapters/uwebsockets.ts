import type {
  ServerAdapter,
  RequestHandler,
  RawRequestInfo,
} from './types.js';
import { createRequire } from 'module';

// Create require function for loading CommonJS modules in ES module context
const require = createRequire(import.meta.url);

/**
 * uWebSockets.js Adapter
 *
 * Wraps uWebSockets.js as a ServerAdapter for ultra-high performance
 *
 * Performance characteristics:
 * - 2-3x faster than Node.js http (~200-400k req/s)
 * - Lower memory usage
 * - Better latency under load
 * - HTTP/1.1 and HTTP/2 support
 *
 * Trade-offs:
 * - Native C++ dependencies (platform-specific binaries)
 * - Less ecosystem compatibility
 * - Different API patterns (must be careful with async)
 *
 * IMPORTANT: uWebSockets.js responses cannot be used after the request handler returns.
 * All response writing must happen synchronously or use the provided helpers.
 */
export class UWebSocketsAdapter implements ServerAdapter {
  readonly name = 'uwebsockets';
  readonly supportsStreaming = true;
  readonly supportsHTTP2 = true;

  private app?: any;
  private listenSocket?: any;
  private requestHandler?: RequestHandler;
  private uws?: any;

  constructor(private config: Record<string, any> = {}) {
    // uWebSockets will be loaded in listen() method
    // We defer loading to avoid errors if not installed
  }

  /**
   * Load uWebSockets.js module
   * Use CommonJS require() - this is a native module that works better with require
   */
  private async loadUWebSockets(): Promise<any> {
    try {
      // Use require directly - uWebSockets.js is a native CommonJS module
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const uws = require('uWebSockets.js');
      return uws;
    } catch (error) {
      throw new Error(
        'uWebSockets.js not installed. Install with: npm install uWebSockets.js'
      );
    }
  }

  /**
   * Register the request handler
   */
  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler;
  }

  /**
   * Parse headers from uWebSockets request
   */
  private parseHeaders(req: any): Record<string, string> {
    const headers: Record<string, string> = {};
    req.forEach((key: string, value: string) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Start the uWebSockets server
   */
  async listen(port: number, host: string): Promise<void> {
    if (!this.requestHandler) {
      throw new Error('Request handler not registered. Call onRequest() first.');
    }

    // Load uWebSockets.js module
    if (!this.uws) {
      this.uws = await this.loadUWebSockets();
    }

    // Create uWebSockets app (SSL or non-SSL)
    this.app = this.config.ssl
      ? this.uws.SSLApp(this.config.ssl)
      : this.uws.App();

    // Register wildcard route to handle all requests
    this.app.any('/*', async (res: any, req: any) => {
      // CRITICAL: uWebSockets responses are only valid during the callback
      let aborted = false;

      // Handle connection abort
      res.onAborted(() => {
        aborted = true;
      });

      try {
        // Extract request info from uWS - do this early
        const info: RawRequestInfo = {
          method: req.getMethod().toUpperCase(),
          url: req.getUrl() + (req.getQuery() ? '?' + req.getQuery() : ''),
          headers: this.parseHeaders(req),
        };

        // Read body if present (for POST/PUT/PATCH)
        let bodyData: Buffer | undefined;
        if (info.method === 'POST' || info.method === 'PUT' || info.method === 'PATCH') {
          bodyData = await this.readBody(res);
        }

        // Create raw request object that includes everything
        const raw = {
          req,
          res,
          info,
          bodyData,
          aborted: () => aborted,
        };

        // Call RamAPI handler
        const responseData = await this.requestHandler!(info, raw);

        // Send response if not aborted
        if (!aborted) {
          this.sendResponse(raw, responseData.statusCode, responseData.headers, responseData.body);
        }
      } catch (error) {
        console.error('Error in UWebSocketsAdapter:', error);
        if (!aborted) {
          res.writeStatus('500 Internal Server Error');
          res.writeHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    });

    // Normalize host for uWebSockets (it doesn't understand 'localhost', use '0.0.0.0' instead)
    const listenHost = host === 'localhost' ? '0.0.0.0' : host;

    // Start listening
    return new Promise((resolve, reject) => {
      try {
        // Try with LIBUS_LISTEN_EXCLUSIVE_PORT flag first
        // This is needed when running as a spawned child process
        this.app!.listen(listenHost, port, this.uws.LIBUS_LISTEN_EXCLUSIVE_PORT, (listenSocket: any) => {
          if (listenSocket) {
            this.listenSocket = listenSocket;
            console.log(`🚀 RamAPI server (${this.name}) running at http://${host}:${port}`);
            resolve();
          } else {
            // Failed - maybe try without the flag
            console.log('⚠️ Retrying listen without EXCLUSIVE_PORT flag...');
            this.app!.listen(port, (retrySocket: any) => {
              if (retrySocket) {
                this.listenSocket = retrySocket;
                console.log(`🚀 RamAPI server (${this.name}) running at http://${host}:${port}`);
                resolve();
              } else {
                reject(new Error(`Failed to listen on port ${port}`));
              }
            });
          }
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }

  /**
   * Stop the uWebSockets server
   */
  async close(): Promise<void> {
    if (this.listenSocket) {
      this.uws.us_listen_socket_close(this.listenSocket);
      this.listenSocket = null;
      console.log('🛑 RamAPI server stopped');
    }
  }

  /**
   * Extract request information from raw object
   * Info is already extracted in listen(), so just return it
   */
  getRequestInfo(raw: any): RawRequestInfo {
    return raw.info; // Already extracted in listen()
  }

  /**
   * Send response to client
   */
  sendResponse(
    raw: any,
    statusCode: number,
    headers: Record<string, string>,
    body: Buffer | string
  ): void {
    const { res, aborted } = raw;

    // Check if aborted (connection closed)
    if (aborted && aborted()) {
      return;
    }

    try {
      // Write status
      const statusText = this.getStatusText(statusCode);
      res.writeStatus(`${statusCode} ${statusText}`);

      // Write headers (skip Content-Length as uWebSockets adds it automatically via res.end())
      for (const [key, value] of Object.entries(headers)) {
        // Skip Content-Length - uWebSockets adds it automatically in res.end()
        if (key.toLowerCase() === 'content-length') {
          continue;
        }
        res.writeHeader(key, value);
      }

      // Write body and end response (uWebSockets automatically adds Content-Length)
      res.end(body);
    } catch (error) {
      console.error('Error sending response:', error);
    }
  }

  /**
   * Parse request body from raw object
   * Body is already read in listen(), so just parse it
   */
  async parseBody(raw: any): Promise<unknown> {
    const contentType = raw.info.headers['content-type'] || '';
    const bodyData = raw.bodyData;

    if (!bodyData || bodyData.length === 0) {
      return undefined;
    }

    const body = bodyData.toString('utf-8');

    // Parse JSON
    if (contentType.includes('application/json')) {
      return JSON.parse(body);
    }

    // Parse URL-encoded
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(body);
      const result: Record<string, string> = {};
      params.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    // Default: return raw string
    return body;
  }

  /**
   * Read request body from uWebSockets response object
   * IMPORTANT: Must be called during the request callback
   */
  private readBody(res: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      res.onData((chunk: ArrayBuffer, isLast: boolean) => {
        chunks.push(Buffer.from(chunk));

        if (isLast) {
          resolve(Buffer.concat(chunks));
        }
      });

      // Handle abort during body read
      res.onAborted(() => {
        reject(new Error('Request aborted'));
      });
    });
  }

  /**
   * Get HTTP status text for status code
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[statusCode] || 'Unknown';
  }
}

/**
 * Factory function to create UWebSocketsAdapter
 */
export function createUWebSocketsAdapter(config?: Record<string, any>): ServerAdapter {
  return new UWebSocketsAdapter(config);
}
