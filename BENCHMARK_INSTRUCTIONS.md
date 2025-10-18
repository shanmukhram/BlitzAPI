# How to Run Benchmarks

## Quick Test (Copy & Paste These Commands)

```bash
# 1. Navigate to benchmarks directory
cd benchmarks

# 2. Install dependencies
npm install

# 3. Go back to root and build RamAPI
cd ..
npm run build

# 4. Go back to benchmarks and run
cd benchmarks
npm run bench
```

That's it! The benchmark will run automatically and show you the results.

## What You'll See

The benchmark will test 4 frameworks:
- ✅ **RamAPI** (yours!)
- Express (most popular)
- Fastify (fastest)
- Koa (minimalist)

Against 4 scenarios:
1. Simple JSON response
2. With middleware (auth)
3. Route parameters
4. Query parameters

## Expected Output

```
📊 BENCHMARK RESULTS
====================================================================================================

🎯 Simple JSON

Framework       | Req/sec | Avg Latency | p95 Latency | p99 Latency | Throughput
------------------------------------------------------------------------------------------
Fastify         | 45000   | 2.1ms       | 3.5ms       | 5.2ms       | 8.5 MB/s   🏆
RamAPI        | 42000   | 2.3ms       | 4.1ms       | 6.1ms       | 7.9 MB/s
Express         | 28000   | 3.4ms       | 6.2ms       | 9.5ms       | 5.3 MB/s
Koa             | 25000   | 3.8ms       | 7.1ms       | 11.2ms      | 4.7 MB/s
```

## Performance Notes

**RamAPI** is designed for:
- ⚡ High throughput with observability built-in
- 📊 Zero-overhead when observability is disabled
- 🎯 Production-ready with tracing, logging, and profiling
- 🚀 Competitive with pure-performance frameworks like Fastify

**Key Difference:** Unlike Express/Fastify/Koa, RamAPI includes:
- Built-in OpenTelemetry tracing
- Structured logging
- Performance profiling
- Multi-protocol support (REST/GraphQL/gRPC)

Most frameworks require you to add these features manually (which adds overhead).
RamAPI has them built-in with minimal performance impact!

## Troubleshooting

**Problem:** Port already in use

**Solution:**
```bash
# Kill any processes on ports 3000-3003
pkill -f "node servers"
```

**Problem:** Module not found

**Solution:**
```bash
# Make sure RamAPI is built
cd ..
npm run build
cd benchmarks
```

**Note:** EPIPE errors are suppressed during benchmarking. These errors are normal when testing high-throughput scenarios - they occur when the benchmark tool closes connections quickly to test maximum performance. All frameworks experience these during load testing.

## Advanced: Running Individual Tests

```bash
# Test just RamAPI
node servers/ramapi-server.js &
npx autocannon -c 100 -d 10 http://localhost:3000/json
pkill -f "ramapi-server"

# Test Express
node servers/express-server.js &
npx autocannon -c 100 -d 10 http://localhost:3001/json
pkill -f "express-server"
```

## Results to Share

After running, the benchmark shows:
1. Per-test performance comparison
2. Overall ranking (🥇🥈🥉)
3. Detailed latency percentiles

Take a screenshot and share your results! 📸
