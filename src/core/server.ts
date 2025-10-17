import { createServer, Server as HTTPServer } from 'http';
import type { ServerConfig, Context } from './types.js';
import { Router } from './router.js';
import { createContext, parseBody } from './context.js';
import { HTTPError } from './types.js';
import { ProtocolManager, type ProtocolManagerConfig } from '../protocols/manager.js';

/**
 * BlitzAPI Server - The core HTTP server
 * Handles incoming requests and routes them through middleware and handlers
 */
export class Server {
  private router: Router;
  private config: ServerConfig;
  private httpServer?: HTTPServer;
  private protocolManager?: ProtocolManager;

  constructor(config: ServerConfig & { protocols?: ProtocolManagerConfig } = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      ...config,
    };
    this.router = new Router();

    // Apply global middleware
    if (this.config.middleware) {
      this.config.middleware.forEach((mw) => this.router.use(mw));
    }

    // Initialize protocol manager if protocols are configured
    if (config.protocols) {
      this.protocolManager = new ProtocolManager(config.protocols);
    }
  }

  /**
   * Expose router methods
   */
  get(...args: Parameters<Router['get']>): this {
    this.router.get(...args);
    return this;
  }

  post(...args: Parameters<Router['post']>): this {
    this.router.post(...args);
    return this;
  }

  put(...args: Parameters<Router['put']>): this {
    this.router.put(...args);
    return this;
  }

  patch(...args: Parameters<Router['patch']>): this {
    this.router.patch(...args);
    return this;
  }

  delete(...args: Parameters<Router['delete']>): this {
    this.router.delete(...args);
    return this;
  }

  options(...args: Parameters<Router['options']>): this {
    this.router.options(...args);
    return this;
  }

  head(...args: Parameters<Router['head']>): this {
    this.router.head(...args);
    return this;
  }

  all(...args: Parameters<Router['all']>): this {
    this.router.all(...args);
    return this;
  }

  use(prefixOrMiddleware: any, router?: any): this {
    if (typeof prefixOrMiddleware === 'string' && router) {
      this.router.use(prefixOrMiddleware, router);
    } else if (typeof prefixOrMiddleware === 'function') {
      this.router.use(prefixOrMiddleware);
    }
    return this;
  }

  group(...args: Parameters<Router['group']>): this {
    this.router.group(...args);
    return this;
  }

  /**
   * Get the underlying router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(ctx: Context): Promise<void> {
    try {
      // Parse body for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
        ctx.body = await parseBody(ctx.req);
      }

      // Try protocol adapters first (GraphQL, etc.)
      if (this.protocolManager) {
        const handled = await this.protocolManager.handle(ctx);
        if (handled) {
          return; // Protocol adapter handled the request
        }
      }

      // Fall through to REST routing
      await this.router.handle(ctx);

      // If response wasn't sent, send 204 No Content
      if (!ctx.res.headersSent) {
        ctx.status(204);
        ctx.res.end();
      }
    } catch (error) {
      await this.handleError(error, ctx);
    }
  }

  /**
   * Handle errors with custom error handler or default
   */
  private async handleError(error: unknown, ctx: Context): Promise<void> {
    const err = error as Error;

    // Use custom error handler if provided
    if (this.config.onError) {
      try {
        await this.config.onError(err, ctx);
        return;
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Default error handling
    const statusCode = err instanceof HTTPError ? err.statusCode : 500;
    const message = err.message || 'Internal Server Error';

    if (!ctx.res.headersSent) {
      ctx.json(
        {
          error: true,
          message,
          ...(err instanceof HTTPError && err.details
            ? { details: err.details }
            : {}),
          ...(process.env.NODE_ENV !== 'production'
            ? { stack: err.stack }
            : {}),
        },
        statusCode
      );
    }
  }

  /**
   * Start the HTTP server
   */
  async listen(port?: number, host?: string): Promise<void> {
    const serverPort = port || this.config.port || 3000;
    const serverHost = host || this.config.host || '0.0.0.0';

    this.httpServer = createServer(async (req, res) => {
      const ctx = createContext(req, res);
      await this.handleRequest(ctx);
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(serverPort, serverHost, async () => {
        console.log(`🚀 BlitzAPI server running at http://${serverHost}:${serverPort}`);

        // Start gRPC server if configured
        if (this.protocolManager) {
          await this.protocolManager.startGRPC();
        }

        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async close(): Promise<void> {
    // Stop gRPC server first
    if (this.protocolManager) {
      await this.protocolManager.stopGRPC();
    }

    if (!this.httpServer) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.httpServer!.close((err) => {
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
   * Get protocol manager
   */
  getProtocolManager(): ProtocolManager | undefined {
    return this.protocolManager;
  }
}

/**
 * Factory function to create a new server instance
 */
export function createApp(config?: ServerConfig): Server {
  return new Server(config);
}
