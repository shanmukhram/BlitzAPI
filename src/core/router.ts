import type {
  Route,
  RouterConfig,
  Handler,
  Middleware,
  HTTPMethod,
  Context,
} from './types.js';
import { HTTPError } from './types.js';

/**
 * Compiled route with pre-parsed pattern
 */
interface CompiledRoute extends Route {
  compiled: {
    parts: string[];
    isDynamic: boolean;
    paramIndices: number[];
  };
}

/**
 * Router class - manages routes and middleware
 * Supports nested routers, route prefixes, and middleware composition
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Static route map for O(1) exact-match lookups
 * - Pre-compiled route patterns (parsed at registration time)
 * - Separate storage for static vs dynamic routes
 */
export class Router {
  private routes: Route[] = [];
  private config: RouterConfig;

  // PERFORMANCE: Static route map for O(1) lookup
  private staticRoutes = new Map<string, Map<HTTPMethod, Route>>();
  // PERFORMANCE: Dynamic routes only (for fallback)
  private dynamicRoutes: CompiledRoute[] = [];
  // PERFORMANCE: Last route cache (hot path optimization)
  private lastRouteKey: string = '';
  private lastRoute: Route | null = null;
  private lastParams: Record<string, string> = {};

  constructor(config: RouterConfig = {}) {
    this.config = config;
  }

  /**
   * Split path into parts (optimized for route compilation)
   */
  private splitPathParts(path: string): string[] {
    const parts: string[] = [];
    let start = path[0] === '/' ? 1 : 0;
    for (let i = start; i <= path.length; i++) {
      if (i === path.length || path[i] === '/') {
        if (i > start) {
          parts.push(path.slice(start, i));
        }
        start = i + 1;
      }
    }
    return parts;
  }

  /**
   * Check if path has dynamic segments
   */
  private isDynamicPath(path: string): boolean {
    return path.includes(':');
  }

  /**
   * Pre-compile middleware chain into single handler (ULTRA-OPTIMIZED)
   */
  private compileMiddlewareChain(middleware: Middleware[], handler: Handler): Handler {
    if (middleware.length === 0) {
      // FAST PATH: No middleware - return handler directly (zero overhead!)
      return handler;
    }

    if (middleware.length === 1) {
      // Single middleware - simplest possible execution
      const mw = middleware[0];
      return async (ctx: Context) => mw(ctx, async () => handler(ctx));
    }

    // Multiple middleware - optimized composition
    return async (ctx: Context) => {
      let index = 0;
      const next = async (): Promise<void> => {
        if (index < middleware.length) {
          await middleware[index++](ctx, next);
        } else if (index === middleware.length) {
          index++;
          await handler(ctx);
        }
      };
      await next();
    };
  }

  /**
   * Register a route (with performance optimizations)
   */
  private addRoute(
    method: HTTPMethod,
    path: string,
    ...handlers: (Handler | Middleware)[]
  ): this {
    const fullPath = this.config.prefix
      ? `${this.config.prefix}${path}`
      : path;

    // Last function is the handler, everything else is middleware
    const handler = handlers[handlers.length - 1] as Handler;
    const middleware = handlers.slice(0, -1) as Middleware[];

    // PERFORMANCE: Combine global + route middleware
    const allMiddleware = [
      ...(this.config.middleware || []),
      ...middleware,
    ];

    // PERFORMANCE: Pre-compile the entire middleware chain
    const compiledHandler = this.compileMiddlewareChain(allMiddleware, handler);

    const route: Route = {
      method,
      path: fullPath,
      handler: compiledHandler, // Use pre-compiled handler
      middleware: [], // Empty - already compiled into handler
    };

    // Keep backwards compatibility
    this.routes.push(route);

    // PERFORMANCE: Separate static and dynamic routes
    const isDynamic = this.isDynamicPath(fullPath);

    if (!isDynamic) {
      // Static route - add to O(1) lookup map
      if (!this.staticRoutes.has(fullPath)) {
        this.staticRoutes.set(fullPath, new Map());
      }
      this.staticRoutes.get(fullPath)!.set(method, route);
    } else {
      // Dynamic route - pre-compile pattern
      const parts = this.splitPathParts(fullPath);
      const paramIndices: number[] = [];

      for (let i = 0; i < parts.length; i++) {
        if (parts[i].charCodeAt(0) === 58) { // ':' character
          paramIndices.push(i);
        }
      }

      this.dynamicRoutes.push({
        ...route,
        compiled: {
          parts,
          isDynamic: true,
          paramIndices,
        },
      });
    }

    return this;
  }

  /**
   * HTTP method shortcuts
   */
  get(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('GET', path, ...handlers);
  }

  post(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('POST', path, ...handlers);
  }

  put(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('PUT', path, ...handlers);
  }

  patch(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('PATCH', path, ...handlers);
  }

  delete(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('DELETE', path, ...handlers);
  }

  options(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('OPTIONS', path, ...handlers);
  }

  head(path: string, ...handlers: (Handler | Middleware)[]): this {
    return this.addRoute('HEAD', path, ...handlers);
  }

  /**
   * Register all HTTP methods for a path
   */
  all(path: string, ...handlers: (Handler | Middleware)[]): this {
    const methods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    methods.forEach((method) => {
      this.addRoute(method, path, ...handlers);
    });
    return this;
  }

  /**
   * Mount another router with prefix
   */
  use(prefix: string, router: Router): this;
  use(middleware: Middleware): this;
  use(prefixOrMiddleware: string | Middleware, router?: Router): this {
    if (typeof prefixOrMiddleware === 'function') {
      // Global middleware
      if (!this.config.middleware) {
        this.config.middleware = [];
      }
      this.config.middleware.push(prefixOrMiddleware);
    } else if (router) {
      // Nested router
      const prefix = this.config.prefix
        ? `${this.config.prefix}${prefixOrMiddleware}`
        : prefixOrMiddleware;

      router.routes.forEach((route) => {
        this.routes.push({
          ...route,
          path: `${prefix}${route.path}`,
        });
      });
    }

    return this;
  }

  /**
   * Find matching route for given method and path (ULTRA-FAST with cache)
   */
  findRoute(
    method: HTTPMethod,
    path: string
  ): { route: Route; params: Record<string, string> } | null {
    // PERFORMANCE: Check last route cache first (hot path!)
    const routeKey = method + path;
    if (this.lastRouteKey === routeKey && this.lastRoute) {
      return { route: this.lastRoute, params: this.lastParams };
    }

    // PERFORMANCE: Try static routes - O(1) lookup
    const staticMethodMap = this.staticRoutes.get(path);
    if (staticMethodMap) {
      const route = staticMethodMap.get(method);
      if (route) {
        // Cache it
        this.lastRouteKey = routeKey;
        this.lastRoute = route;
        this.lastParams = {};
        return { route, params: {} };
      }
    }

    // PERFORMANCE: Only search dynamic routes
    const pathParts = this.splitPathParts(path);
    const pathLength = pathParts.length;

    for (const compiledRoute of this.dynamicRoutes) {
      if (compiledRoute.method !== method) {
        continue;
      }

      const { parts } = compiledRoute.compiled;

      // Quick length check
      if (parts.length !== pathLength) {
        continue;
      }

      // Match parts and extract params
      const params: Record<string, string> = {};
      let matches = true;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part.charCodeAt(0) === 58) { // ':' - dynamic segment
          const paramName = part.slice(1);
          params[paramName] = pathParts[i];
        } else if (part !== pathParts[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        // Cache dynamic route too
        this.lastRouteKey = routeKey;
        this.lastRoute = compiledRoute;
        this.lastParams = params;
        return { route: compiledRoute, params };
      }
    }

    return null;
  }

  /**
   * Execute route handler (PERFORMANCE OPTIMIZED - middleware pre-compiled)
   */
  async handle(ctx: Context): Promise<void> {
    const match = this.findRoute(ctx.method, ctx.path);

    if (!match) {
      throw new HTTPError(404, `Route not found: ${ctx.method} ${ctx.path}`);
    }

    const { route, params } = match;

    // Add params to context
    ctx.params = params;

    // PERFORMANCE: Handler already has middleware compiled in
    // Just call it directly - no chain execution needed
    await route.handler(ctx);
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return this.routes;
  }

  /**
   * Group routes with shared prefix and middleware
   */
  group(prefix: string, fn: (router: Router) => void): this {
    const groupRouter = new Router({
      prefix: this.config.prefix
        ? `${this.config.prefix}${prefix}`
        : prefix,
      middleware: this.config.middleware,
    });

    fn(groupRouter);

    this.routes.push(...groupRouter.routes);

    return this;
  }
}
