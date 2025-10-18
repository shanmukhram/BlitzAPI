# RamAPI Benchmark Suite

Compare RamAPI performance against Express, Fastify, and Koa.

## Setup

```bash
cd benchmarks
npm install
```

## Run Benchmarks

```bash
npm run bench
```

This will:
1. Start all 4 framework servers (RamAPI, Express, Fastify, Koa)
2. Run 4 different tests on each framework
3. Display comparative results
4. Cleanup automatically

## Tests

1. **Simple JSON** - Basic JSON response
2. **With Middleware** - Response with auth middleware
3. **Route Params** - Route parameter extraction
4. **Query Params** - Query parameter parsing

## Configuration

Edit `benchmark.js` to adjust:
- `DURATION` - Test duration in seconds (default: 10)
- `CONNECTIONS` - Concurrent connections (default: 100)
- `PIPELINING` - Pipeline factor (default: 10)

## Expected Results

RamAPI is optimized for:
- Zero-copy request handling
- Minimal middleware overhead
- Fast route matching
- Direct JSON serialization

Typical performance (your results may vary):
- **vs Express**: ~1.5-2x faster
- **vs Koa**: ~2-2.5x faster
- **vs Fastify**: Similar performance (Fastify is highly optimized)

## Manual Testing

You can also test individually:

```bash
# Terminal 1 - Start RamAPI
node servers/ramapi-server.js

# Terminal 2 - Benchmark
npx autocannon -c 100 -d 10 http://localhost:3000/json
```

## Metrics Explained

- **Req/sec**: Requests per second (higher is better)
- **Avg Latency**: Average response time in ms (lower is better)
- **p95 Latency**: 95th percentile latency (lower is better)
- **p99 Latency**: 99th percentile latency (lower is better)
- **Throughput**: Data transferred per second
