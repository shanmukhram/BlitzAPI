/**
 * GraphQL schema builder
 * Automatically generates GraphQL schema from operations
 */

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLFieldConfigMap,
  type GraphQLFieldConfig,
  type GraphQLInputType,
} from 'graphql';
import type { ZodSchema, ZodType } from 'zod';
import type { Operation } from '../types.js';

/**
 * Convert Zod schema to GraphQL type
 */
export function zodToGraphQLType(zodSchema: ZodSchema): any {
  const def = (zodSchema as any)._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodString':
      return GraphQLString;

    case 'ZodNumber':
      return GraphQLFloat;

    case 'ZodBoolean':
      return GraphQLBoolean;

    case 'ZodArray':
      return new GraphQLList(zodToGraphQLType(def.type));

    case 'ZodObject':
      const fields: GraphQLFieldConfigMap<any, any> = {};
      const shape = def.shape();

      for (const [key, value] of Object.entries(shape)) {
        fields[key] = {
          type: zodToGraphQLType(value as ZodType),
        };
      }

      return new GraphQLObjectType({
        name: 'Generated_' + Math.random().toString(36).substr(2, 9),
        fields,
      });

    case 'ZodOptional':
      return zodToGraphQLType(def.innerType);

    case 'ZodNullable':
      return zodToGraphQLType(def.innerType);

    default:
      return GraphQLString; // Fallback
  }
}

/**
 * Build GraphQL schema from operations
 */
export function buildGraphQLSchema(operations: Operation[]): GraphQLSchema {
  const queries: GraphQLFieldConfigMap<any, any> = {};
  const mutations: GraphQLFieldConfigMap<any, any> = {};

  for (const op of operations) {
    if (!op.graphql) continue;

    const field: GraphQLFieldConfig<any, any> = {
      type: op.output ? zodToGraphQLType(op.output) : GraphQLString,
      description: op.description,
      args: {},
      resolve: async (_source, args, context) => {
        return await op.handler(args, context.ctx);
      },
    };

    // Add input arguments
    if (op.input) {
      const inputType = zodToGraphQLType(op.input);
      if (inputType instanceof GraphQLObjectType) {
        const inputFields = inputType.getFields();
        for (const [name, fieldConfig] of Object.entries(inputFields)) {
          field.args![name] = { type: fieldConfig.type as GraphQLInputType };
        }
      } else {
        field.args!['input'] = { type: inputType as GraphQLInputType };
      }
    }

    if (op.graphql.type === 'query') {
      queries[op.name] = field;
    } else if (op.graphql.type === 'mutation') {
      mutations[op.name] = field;
    }
  }

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: Object.keys(queries).length > 0 ? queries : {
        _empty: { type: GraphQLString, resolve: () => 'No queries defined' }
      },
    }),
    mutation: Object.keys(mutations).length > 0
      ? new GraphQLObjectType({
          name: 'Mutation',
          fields: mutations,
        })
      : undefined,
  });

  return schema;
}
