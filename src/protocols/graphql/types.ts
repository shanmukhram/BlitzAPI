/**
 * GraphQL protocol types
 */

import type { GraphQLFieldResolver } from 'graphql';
import type { Operation } from '../types.js';

/**
 * GraphQL configuration
 */
export interface GraphQLConfig {
  path?: string; // Default: /graphql
  playground?: boolean; // Enable GraphQL Playground
  introspection?: boolean; // Enable schema introspection
  schemaPath?: string; // Path to save generated schema
}

/**
 * GraphQL operation metadata
 */
export interface GraphQLOperation extends Operation {
  graphql: {
    type: 'query' | 'mutation' | 'subscription';
    typeName?: string; // Custom GraphQL type name
  };
}

/**
 * GraphQL field configuration
 */
export interface GraphQLField {
  type: string;
  args?: Record<string, any>;
  resolve: GraphQLFieldResolver<any, any>;
  description?: string;
}
