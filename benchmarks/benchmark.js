/**
 * BlitzAPI vs Express vs Fastify vs Koa Benchmark
 *
 * Tests:
 * 1. Simple JSON response
 * 2. JSON with middleware (auth simulation)
 * 3. Route parameters
 * 4. Query parameters
 */

import { spawn } from 'child_process';
import autocannon from 'autocannon';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Benchmark configuration
const DURATION = 5; // seconds
const CONNECTIONS = 100;
const PIPELINING = 10;

const frameworks = [
  { name: 'BlitzAPI', file: 'servers/blitzapi-server.js', port: 3000 },
  { name: 'Express', file: 'servers/express-server.js', port: 3001 },
  { name: 'Fastify', file: 'servers/fastify-server.js', port: 3002 },
  { name: 'Koa', file: 'servers/koa-server.js', port: 3003 },
  { name: 'Hapi', file: 'servers/hapi-server.js', port: 3004 },
  { name: 'Hyper-Express', file: 'servers/hyper-express-server.js', port: 3005, isUWebSocket: true },
];

const tests = [
  { name: 'Simple JSON', path: '/json' },
  { name: 'With Middleware', path: '/with-middleware', headers: { authorization: 'Bearer token' } },
  { name: 'Route Params', path: '/users/123' },
  { name: 'Query Params', path: '/search?q=test&limit=10' },
];

// Check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Kill process using a port
async function killPort(port) {
  return new Promise((resolve) => {
    const killCommand = process.platform === 'win32' 
      ? `netstat -ano | findstr :${port} | findstr LISTENING`
      : `lsof -ti:${port}`;
    
    const killer = spawn(process.platform === 'win32' ? 'cmd' : 'sh', 
      process.platform === 'win32' ? ['/c', killCommand] : ['-c', `${killCommand} | xargs kill -9 2>/dev/null`]);
    
    killer.on('exit', () => resolve());
    setTimeout(() => {
      killer.kill();
      resolve();
    }, 1000);
  });
}

// Helper to wait for server to be ready via HTTP check
async function waitForServer(port, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/json`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      }).catch((err) => {
        if (i === 0) console.log(`  [Attempt ${i + 1}] Fetch failed:`, err.message);
        return null;
      });

      if (response && response.ok) {
        console.log(`  ✓ Server responding on port ${port} (attempt ${i + 1})`);
        return true;
      } else if (response) {
        console.log(`  [Attempt ${i + 1}] Response not OK:`, response.status);
      }
    } catch (err) {
      if (i === 0) console.log(`  [Attempt ${i + 1}] Error:`, err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log(`  ✗ Server on port ${port} not responding after ${maxAttempts} attempts`);
  return false;
}

// Helper to start server
function startServer(framework) {
  return new Promise(async (resolve, reject) => {
    // Skip spawning if marked (e.g., BlitzAPI must be started manually)
    if (framework.skipSpawn) {
      console.log(`Checking ${framework.name} server on port ${framework.port} (must be started manually)...`);
      const isReady = await waitForServer(framework.port, 5);
      if (isReady) {
        console.log(`✓ ${framework.name} server is running`);
        resolve({ skipCleanup: true }); // Don't try to kill this process
      } else {
        console.error(`✗ ${framework.name} server not found. Please start it manually first.`);
        reject(new Error(`${framework.name} server not running`));
      }
      return;
    }

    // Check if port is in use first
    const portInUse = await isPortInUse(framework.port);
    if (portInUse) {
      console.log(`⚠️  Port ${framework.port} is in use, attempting to free it...`);
      await killPort(framework.port);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Starting ${framework.name} server on port ${framework.port}...`);

    const serverPath = join(__dirname, framework.file);
    const serverDir = dirname(serverPath);

    // BlitzAPI uses uWebSockets which needs 'inherit' stdio to work properly
    const useInheritStdio = framework.name === 'BlitzAPI';

    // Don't change cwd for BlitzAPI - it causes issues with uWebSockets
    const spawnOptions = {
      stdio: useInheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: framework.port }
    };

    // Only set cwd for non-uWebSocket servers
    if (!useInheritStdio) {
      spawnOptions.cwd = serverDir;
    }

    const proc = spawn('node', [serverPath], spawnOptions);

    let serverStarted = false;
    let serverFailed = false;
    let serverOutput = '';
    let errorOutput = '';

    // Handle stdout (only if not using inherit stdio)
    if (!useInheritStdio && proc.stdout) {
      proc.stdout.on('data', (data) => {
        const text = data.toString();
        serverOutput += text;

        // Check for startup messages
        const output = text.toLowerCase();
        if (output.includes('listening') ||
            output.includes('ready') ||
            output.includes('running') ||
            output.includes('started') ||
            output.includes(`port ${framework.port}`) ||
            output.includes(`:${framework.port}`)) {
          serverStarted = true;
        }
      });
    }

    // Handle stderr (only if not using inherit stdio)
    if (!useInheritStdio && proc.stderr) {
      proc.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;

        // Check for failure messages
        if (text.toLowerCase().includes('failed to listen') ||
            text.toLowerCase().includes('error: failed') ||
            text.toLowerCase().includes('eaddrinuse')) {
          serverFailed = true;
        }

        // Some servers log success to stderr
        const output = text.toLowerCase();
        if (output.includes('listening') ||
            output.includes('ready') ||
            output.includes('running') ||
            output.includes('started')) {
          serverStarted = true;
        }
      });
    }

    // Handle process errors
    proc.on('error', (err) => {
      console.error(`Failed to start ${framework.name}: ${err.message}`);
      serverFailed = true;
      reject(err);
    });

    // Handle process exit
    proc.on('exit', (code, signal) => {
      if (code !== 0 && code !== null && !serverStarted) {
        console.error(`${framework.name} exited with code ${code}`);
        if (errorOutput) {
          console.error('Error output:', errorOutput);
        }
        serverFailed = true;
      }
    });

    // Special handling for uWebSocket-based servers or servers with inherited stdio
    if (framework.isUWebSocket || useInheritStdio) {
      setTimeout(async () => {
        if (serverFailed) {
          console.error(`✗ ${framework.name} server failed to start`);
          proc.kill();
          reject(new Error(`${framework.name} server failed to start`));
          return;
        }

        const isReady = await waitForServer(framework.port, 30);
        if (isReady) {
          console.log(`✓ ${framework.name} server ready (verified by HTTP check)`);
          resolve(proc);
        } else {
          console.error(`✗ ${framework.name} server failed to start`);
          console.error('Server output:', serverOutput);
          proc.kill();
          reject(new Error(`${framework.name} server failed to start`));
        }
      }, 3000);
    } else {
      // For traditional Node.js servers
      let checkCount = 0;
      const checkInterval = setInterval(async () => {
        checkCount++;
        
        // If server explicitly failed, stop trying
        if (serverFailed) {
          clearInterval(checkInterval);
          console.error(`✗ ${framework.name} server failed to start (error detected)`);
          proc.kill();
          reject(new Error(`${framework.name} server failed to start`));
          return;
        }
        
        if (serverStarted) {
          clearInterval(checkInterval);
          // Verify it's actually responding
          const isReady = await waitForServer(framework.port, 5);
          if (isReady) {
            console.log(`✓ ${framework.name} server ready`);
            resolve(proc);
          } else {
            console.error(`✗ ${framework.name} server started but not responding`);
            proc.kill();
            reject(new Error(`${framework.name} server not responding`));
          }
        } else if (checkCount >= 15) {
          // After 3 seconds, try HTTP check as fallback
          clearInterval(checkInterval);
          const isReady = await waitForServer(framework.port, 10);
          
          if (isReady) {
            console.log(`✓ ${framework.name} server ready (verified by HTTP check)`);
            resolve(proc);
          } else {
            console.error(`✗ ${framework.name} server failed to start (timeout)`);
            console.error('Server output:', serverOutput);
            console.error('Error output:', errorOutput);
            proc.kill();
            reject(new Error(`${framework.name} server failed to start`));
          }
        }
      }, 200);
    }
  });
}

// Helper to run benchmark
async function runBenchmark(framework, test) {
  const url = `http://localhost:${framework.port}${test.path}`;

  return new Promise((resolve, reject) => {
    autocannon({
      url,
      connections: CONNECTIONS,
      pipelining: PIPELINING,
      duration: DURATION,
      headers: test.headers || {},
      timeout: 10,
      bailout: 1000,
      idReplacement: false,
    }, (err, result) => {
      if (err) {
        console.error(`Benchmark error for ${framework.name} on ${test.name}:`, err.message);
        resolve({
          framework: framework.name,
          test: test.name,
          requestsPerSecond: 0,
          latency: {
            average: 0,
            p50: 0,
            p95: 0,
            p99: 0,
          },
          throughput: 0,
          errors: -1,
        });
      } else {
        resolve({
          framework: framework.name,
          test: test.name,
          requestsPerSecond: result.requests?.mean || result.requests?.average || 0,
          latency: {
            average: result.latency?.mean || result.latency?.average || 0,
            p50: result.latency?.p50 || 0,
            p95: result.latency?.p95 || 0,
            p99: result.latency?.p99 || 0,
          },
          throughput: result.throughput?.mean || result.throughput?.average || 0,
          errors: result.errors || 0,
          non2xx: result.non2xx || 0,
          timeouts: result.timeouts || 0,
        });
      }
    });
  });
}

// Format results
function formatResults(results) {
  console.log('\n' + '='.repeat(100));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(100) + '\n');

  // Group by test
  const byTest = {};
  results.forEach(r => {
    if (!byTest[r.test]) byTest[r.test] = [];
    byTest[r.test].push(r);
  });

  // Print each test
  Object.entries(byTest).forEach(([testName, testResults]) => {
    console.log(`\n🎯 ${testName}\n`);
    console.log('Framework       | Req/sec | Avg Latency | p95 Latency | p99 Latency | Throughput | Errors');
    console.log('-'.repeat(100));

    // Sort by requests per second (descending)
    testResults.sort((a, b) => b.requestsPerSecond - a.requestsPerSecond);

    testResults.forEach((r, index) => {
      const reqSec = (r.requestsPerSecond || 0).toFixed(0).padEnd(7);
      const avgLat = `${(r.latency?.average || 0).toFixed(2)}ms`.padEnd(11);
      const p95Lat = `${(r.latency?.p95 || 0).toFixed(2)}ms`.padEnd(11);
      const p99Lat = `${(r.latency?.p99 || 0).toFixed(2)}ms`.padEnd(11);
      const throughput = `${((r.throughput || 0) / 1024 / 1024).toFixed(2)} MB/s`.padEnd(10);
      const errors = r.errors === -1 ? 'FAILED' : r.errors.toString();
      const winner = index === 0 && r.requestsPerSecond > 0 ? ' 🏆' : '';

      console.log(`${r.framework.padEnd(15)} | ${reqSec} | ${avgLat} | ${p95Lat} | ${p99Lat} | ${throughput} | ${errors.padEnd(6)}${winner}`);
      
      if (r.non2xx > 0 || r.timeouts > 0) {
        console.log(`                   └─ Non-2xx: ${r.non2xx}, Timeouts: ${r.timeouts}`);
      }
    });
  });

  // Overall winner
  console.log('\n' + '='.repeat(100));
  console.log('🏆 OVERALL PERFORMANCE RANKING\n');

  const avgScores = {};
  Object.entries(byTest).forEach(([testName, testResults]) => {
    const validResults = testResults.filter(r => r.requestsPerSecond > 0);
    validResults.forEach((r, index) => {
      if (!avgScores[r.framework]) avgScores[r.framework] = 0;
      avgScores[r.framework] += (validResults.length - index);
    });
  });

  const ranked = Object.entries(avgScores)
    .sort((a, b) => b[1] - a[1])
    .map(([name, score]) => ({ name, score }));

  if (ranked.length === 0) {
    console.log('No frameworks completed successfully');
  } else {
    ranked.forEach((r, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      console.log(`${medal} ${(index + 1)}. ${r.name.padEnd(15)} (Score: ${r.score})`);
    });
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

// Clean up any existing servers on our ports
async function cleanupPorts() {
  console.log('🧹 Checking for processes on benchmark ports...');
  for (const framework of frameworks) {
    const inUse = await isPortInUse(framework.port);
    if (inUse) {
      console.log(`  Killing process on port ${framework.port}...`);
      await killPort(framework.port);
    }
  }
  // Wait a bit for ports to be fully released
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Main
async function main() {
  console.log('🚀 BlitzAPI Benchmark Suite');
  console.log('='.repeat(100));
  console.log(`Duration: ${DURATION}s | Connections: ${CONNECTIONS} | Pipelining: ${PIPELINING}`);
  console.log(`Node version: ${process.version}\n`);

  // Clean up any existing processes on our ports
  await cleanupPorts();

  const results = [];
  const serverProcesses = [];

  try {
    // Start all servers
    for (const framework of frameworks) {
      try {
        const proc = await startServer(framework);
        serverProcesses.push({ proc, framework });
      } catch (err) {
        console.error(`Failed to start ${framework.name}, skipping...`);
      }
    }

    if (serverProcesses.length === 0) {
      console.error('No servers could be started!');
      process.exit(1);
    }

    console.log(`\n✅ ${serverProcesses.length}/${frameworks.length} servers started`);

    // Give servers a moment to stabilize
    console.log('⏳ Waiting for servers to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run benchmarks
    for (const test of tests) {
      console.log(`\n📊 Running test: ${test.name}`);

      for (const { framework } of serverProcesses) {
        process.stdout.write(`  Testing ${framework.name}... `);

        try {
          const result = await runBenchmark(framework, test);
          results.push(result);
          if (result.requestsPerSecond > 0) {
            console.log(`✓ ${result.requestsPerSecond.toFixed(0)} req/sec`);
          } else {
            console.log(`✗ Failed`);
          }
        } catch (error) {
          console.log(`✗ Error: ${error.message}`);
        }
      }
    }

    // Print results
    formatResults(results);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up servers...');
    for (const { proc, framework } of serverProcesses) {
      // Skip cleanup for manually started servers
      if (proc && proc.skipCleanup) {
        console.log(`  Skipping ${framework.name} (manually started)`);
        continue;
      }
      if (proc && !proc.killed) {
        console.log(`  Stopping ${framework.name}...`);
        proc.kill('SIGTERM');
        // Force kill after 2 seconds if not terminated
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 2000);
      }
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✨ Done!');
    process.exit(0);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Terminated, cleaning up...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

main().catch(console.error);