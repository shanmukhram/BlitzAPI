/**
 * Runtime proto loader for development mode
 * Dynamically loads and compiles proto files
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Operation } from '../types.js';
import { buildProtoFile } from './proto-builder.js';

/**
 * Load proto definition at runtime (development mode)
 */
export async function loadProtoRuntime(
  packageName: string,
  serviceName: string,
  operations: Operation[]
): Promise<grpc.ServiceDefinition> {
  // Generate proto file content
  const protoContent = buildProtoFile(packageName, serviceName, operations);

  // Write to temporary file
  const tempDir = join(tmpdir(), 'ramapi-protos');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const protoPath = join(tempDir, `${serviceName}.proto`);
  writeFileSync(protoPath, protoContent);

  // Load proto file
  const packageDefinition = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // Load package definition
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

  // Navigate to service definition
  const packageObj = protoDescriptor[packageName] as any;
  if (!packageObj) {
    throw new Error(`Package ${packageName} not found in proto`);
  }

  const serviceObj = packageObj[serviceName];
  if (!serviceObj || !serviceObj.service) {
    throw new Error(`Service ${serviceName} not found in package ${packageName}`);
  }

  return serviceObj.service as grpc.ServiceDefinition;
}
