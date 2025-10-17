/**
 * BlitzAPI gRPC Example
 * Demonstrates gRPC protocol support
 */

import { z } from 'zod';
import { createApp, type Operation } from '../../src/index.js';

// ============================================================================
// 1. DATA MODELS
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// In-memory data store
const users: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', createdAt: new Date() },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', createdAt: new Date() },
];

let userIdCounter = 3;

// ============================================================================
// 2. VALIDATION SCHEMAS
// ============================================================================

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.date().transform(d => d.toISOString()), // gRPC needs string dates
});

const GetUserSchema = z.object({
  id: z.string(),
});

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const ListUsersSchema = z.object({}).optional();

// ============================================================================
// 3. DEFINE OPERATIONS
// ============================================================================

const operations: Operation[] = [
  // gRPC: GetUser
  {
    name: 'getUser',
    description: 'Get a user by ID',
    input: GetUserSchema,
    output: UserSchema.nullable(),
    handler: async (input) => {
      const user = users.find((u) => u.id === input.id);
      return user || null;
    },
    grpc: {
      service: 'UserService',
      method: 'GetUser',
    },
  },

  // gRPC: ListUsers
  {
    name: 'listUsers',
    description: 'List all users',
    input: ListUsersSchema,
    output: z.array(UserSchema),
    handler: async () => {
      return users;
    },
    grpc: {
      service: 'UserService',
      method: 'ListUsers',
    },
  },

  // gRPC: CreateUser
  {
    name: 'createUser',
    description: 'Create a new user',
    input: CreateUserSchema,
    output: UserSchema,
    handler: async (input) => {
      const newUser: User = {
        id: String(userIdCounter++),
        ...input,
        createdAt: new Date(),
      };
      users.push(newUser);
      return newUser;
    },
    grpc: {
      service: 'UserService',
      method: 'CreateUser',
    },
  },

  // gRPC: DeleteUser
  {
    name: 'deleteUser',
    description: 'Delete a user',
    input: GetUserSchema,
    output: z.boolean(),
    handler: async (input) => {
      const index = users.findIndex((u) => u.id === input.id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    },
    grpc: {
      service: 'UserService',
      method: 'DeleteUser',
    },
  },
];

// ============================================================================
// 4. CREATE SERVER WITH gRPC
// ============================================================================

const app = createApp({
  protocols: {
    grpc: {
      port: 50051,
    },
  },
});

// Register operations with gRPC
const protocolManager = app.getProtocolManager();

for (const operation of operations) {
  if (protocolManager) {
    protocolManager.registerOperation(operation);
  }
}

// ============================================================================
// 5. PRINT GENERATED PROTO FILE
// ============================================================================

const grpcAdapter = protocolManager?.getGRPCAdapter();
if (grpcAdapter) {
  const protoContent = grpcAdapter.getProtoFile('blitzapi.users', 'UserService');

  console.log('📝 Generated Protocol Buffer Definition:');
  console.log('='.repeat(60));
  console.log(protoContent);
  console.log('='.repeat(60));
  console.log('');
}

// ============================================================================
// 6. START SERVER
// ============================================================================

app.listen(3000, '0.0.0.0').then(() => {
  console.log('');
  console.log('👥 User Service - gRPC Example');
  console.log('');
  console.log('gRPC Service running at: localhost:50051');
  console.log('');
  console.log('Test with grpcurl:');
  console.log('');
  console.log('  # List services');
  console.log('  grpcurl -plaintext localhost:50051 list');
  console.log('');
  console.log('  # Get user');
  console.log('  grpcurl -plaintext -d \'{"id": "1"}\' localhost:50051 UserService/GetUser');
  console.log('');
  console.log('  # List users');
  console.log('  grpcurl -plaintext localhost:50051 UserService/ListUsers');
  console.log('');
  console.log('  # Create user');
  console.log('  grpcurl -plaintext -d \'{"name": "Jane Doe", "email": "jane@example.com"}\' \\');
  console.log('    localhost:50051 UserService/CreateUser');
  console.log('');
  console.log('💡 Note: gRPC runs on a separate server from HTTP/REST');
  console.log('');
});
