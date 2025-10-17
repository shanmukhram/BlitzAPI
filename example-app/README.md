# BlitzAPI Examples

This directory contains comprehensive examples demonstrating all features of BlitzAPI.

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
```bash
npm run example:multi
```

Features demonstrated:
- Single codebase, multiple protocols
- REST + GraphQL + gRPC from one handler
- Protocol negotiation
- Shared business logic

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
