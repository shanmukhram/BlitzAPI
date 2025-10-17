// Test the overhead of JSON.stringify vs just setting a value

const http = require('http');

const data = { message: 'Hello, World!', timestamp: Date.now() };

// Test 1: Stringify immediately (our approach)
const server1 = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
});

// Test 2: Defer stringify (Koa's approach simulation)
const server2 = http.createServer((req, res) => {
  const body = data; // Just assign
  // Later in response handler:
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
});

console.log('Both approaches stringify at the same time...');
console.log('The issue must be elsewhere.');
console.log('\nLet me check HOW MANY function calls we make...\n');

// Our path:
console.log('BlitzAPI path:');
console.log('1. HTTP Server');
console.log('2. createContext() - creates ctx object');
console.log('3. handleRequest(ctx)');
console.log('4. router.handle(ctx)');
console.log('5. findRoute()');
console.log('6. route.handler(ctx)');
console.log('7. ctx.json(data) - user calls this');
console.log('8. res.end()');
console.log('Total: 8 steps\n');

// Koa's path:
console.log('Koa path:');
console.log('1. HTTP Server');
console.log('2. handleRequest()');
console.log('3. Single middleware function');
console.log('4. ctx.body = data - just assignment');
console.log('5. respond() - stringify and send');
console.log('Total: 5 steps\n');

console.log('DIFFERENCE: We have 3 extra function calls!');
console.log('- createContext()');
console.log('- router.handle()');
console.log('- findRoute()');
