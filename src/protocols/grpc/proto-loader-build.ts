/**
 * Build-time proto compiler for production mode
 * Pre-compiles proto files during npm run build
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Compile proto file at build time and save to cache
 */
export async function compileProtoAtBuildTime(
  protoPath: string,
  outputDir: string
): Promise<void> {
  // Load proto file
  const packageDefinition = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // Save compiled definition
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, 'compiled-protos.json');
  writeFileSync(outputPath, JSON.stringify(packageDefinition, null, 2));

  console.log(`✅ Compiled proto: ${protoPath} → ${outputPath}`);
}

/**
 * Load pre-compiled proto definition (production mode)
 */
export function loadCompiledProto(
  compiledPath: string,
  packageName: string,
  serviceName: string
): grpc.ServiceDefinition {
  if (!existsSync(compiledPath)) {
    throw new Error(
      `Compiled proto not found: ${compiledPath}. Run 'npm run build' first.`
    );
  }

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

  return serviceObj.service as grpc.ServiceDefinition;
}
