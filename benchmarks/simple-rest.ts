/**
 * Simple benchmark to ensure no performance regression
 */

import { createApp } from '../src/index.js';

const app = createApp();

app.get('/bench', async (ctx) => {
  ctx.json({ message: 'Hello, World!' });
});

const startTime = Date.now();
const server = await app.listen(3001, 'localhost');

console.log(`Server started in ${Date.now() - startTime}ms`);

// Simple benchmark
let successCount = 0;
const iterations = 10000;

console.log(`\nRunning ${iterations} requests...`);
const benchStart = Date.now();

for (let i = 0; i < iterations; i++) {
  try {
    const response = await fetch('http://localhost:3001/bench');
    if (response.ok) successCount++;
  } catch (err) {
    console.error('Request failed:', err);
  }
}

const benchDuration = Date.now() - benchStart;
const rps = Math.round((iterations / benchDuration) * 1000);

console.log(`\nBenchmark Results:`);
console.log(`  Total Requests: ${iterations}`);
console.log(`  Successful: ${successCount}`);
console.log(`  Duration: ${benchDuration}ms`);
console.log(`  Requests/sec: ${rps}`);
console.log(`  Avg latency: ${(benchDuration / iterations).toFixed(2)}ms`);

await app.close();
process.exit(0);
