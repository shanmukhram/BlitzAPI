/**
 * GraphQL protocol adapter
 * Handles GraphQL requests and maps them to operations
 */

import { graphql, type GraphQLSchema } from 'graphql';
import type { Context } from '../../core/types.js';
import type { ProtocolAdapter, Operation } from '../types.js';
import type { GraphQLConfig } from './types.js';
import { buildGraphQLSchema } from './schema-builder.js';
import { HTTPError } from '../../core/types.js';

/**
 * GraphQL adapter
 */
export class GraphQLAdapter implements ProtocolAdapter {
  protocol = 'GraphQL' as const;
  private operations: Operation[] = [];
  private schema?: GraphQLSchema;
  private config: Required<GraphQLConfig>;

  constructor(config: GraphQLConfig = {}) {
    this.config = {
      path: config.path || '/graphql',
      playground: config.playground ?? true,
      introspection: config.introspection ?? true,
      schemaPath: config.schemaPath || '',
    };
  }

  /**
   * Register an operation
   */
  register(operation: Operation): void {
    if (!operation.graphql) {
      throw new Error(`Operation ${operation.name} does not have GraphQL metadata`);
    }
    this.operations.push(operation);
    // Rebuild schema
    this.schema = undefined;
  }

  /**
   * Get GraphQL schema (lazy build)
   */
  getSchema(): GraphQLSchema {
    if (!this.schema) {
      this.schema = buildGraphQLSchema(this.operations);
    }
    return this.schema;
  }

  /**
   * Handle GraphQL request
   */
  async handle(ctx: Context): Promise<void> {
    // Only handle GraphQL path
    if (!ctx.path.startsWith(this.config.path)) {
      return;
    }

    // Handle GET requests for playground
    if (ctx.method === 'GET' && this.config.playground) {
      ctx.setHeader('Content-Type', 'text/html');
      ctx.res.end(this.getPlaygroundHTML());
      return;
    }

    // Handle POST requests for queries
    if (ctx.method !== 'POST') {
      throw new HTTPError(405, 'Method not allowed. Use POST for GraphQL queries.');
    }

    const { query, variables, operationName } = ctx.body as {
      query: string;
      variables?: Record<string, any>;
      operationName?: string;
    };

    if (!query) {
      throw new HTTPError(400, 'GraphQL query is required');
    }

    try {
      const schema = this.getSchema();

      // Execute GraphQL query
      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
        operationName,
        contextValue: { ctx }, // Pass context to resolvers
      });

      ctx.json(result);
    } catch (error) {
      const err = error as Error;
      ctx.json({
        errors: [{ message: err.message }],
      }, 400);
    }
  }

  /**
   * Get GraphQL Playground HTML
   */
  private getPlaygroundHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RamAPI GraphQL Playground</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
  <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('load', function (event) {
      GraphQLPlayground.init(document.getElementById('root'), {
        endpoint: '${this.config.path}',
        settings: {
          'request.credentials': 'same-origin',
        },
      })
    })
  </script>
</body>
</html>
    `.trim();
  }

  /**
   * Get schema as SDL (Schema Definition Language)
   */
  getSchemaSDL(): string {
    const { printSchema } = require('graphql');
    return printSchema(this.getSchema());
  }
}
