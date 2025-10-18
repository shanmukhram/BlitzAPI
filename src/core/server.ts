import { createServer, Server as HTTPServer } from 'http';
import type { ServerConfig, Context } from './types.js';
import { Router } from './router.js';
import { createContext, createAdapterContext, parseBody } from './context.js';
import { HTTPError } from './types.js';
import { ProtocolManager, type ProtocolManagerConfig } from '../protocols/manager.js';
import { initializeTracing, shutdownTracing } from '../observability/tracer.js';
import { initializeLogger } from '../observability/logger.js';
import { initializeMetrics } from '../observability/metrics.js';
import { traceMiddleware } from '../observability/middleware.js';
import { initializeProfiling, profilingMiddleware } from '../observability/profiler/index.js';
import { createAdapter, type ServerAdapter } from '../adapters/index.js';

/**
 * RamAPI Server - The core HTTP server
 * Handles incoming requests and routes them through middleware and handlers
 *
 * Phase 3.3: Multiple HTTP adapters (Node.js http, uWebSockets.js)
 * Phase 3.4: Smart adapter selection - uWebSockets by default with intelligent fallback
 */
export class Server {
  private router: Router;
  private config: ServerConfig;
  private httpServer?: HTTPServer;
  private protocolManager?: ProtocolManager;
  private adapter?: ServerAdapter; // Phase 3.3: Server adapter
  private useAdapter: boolean; // Phase 3.3: Flag to use adapter pattern

  constructor(config: ServerConfig & { protocols?: ProtocolManagerConfig } = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      ...config,
    };
    this.router = new Router();

    // Phase 3.4: Smart adapter selection - ALWAYS use adapters by default
    this.useAdapter = true;

    // Initialize observability (Phase 3.0)
    // PERFORMANCE: Only enable if explicitly set to true
    if (config.observability?.tracing?.enabled === true) {
      initializeTracing(config.observability);
      initializeLogger(config.observability?.logging);
      initializeMetrics(config.observability?.metrics);

      // Auto-inject trace middleware as first middleware
      this.router.use(traceMiddleware());

      // Initialize profiling (Phase 3.1)
      if (config.observability?.profiling?.enabled === true) {
        initializeProfiling(config.observability.profiling);
        // Profiling middleware runs after tracing
        this.router.use(profilingMiddleware());
      }
    }

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
   * Handle incoming HTTP request (performance optimized)
   */
  private async handleRequest(ctx: Context): Promise<void> {
    try {
      // Parse body for POST/PUT/PATCH requests (optimized check)
      // Skip if already parsed (adapter mode)
      const method = ctx.method;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        if (!ctx.body && !this.useAdapter) {
          ctx.body = await parseBody(ctx.req);
        }
      }

      // Try protocol adapters first (GraphQL, etc.) - only if configured
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
   * Phase 3.3: Now supports both adapter and non-adapter modes
   *
   * Supports multiple signatures:
   * - listen()
   * - listen(port)
   * - listen(port, callback)
   * - listen(port, host)
   * - listen(port, host, callback)
   */
  async listen(port?: number | (() => void), host?: string | (() => void)): Promise<void> {
    // Handle callback in second position: listen(port, callback)
    let callback: (() => void) | undefined;
    let actualHost: string | undefined;

    if (typeof host === 'function') {
      callback = host;
      actualHost = undefined;
    } else {
      actualHost = host;
    }

    // Handle callback in first position: listen(callback)
    let actualPort: number | undefined;
    if (typeof port === 'function') {
      callback = port;
      actualPort = undefined;
    } else {
      actualPort = port;
    }

    const serverPort = actualPort || this.config.port || 3000;
    const serverHost = actualHost || this.config.host || '0.0.0.0';

    // Phase 3.3: Use adapter pattern if configured
    if (this.useAdapter) {
      await this.listenWithAdapter(serverPort, serverHost);
      if (callback) callback();
      return;
    }

    // Legacy mode: Direct Node.js http server
    this.httpServer = createServer(async (req, res) => {
      const ctx = createContext(req, res);
      await this.handleRequest(ctx);
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(serverPort, serverHost, async () => {
        console.log(`🚀 RamAPI server running at http://${serverHost}:${serverPort}`);

        // Start gRPC server if configured
        if (this.protocolManager) {
          await this.protocolManager.startGRPC();
        }

        resolve();
      });
    });
  }

  /**
   * Start server using adapter pattern (Phase 3.3 + 3.4)
   * Phase 3.4: Smart adapter selection with intelligent fallback
   */
  private async listenWithAdapter(port: number, host: string): Promise<void> {
    // Phase 3.4: Smart adapter selection
    this.adapter = this.selectAdapter(this.config);

    // Register request handler with adapter
    this.adapter.onRequest(async (requestInfo, rawRequest) => {
      try {
        // Create adapter-agnostic context
        const { ctx, responseBuffer } = createAdapterContext(requestInfo, rawRequest);

        // Parse body for POST/PUT/PATCH requests
        const method = ctx.method;
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          ctx.body = await this.adapter!.parseBody(rawRequest);
        }

        // Handle request through RamAPI
        await this.handleRequest(ctx);

        // Return response data to adapter
        return {
          statusCode: responseBuffer.statusCode,
          headers: responseBuffer.headers,
          body: responseBuffer.body || '',
        };
      } catch (error) {
        // Handle errors and return error response
        const err = error as Error;
        const statusCode = err instanceof HTTPError ? err.statusCode : 500;
        const message = err.message || 'Internal Server Error';

        return {
          statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: true,
            message,
            ...(err instanceof HTTPError && err.details ? { details: err.details } : {}),
            ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
          }),
        };
      }
    });

    // Start adapter listening
    await this.adapter.listen(port, host);

    // Start gRPC server if configured
    if (this.protocolManager) {
      await this.protocolManager.startGRPC();
    }
  }

  /**
   * Stop the HTTP server
   * Phase 3.3: Now supports both adapter and non-adapter modes
   */
  async close(): Promise<void> {
    // Stop gRPC server first
    if (this.protocolManager) {
      await this.protocolManager.stopGRPC();
    }

    // Shutdown observability (Phase 3.0)
    await shutdownTracing();

    // Phase 3.3: Close adapter if using adapter pattern
    if (this.adapter) {
      await this.adapter.close();
      this.adapter = undefined;
      return;
    }

    // Legacy mode: Close Node.js http server
    if (!this.httpServer) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.httpServer!.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 RamAPI server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Smart adapter selection (Phase 3.4)
   * Automatically selects the best adapter based on configuration and availability
   *
   * Priority:
   * 1. Explicit user configuration (config.adapter.type)
   * 2. Protocol requirements (gRPC needs Node.js)
   * 3. Try uWebSockets for maximum performance
   * 4. Fallback to Node.js HTTP
   */
  private selectAdapter(config: ServerConfig): ServerAdapter {
    // 1. If user explicitly configured an adapter, use it
    if (config.adapter?.type) {
      const adapterType = config.adapter.type;
      const adapterOptions = config.adapter.options || {};

      try {
        return createAdapter(adapterType, adapterOptions);
      } catch (error) {
        console.warn(`⚠️  Failed to create ${adapterType} adapter:`, (error as Error).message);
        console.log('📡 Falling back to Node.js HTTP adapter');
        return createAdapter('node-http');
      }
    }

    // 2. Check if protocols require Node.js HTTP
    if (this.needsNodeHTTP(config)) {
      console.log('📡 Using Node.js HTTP adapter (required for gRPC)');
      return createAdapter('node-http');
    }

    // 3. Try uWebSockets for maximum performance
    try {
      const adapter = createAdapter('uwebsockets');
      console.log('🚀 Using uWebSockets adapter for maximum performance');
      console.log('   💡 Tip: ~2-3x faster than Node.js HTTP');
      return adapter;
    } catch (error) {
      // uWebSockets not available, fallback to Node.js
      console.log('📡 Using Node.js HTTP adapter (uWebSockets not available)');
      console.log('   💡 Tip: Install uWebSockets.js for 2-3x performance boost');
      console.log('   npm install uWebSockets.js');
      return createAdapter('node-http');
    }
  }

  /**
   * Check if configuration requires Node.js HTTP adapter (Phase 3.4)
   *
   * @param config Server configuration
   * @returns true if Node.js HTTP is required
   */
  private needsNodeHTTP(config: ServerConfig): boolean {
    // gRPC requires Node.js http2 module
    // Note: In the future, we could run gRPC on a separate port
    // For now, if gRPC is enabled, use Node.js for everything
    const protocols = (config as ServerConfig & { protocols?: ProtocolManagerConfig }).protocols;

    if (protocols?.grpc) {
      // Check if grpc is an object with enabled property, or just truthy
      if (typeof protocols.grpc === 'object' && 'enabled' in protocols.grpc) {
        return protocols.grpc.enabled === true;
      }
      // If grpc is truthy but not an object, assume it's enabled
      return !!protocols.grpc;
    }

    // GraphQL works with both adapters
    // REST works with both adapters

    return false;
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
