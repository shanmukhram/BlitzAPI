# Multi-Protocol Example

The ultimate demonstration of RamAPI's power: **One codebase, three protocols!**

## What This Demonstrates

This example shows how a single operation definition can simultaneously support:
- **REST** - Traditional HTTP/JSON API
- **GraphQL** - Query language with playground
- **gRPC** - High-performance RPC

All three protocols share the same:
- Business logic
- Data models
- Validation rules
- Data store

Changes made via one protocol are immediately visible in the others!

## Running

```bash
npm run example:multi
```

## Testing All Protocols

### REST
```bash
# List products
curl http://localhost:3000/products

# Get product
curl http://localhost:3000/products/1

# Create product
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":79.99,"category":"Electronics","inStock":true}'
```

### GraphQL
```bash
# Query (or use playground at http://localhost:3000/graphql)
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ listProducts { id name price } }"}'

# Mutation
curl -X POST http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createProduct(name: \"Monitor\", price: 299.99, category: \"Electronics\", inStock: true) { id name } }"}'
```

### gRPC
```bash
# List products
grpcurl -plaintext localhost:50051 ProductService/ListProducts

# Get product
grpcurl -plaintext -d '{"id": "1"}' localhost:50051 ProductService/GetProduct

# Create product
grpcurl -plaintext -d '{"name": "Chair", "price": 149.99, "category": "Furniture", "inStock": true}' \
  localhost:50051 ProductService/CreateProduct
```

## Key Benefits

1. **Write Once, Deploy Everywhere** - Define your operations once, get all protocols
2. **Consistent Business Logic** - No duplication between protocols
3. **Shared Validation** - Zod schemas work across all protocols
4. **Protocol Migration** - Easy to add/remove protocols without changing business logic
5. **Client Flexibility** - Different clients can use different protocols

## Use Cases

- **Microservices**: Use gRPC for service-to-service, REST for external APIs
- **Mobile Apps**: GraphQL for flexible queries, REST for simple operations
- **Web Apps**: GraphQL for complex UIs, REST for simple CRUD
- **Legacy Integration**: Support REST for legacy clients, gRPC for new services

## Architecture

```
┌─────────────────────────────────────────┐
│         Operation Definition             │
│  (Business Logic + Validation)           │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│  REST   │  │GraphQL  │  │  gRPC   │
│ :3000   │  │ :3000   │  │ :50051  │
└─────────┘  └─────────┘  └─────────┘
```

This is the future of API development!
