import { createServer, Server as HTTPServer } from 'http';
import type {
  ServerAdapter,
  RequestHandler,
  RawRequestInfo,
} from './types.js';

/**
 * Node.js HTTP Adapter
 *
 * Wraps the standard Node.js http module as a ServerAdapter
 * This is the default adapter for BlitzAPI
 *
 * Performance characteristics:
 * - Battle-tested and stable
 * - Good performance for most use cases (~50-100k req/s)
 * - Full HTTP/1.1 support
 * - Compatible with all Node.js middleware
 */
export class NodeHTTPAdapter implements ServerAdapter {
  readonly name = 'node-http';
  readonly supportsStreaming = true;
  readonly supportsHTTP2 = false;

  private server?: HTTPServer;
  private requestHandler?: RequestHandler;

  /**
   * Register the request handler
   */
  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler;
  }

  /**
   * Start the HTTP server
   */
  async listen(port: number, host: string): Promise<void> {
    if (!this.requestHandler) {
      throw new Error('Request handler not registered. Call onRequest() first.');
    }

    this.server = createServer(async (req, res) => {
      try {
        // Extract request info early
        const info: RawRequestInfo = {
          method: req.method || 'GET',
          url: req.url || '/',
          headers: req.headers as Record<string, string | string[]>,
        };

        // Create raw request object that includes everything
        const raw = {
          req,
          res,
          info,
        };

        // Call BlitzAPI handler
        const responseData = await this.requestHandler!(info, raw);

        // Send response
        this.sendResponse(raw, responseData.statusCode, responseData.headers, responseData.body);
      } catch (error) {
        // Fallback error handling
        console.error('Error in NodeHTTPAdapter:', error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(port, host, () => {
        console.log(`🚀 BlitzAPI server (${this.name}) running at http://${host}:${port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async close(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 BlitzAPI server stopped');
          resolve();
        }
      });
    });
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
    const { res } = raw;

    if (res.headersSent) {
      return;
    }

    res.statusCode = statusCode;

    // Set headers
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    // Send body
    res.end(body);
  }

  /**
   * Parse request body from raw object
   */
  async parseBody(raw: any): Promise<unknown> {
    const { req } = raw;

    return new Promise((resolve, reject) => {
      const contentType = req.headers['content-type'] || '';
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const body = buffer.toString('utf-8');

          if (!body) {
            resolve(undefined);
            return;
          }

          // Parse JSON
          if (contentType.includes('application/json')) {
            resolve(JSON.parse(body));
            return;
          }

          // Parse URL-encoded
          if (contentType.includes('application/x-www-form-urlencoded')) {
            const params = new URLSearchParams(body);
            const result: Record<string, string> = {};
            params.forEach((value, key) => {
              result[key] = value;
            });
            resolve(result);
            return;
          }

          // Default: return raw string
          resolve(body);
        } catch (error) {
          reject(new Error('Failed to parse request body'));
        }
      });

      req.on('error', reject);
    });
  }
}

/**
 * Factory function to create NodeHTTPAdapter
 */
export function createNodeHTTPAdapter(_config?: Record<string, any>): ServerAdapter {
  return new NodeHTTPAdapter();
}
