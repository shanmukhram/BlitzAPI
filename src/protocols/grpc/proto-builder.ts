/**
 * Protocol Buffers schema builder
 * Generates .proto files from operations
 */

import type { ZodSchema } from 'zod';
import type { Operation } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Convert Zod schema to Proto message definition
 */
export function zodToProtoMessage(name: string, zodSchema: ZodSchema): string {
  const def = (zodSchema as any)._def;
  const typeName = def.typeName;

  if (typeName === 'ZodObject') {
    const shape = def.shape();
    const fields: string[] = [];
    let fieldNumber = 1;

    for (const [key, value] of Object.entries(shape)) {
      const protoType = zodToProtoType(value as ZodSchema);
      fields.push(`  ${protoType} ${key} = ${fieldNumber};`);
      fieldNumber++;
    }

    return `message ${name} {\n${fields.join('\n')}\n}`;
  }

  return `message ${name} {\n  string data = 1;\n}`;
}

/**
 * Convert Zod type to Proto type
 */
function zodToProtoType(zodSchema: ZodSchema): string {
  const def = (zodSchema as any)._def;
  const typeName = def.typeName;

  switch (typeName) {
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'double';
    case 'ZodBoolean':
      return 'bool';
    case 'ZodArray':
      return `repeated ${zodToProtoType(def.type)}`;
    case 'ZodOptional':
      return `optional ${zodToProtoType(def.innerType)}`;
    default:
      return 'string';
  }
}

/**
 * Build .proto file from operations
 */
export function buildProtoFile(
  packageName: string,
  serviceName: string,
  operations: Operation[]
): string {
  const messages: string[] = [];
  const methods: string[] = [];

  for (const op of operations) {
    if (!op.grpc) continue;

    // Generate request message
    if (op.input) {
      const requestName = `${capitalize(op.name)}Request`;
      messages.push(zodToProtoMessage(requestName, op.input));
    }

    // Generate response message
    if (op.output) {
      const responseName = `${capitalize(op.name)}Response`;
      messages.push(zodToProtoMessage(responseName, op.output));
    }

    // Generate RPC method
    const requestType = op.input ? `${capitalize(op.name)}Request` : 'google.protobuf.Empty';
    const responseType = op.output ? `${capitalize(op.name)}Response` : 'google.protobuf.Empty';

    methods.push(`  rpc ${capitalize(op.name)} (${requestType}) returns (${responseType});`);
  }

  const proto = `
syntax = "proto3";

package ${packageName};

${messages.join('\n\n')}

service ${serviceName} {
${methods.join('\n')}
}
  `.trim();

  return proto;
}

/**
 * Save proto file to disk
 */
export async function saveProtoFile(
  filePath: string,
  packageName: string,
  serviceName: string,
  operations: Operation[]
): Promise<void> {
  const proto = buildProtoFile(packageName, serviceName, operations);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, proto, 'utf-8');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
