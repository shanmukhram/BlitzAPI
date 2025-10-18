/**
 * Build-time proto compiler for production mode
 * Pre-compiles proto files during build for zero-overhead runtime
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Operation } from '../types.js';

/**
 * Generate and compile proto files at build time
 * This creates both the .proto file and the compiled JSON
 */
export async function generateAndCompileProto(
  packageName: string,
  serviceName: string,
  operations: Operation[],
  outputDir: string
): Promise<string> {
  // 1. Generate proto file content (same as runtime)
  const protoContent = buildProtoFile(packageName, serviceName, operations);

  // 2. Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 3. Write proto file
  const protoPath = join(outputDir, `${serviceName}.proto`);
  writeFileSync(protoPath, protoContent);
  console.log(`📝 Generated proto file: ${protoPath}`);

  // 4. Load and compile proto file
  const packageDefinition = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // 5. Save compiled definition as JSON for fast loading
  const compiledPath = join(outputDir, `${serviceName}.compiled.json`);
  writeFileSync(compiledPath, JSON.stringify(packageDefinition, null, 2));
  console.log(`✅ Compiled proto: ${compiledPath}`);

  return compiledPath;
}

/**
 * Build proto file content from operations
 * (Duplicate from proto-loader-runtime.ts for build independence)
 */
function buildProtoFile(
  packageName: string,
  serviceName: string,
  operations: Operation[]
): string {
  const messages: string[] = [];
  const serviceMethods: string[] = [];

  for (const op of operations) {
    if (!op.grpc) continue;

    // Generate input message
    let inputMessage = 'google.protobuf.Empty';
    if (op.input) {
      const inputTypeName = `${capitalize(op.name)}Request`;
      messages.push(zodToProtoMessage(inputTypeName, op.input));
      inputMessage = inputTypeName;
    }

    // Generate output message
    let outputMessage = 'google.protobuf.Empty';
    if (op.output) {
      const outputTypeName = `${capitalize(op.name)}Response`;
      messages.push(zodToProtoMessage(outputTypeName, op.output));
      outputMessage = outputTypeName;
    }

    // Add service method
    serviceMethods.push(
      `  rpc ${op.grpc.method}(${inputMessage}) returns (${outputMessage});`
    );
  }

  return `syntax = "proto3";

package ${packageName};

import "google/protobuf/empty.proto";

${messages.join('\n\n')}

service ${serviceName} {
${serviceMethods.join('\n')}
}
`;
}

/**
 * Convert Zod schema to proto message definition
 */
function zodToProtoMessage(name: string, schema: any): string {
  const def = schema._def;

  if (def.typeName !== 'ZodObject') {
    return `message ${name} {\n  string value = 1;\n}`;
  }

  const shape = def.shape();
  const fields: string[] = [];
  let fieldNumber = 1;

  for (const [key, value] of Object.entries(shape)) {
    const protoType = zodToProtoType(value as any);
    fields.push(`  ${protoType} ${key} = ${fieldNumber};`);
    fieldNumber++;
  }

  return `message ${name} {\n${fields.join('\n')}\n}`;
}

/**
 * Convert Zod type to proto type
 */
function zodToProtoType(zodSchema: any): string {
  const def = zodSchema._def;
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
      return zodToProtoType(def.innerType);
    case 'ZodNullable':
      return zodToProtoType(def.innerType);
    case 'ZodDefault':
      return zodToProtoType(def.innerType);
    default:
      return 'string';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Load pre-compiled proto definition (production mode)
 * This is ultra-fast because it just reads JSON - no parsing needed
 */
export function loadCompiledProto(
  packageName: string,
  serviceName: string,
  compiledDir: string = join(process.cwd(), '.ramapi', 'protos')
): grpc.ServiceDefinition {
  const compiledPath = join(compiledDir, `${serviceName}.compiled.json`);

  if (!existsSync(compiledPath)) {
    throw new Error(
      `❌ Compiled proto not found: ${compiledPath}\n` +
      `   Run 'npm run build:protos' first or set NODE_ENV=development for auto-generation.`
    );
  }

  // Load pre-compiled package definition (instant!)
  const packageDefinition = JSON.parse(readFileSync(compiledPath, 'utf-8'));
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

  const packageObj = protoDescriptor[packageName] as any;
  if (!packageObj) {
    throw new Error(`Package ${packageName} not found in compiled proto`);
  }

  const serviceObj = packageObj[serviceName];
  if (!serviceObj || !serviceObj.service) {
    throw new Error(`Service ${serviceName} not found in package ${packageName}`);
  }

  console.log(`⚡ Loaded pre-compiled proto: ${serviceName} (zero-overhead!)`);
  return serviceObj.service as grpc.ServiceDefinition;
}

/**
 * Get list of all compiled proto services
 */
export function getCompiledServices(
  compiledDir: string = join(process.cwd(), '.ramapi', 'protos')
): string[] {
  if (!existsSync(compiledDir)) {
    return [];
  }

  return readdirSync(compiledDir)
    .filter(file => file.endsWith('.compiled.json'))
    .map(file => file.replace('.compiled.json', ''));
}
