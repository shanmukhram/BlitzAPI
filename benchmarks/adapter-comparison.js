/**
 * RamAPI Adapter Comparison Benchmark
 *
 * Compares performance between Node.js HTTP adapter and uWebSockets.js adapter
 *
 * Usage:
 *   node benchmarks/adapter-comparison.js
 *
 * Requirements:
 *   npm install autocannon
 */

import autocannon from 'autocannon';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

// Benchmark configuration
const DURATION = 10; // seconds
const CONNECTIONS = 100;
const PIPELINING = 10;
const WARMUP = 2; // seconds

// Servers to benchmark
const SERVERS = [
  {
    name: 'Node.js HTTP Adapter',
    script: 'example-app/adapters/node-http-server.ts',
    port: 3000,
    color: '\x1b[36m', // Cyan
  },
  {
    name: 'uWebSockets.js Adapter',
    script: 'example-app/adapters/uwebsockets-server.ts',
    port: 3001,
    color: '\x1b[35m', // Magenta
  },
];

// Test endpoints
const ENDPOINTS = [
  { path: '/json', name: 'Simple JSON' },
  { path: '/users/123', name: 'With Parameters' },
  { path: '/search?q=test', name: 'With Query' },
  { path: '/benchmark', name: 'Benchmark' },
];

/**
 * Start a server process
 */
async function startServer(server) {
  console.log(`Starting ${server.name}...`);

  const proc = spawn('npx', ['tsx', server.script], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
    cwd: process.cwd().replace('/benchmarks', ''), // Run from project root
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${server.name} failed to start in time`));
    }, 10000);

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('running at')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    proc.stderr.on('data', (data) => {
      console.error(`${server.name} error:`, data.toString());
    });

    proc.on('error', reject);
  });

  console.log(`✓ ${server.name} started on port ${server.port}`);
  return proc;
}

/**
 * Run benchmark for a specific endpoint
 */
async function runBenchmark(url, name) {
  console.log(`\n  Testing: ${name}`);
  console.log(`  URL: ${url}`);

  const result = await autocannon({
    url,
    duration: DURATION,
    connections: CONNECTIONS,
    pipelining: PIPELINING,
    bailout: 100, // Stop if 100 errors
  });

  return {
    name,
    requests: {
      average: result.requests.average,
      mean: result.requests.mean,
      stddev: result.requests.stddev,
      min: result.requests.min,
      max: result.requests.max,
      total: result.requests.total,
    },
    latency: {
      average: result.latency.mean,
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    throughput: {
      average: result.throughput.mean,
      total: result.throughput.total,
    },
    errors: result.errors,
    timeouts: result.timeouts,
  };
}

/**
 * Format results table
 */
function printResults(results) {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    BENCHMARK RESULTS                          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const allResults = {};

  // Group results by endpoint
  for (const [serverName, endpoints] of Object.entries(results)) {
    for (const endpoint of endpoints) {
      if (!allResults[endpoint.name]) {
        allResults[endpoint.name] = {};
      }
      allResults[endpoint.name][serverName] = endpoint;
    }
  }

  // Print results for each endpoint
  for (const [endpointName, serverResults] of Object.entries(allResults)) {
    console.log(`\n${endpointName}:`);
    console.log('─────────────────────────────────────────────────────────────');

    const headers = ['Metric', ...Object.keys(serverResults), 'Difference'];
    const rows = [];

    // Requests per second
    const rps = Object.values(serverResults).map((r) => r.requests.mean);
    const rpsMax = Math.max(...rps);
    const rpsMin = Math.min(...rps);
    const rpsDiff = rps.length > 1 ? ((rpsMax - rpsMin) / rpsMin * 100).toFixed(1) : '-';
    rows.push([
      'Req/sec',
      ...rps.map((r) => r.toFixed(0)),
      rps.length > 1 ? `${rpsDiff}%` : 'N/A',
    ]);

    // Latency p50
    const p50 = Object.values(serverResults).map((r) => r.latency.p50);
    const p50Min = Math.min(...p50);
    const p50Max = Math.max(...p50);
    const p50Diff = p50.length > 1 ? ((p50Max - p50Min) / p50Max * 100).toFixed(1) : '-';
    rows.push([
      'Latency p50',
      ...p50.map((l) => `${l.toFixed(2)}ms`),
      p50.length > 1 ? `${p50Diff}% faster` : 'N/A',
    ]);

    // Latency p95
    const p95 = Object.values(serverResults).map((r) => r.latency.p95);
    const p95Min = Math.min(...p95);
    const p95Max = Math.max(...p95);
    const p95Diff = p95.length > 1 ? ((p95Max - p95Min) / p95Max * 100).toFixed(1) : '-';
    rows.push([
      'Latency p95',
      ...p95.map((l) => `${l.toFixed(2)}ms`),
      p95.length > 1 ? `${p95Diff}% faster` : 'N/A',
    ]);

    // Latency p99
    const p99 = Object.values(serverResults).map((r) => r.latency.p99);
    const p99Min = Math.min(...p99);
    const p99Max = Math.max(...p99);
    const p99Diff = p99.length > 1 ? ((p99Max - p99Min) / p99Max * 100).toFixed(1) : '-';
    rows.push([
      'Latency p99',
      ...p99.map((l) => `${l.toFixed(2)}ms`),
      p99.length > 1 ? `${p99Diff}% faster` : 'N/A',
    ]);

    // Throughput
    const throughput = Object.values(serverResults).map((r) => r.throughput.average);
    const throughputMax = Math.max(...throughput);
    const throughputMin = Math.min(...throughput);
    const throughputDiff = throughput.length > 1 ? ((throughputMax - throughputMin) / throughputMin * 100).toFixed(1) : '-';
    rows.push([
      'Throughput',
      ...throughput.map((t) => `${(t / 1024 / 1024).toFixed(2)} MB/s`),
      throughput.length > 1 ? `${throughputDiff}%` : 'N/A',
    ]);

    // Print table
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => String(r[i]).length))
    );

    const printRow = (row) => {
      console.log(
        '  ' +
          row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('  │  ')
      );
    };

    printRow(headers);
    console.log('  ' + colWidths.map((w) => '─'.repeat(w)).join('──┼──'));
    rows.forEach(printRow);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Print summary
  const serverNames = Object.keys(results);
  if (serverNames.length === 2) {
    const [name1, name2] = serverNames;
    const results1 = results[name1];
    const results2 = results[name2];

    const avgRps1 =
      results1.reduce((sum, r) => sum + r.requests.mean, 0) / results1.length;
    const avgRps2 =
      results2.reduce((sum, r) => sum + r.requests.mean, 0) / results2.length;

    const faster = avgRps2 > avgRps1 ? name2 : name1;
    const slower = avgRps2 > avgRps1 ? name1 : name2;
    const speedup = ((Math.max(avgRps1, avgRps2) / Math.min(avgRps1, avgRps2))).toFixed(2);

    console.log('Summary:');
    console.log(`  ${faster} is ${speedup}x faster than ${slower}`);
    console.log('');
  }
}

/**
 * Main benchmark function
 */
async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       RamAPI Adapter Comparison Benchmark                   ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Duration: ${DURATION}s per endpoint`);
  console.log(`Connections: ${CONNECTIONS}`);
  console.log(`Pipelining: ${PIPELINING}`);
  console.log('');

  const results = {};
  const processes = [];

  try {
    // Start all servers
    for (const server of SERVERS) {
      try {
        const proc = await startServer(server);
        processes.push({ server, proc });
      } catch (error) {
        console.error(`Failed to start ${server.name}:`, error.message);
        if (server.name.includes('uWebSockets')) {
          console.log('Skipping uWebSockets.js adapter (not installed)');
          continue;
        } else {
          throw error;
        }
      }
    }

    // Warmup
    console.log(`\nWarming up servers (${WARMUP}s)...`);
    await sleep(WARMUP * 1000);

    // Run benchmarks
    for (const { server, proc } of processes) {
      console.log(`\n\n${server.color}Testing ${server.name}...\x1b[0m`);
      results[server.name] = [];

      for (const endpoint of ENDPOINTS) {
        const url = `http://localhost:${server.port}${endpoint.path}`;
        const result = await runBenchmark(url, endpoint.name);
        results[server.name].push(result);

        // Small delay between tests
        await sleep(1000);
      }
    }

    // Print results
    printResults(results);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  } finally {
    // Cleanup: Kill all server processes
    console.log('Stopping servers...');
    for (const { proc } of processes) {
      proc.kill();
    }

    // Wait a bit for cleanup
    await sleep(1000);
    console.log('Done!');
  }
}

// Run benchmark
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
