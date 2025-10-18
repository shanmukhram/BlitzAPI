# RamAPI Examples

This directory contains comprehensive examples demonstrating all features of RamAPI.

## Structure

```
example-app/
├── rest/              # REST API examples (Phase 1)
│   ├── server.ts      # Todo API with authentication
│   └── test-api.sh    # Test script
├── graphql/           # GraphQL examples (Phase 2)
│   ├── server.ts      # Library API with queries & mutations
│   └── test.sh        # GraphQL test script
├── grpc/              # gRPC examples (Phase 2)
│   ├── server.ts      # gRPC service example
│   ├── proto/         # Protocol buffer definitions
│   └── test.sh        # gRPC test script
└── multi-protocol/    # Multi-protocol examples
    ├── server.ts      # Single API supporting REST, GraphQL, and gRPC
    └── test.sh        # Comprehensive test script
```

## Running Examples

### REST API (Phase 1)
```bash
npm run example:rest
```

Features demonstrated:
- User registration & authentication
- JWT tokens
- Password hashing
- Protected routes
- CRUD operations
- Request validation
- Rate limiting

### GraphQL API (Phase 2)
```bash
npm run example:graphql
```

Features demonstrated:
- GraphQL queries
- GraphQL mutations
- Automatic schema generation from Zod
- GraphQL Playground
- Type-safe operations
- Shared data with REST

### gRPC API (Phase 2)
```bash
npm run example:grpc
```

Features demonstrated:
- gRPC service definitions
- Protocol Buffers
- Bidirectional streaming
- Type-safe RPC calls

### Multi-Protocol (Phase 2)

**Development Mode** (auto-generates protos at runtime):
```bash
npm run example:multi
```

**Production Mode** (uses pre-compiled protos for zero overhead):
```bash
# 1. Build proto files (run once or in CI/CD)
npm run build:protos

# 2. Run in production mode
npm run example:multi:prod
```

Features demonstrated:
- Single codebase, multiple protocols
- REST + GraphQL + gRPC from one handler
- Protocol negotiation
- Shared business logic
- Hybrid approach: automatic in dev, zero-overhead in production

## Production Deployment

### Building for Production

RamAPI uses a hybrid approach for gRPC proto files:

1. **Build TypeScript and compile proto files:**
```bash
npm run build:protos
```

This will:
- Compile TypeScript to `dist/`
- Generate proto files from your Zod schemas
- Pre-compile protos to `.ramapi/protos/*.compiled.json`

2. **Deploy with NODE_ENV=production:**
```bash
NODE_ENV=production node dist/your-server.js
```

In production mode:
- ⚡ **Zero overhead** - Pre-compiled protos load instantly
- 🚀 **Maximum performance** - No runtime proto generation
- 📦 **Portable** - Compiled protos work anywhere

### CI/CD Pipeline Example

```yaml
# .github/workflows/deploy.yml
- name: Build application
  run: npm run build:protos

- name: Deploy to production
  env:
    NODE_ENV: production
  run: npm start
```

**Note:** The `.ramapi/` directory is gitignored but should be included in your deployment artifacts.

## Testing

Each example includes a test script:

```bash
# Test REST
./example-app/rest/test-api.sh

# Test GraphQL
./example-app/graphql/test.sh

# Test gRPC
./example-app/grpc/test.sh

# Test all protocols
./example-app/multi-protocol/test.sh
```

## Learn More

- [Main README](../README.md) - Framework documentation
- [Phase 1 Guide](../PHASE1_COMPLETE.md) - REST API features
- [Quick Reference](../QUICK_REFERENCE.md) - API reference
