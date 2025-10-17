import type {
  Route,
  RouterConfig,
  Handler,
  Middleware,
  HTTPMethod,
  Context,
} from './types.js';
import { matchPath } from '../utils/url.js';
import { HTTPError } from './types.js';

/**
 * Router class - manages routes and middleware
 * Supports nested routers, route prefixes, and middleware composition
 */
export class Router {
  private routes: Route[] = [];
  private config: RouterConfig;

  constructor(config: RouterConfig = {}) {
    this.config = config;
  }

  /**
   * Register a route
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

    this.routes.push({
      method,
      path: fullPath,
      handler,
      middleware: [
        ...(this.config.middleware || []),
        ...middleware,
      ],
    });

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
   * Find matching route for given method and path
   */
  findRoute(
    method: HTTPMethod,
    path: string
  ): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue;
      }

      const match = matchPath(route.path, path);
      if (match.matches) {
        return { route, params: match.params };
      }
    }

    return null;
  }

  /**
   * Execute route handler with middleware chain
   */
  async handle(ctx: Context): Promise<void> {
    const match = this.findRoute(ctx.method, ctx.path);

    if (!match) {
      throw new HTTPError(404, `Route not found: ${ctx.method} ${ctx.path}`);
    }

    const { route, params } = match;

    // Add params to context
    ctx.params = params;

    // Build middleware chain
    const middleware = route.middleware || [];
    const allMiddleware = [...middleware, route.handler as Middleware];

    // Execute middleware chain
    await this.executeMiddleware(ctx, allMiddleware);
  }

  /**
   * Execute middleware chain with proper composition
   */
  private async executeMiddleware(
    ctx: Context,
    middleware: Middleware[]
  ): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= middleware.length) {
        return;
      }

      const fn = middleware[index];
      index++;

      await fn(ctx, next);
    };

    await next();
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
