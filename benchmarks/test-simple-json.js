/**
 * Test ONLY Simple JSON endpoint
 */
import { spawn } from 'child_process';
import autocannon from 'autocannon';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DURATION = 10;
const CONNECTIONS = 100;
const PIPELINING = 10;

const frameworks = [
  { name: 'RamAPI', file: 'servers/ramapi-server.js', port: 3000 },
  { name: 'Fastify', file: 'servers/fastify-server.js', port: 3002 },
  { name: 'Koa', file: 'servers/koa-server.js', port: 3003 },
];

function startServer(framework) {
  return new Promise((resolve) => {
    console.log(`Starting ${framework.name}...`);
    const proc = spawn('node', [join(__dirname, framework.file)], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, PORT: framework.port }
    });

    proc.stdout.on('data', (data) => {
      if (data.toString().includes('listening')) {
        setTimeout(() => resolve(proc), 500);
      }
    });

    setTimeout(() => resolve(proc), 2000);
  });
}

async function runBenchmark(framework) {
  const url = `http://localhost:${framework.port}/json`;

  return new Promise((resolve, reject) => {
    autocannon({
      url,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
      duration: DURATION,
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          framework: framework.name,
          requestsPerSecond: result.requests?.mean || result.requests?.average || 0,
          latency: result.latency?.mean || result.latency?.average || 0,
        });
      }
    });
  });
}

async function main() {
  console.log('🚀 Simple JSON Benchmark\n');
  console.log(`Duration: ${DURATION}s | Connections: ${CONNECTIONS} | Pipelining: ${PIPELINING}\n`);

  const procs = [];

  // Start servers
  for (const fw of frameworks) {
    const proc = await startServer(fw);
    procs.push(proc);
  }

  console.log('✅ All servers started\n');

  // Run benchmarks
  const results = [];
  for (const fw of frameworks) {
    process.stdout.write(`Testing ${fw.name}... `);
    const result = await runBenchmark(fw);
    results.push(result);
    console.log(`✓ ${result.requestsPerSecond.toFixed(0)} req/sec`);
  }

  // Sort by req/sec
  results.sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);

  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTS\n');
  results.forEach((r, i) => {
    const winner = i === 0 ? ' 🏆' : '';
    console.log(`${(i+1)}. ${r.framework.padEnd(15)} ${r.requestsPerSecond.toFixed(0).padStart(8)} req/sec${winner}`);
  });
  console.log('='.repeat(70) + '\n');

  // Cleanup
  procs.forEach(p => p.kill());
}

main().catch(console.error);
