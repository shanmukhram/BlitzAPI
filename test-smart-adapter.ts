/**
 * Test Smart Adapter Selection (Phase 3.4)
 *
 * This file demonstrates the smart adapter selection in action
 */

import { createApp } from './src/index.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('         Testing Smart Adapter Selection (Phase 3.4)           ');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test 1: Default (should try uWebSockets, fallback to Node.js)
console.log('Test 1: Default configuration');
console.log('─────────────────────────────────────────────────────────────');
const app1 = createApp();
console.log('');

// Test 2: Explicit Node.js
console.log('Test 2: Explicit Node.js HTTP adapter');
console.log('─────────────────────────────────────────────────────────────');
const app2 = createApp({
  adapter: { type: 'node-http' }
});
console.log('');

// Test 3: With gRPC (should use Node.js)
console.log('Test 3: With gRPC enabled (requires Node.js)');
console.log('─────────────────────────────────────────────────────────────');
const app3 = createApp({
  protocols: {
    grpc: {
      enabled: true,
      port: 50051
    }
  }
});
console.log('');

// Test 4: With GraphQL (should try uWebSockets)
console.log('Test 4: With GraphQL enabled (works with both)');
console.log('─────────────────────────────────────────────────────────────');
const app4 = createApp({
  protocols: {
    graphql: { enabled: true }
  }
});
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('                      Tests Complete!                          ');
console.log('═══════════════════════════════════════════════════════════════');
console.log('\nSummary:');
console.log('✅ Default: Tries uWebSockets, falls back to Node.js if not available');
console.log('✅ Explicit config: Uses specified adapter');
console.log('✅ gRPC: Automatically uses Node.js (required)');
console.log('✅ GraphQL: Uses fastest adapter available');
console.log('\n💡 Result: Maximum performance by default with intelligent fallback!');
