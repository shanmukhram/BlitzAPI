# Smart Adapter Strategy: Maximum Performance by Default

**Problem:** Users want maximum speed, but also need protocol features (gRPC, GraphQL, etc.)

**Solution:** **uWebSockets by default**, automatic fallback to Node.js HTTP when needed

---

## Strategy Overview

### Default Behavior (NEW)

```typescript
const app = createApp(); // Automatically uses uWebSockets if available!
```

**Logic:**
1. Try uWebSockets first (2-3x faster)
2. If uWebSockets not installed → fallback to Node.js HTTP
3. If protocols need Node.js → use Node.js HTTP
4. User can override with explicit config

---

## Implementation Plan

### Phase 1: Smart Default Selection

```typescript
// src/core/server.ts

constructor(config: ServerConfig) {
  // Smart adapter selection
  this.adapter = this.selectAdapter(config);
}

private selectAdapter(config: ServerConfig): ServerAdapter {
  // 1. If user explicitly configured, use that
  if (config.adapter?.type) {
    return createAdapter(config.adapter.type, config.adapter.options);
  }

  // 2. Check if protocols need Node.js
  if (this.needsNodeHTTP(config)) {
    console.log('📡 Using Node.js HTTP adapter (required for gRPC)');
    return createAdapter('node-http');
  }

  // 3. Try uWebSockets for maximum performance
  try {
    console.log('🚀 Using uWebSockets adapter for maximum performance');
    return createAdapter('uwebsockets');
  } catch (error) {
    // 4. Fallback to Node.js HTTP
    console.log('📡 Using Node.js HTTP adapter (uWebSockets not available)');
    return createAdapter('node-http');
  }
}

private needsNodeHTTP(config: ServerConfig): boolean {
  // gRPC requires Node.js http2
  if (config.protocols?.grpc) {
    return true;
  }

  // GraphQL works with both
  // REST works with both

  return false;
}
```

### Phase 2: Protocol-Specific Ports

For maximum performance, separate protocols can use different adapters:

```typescript
const app = createApp({
  // REST/GraphQL on uWebSockets (fast!)
  adapter: { type: 'uwebsockets' },
  port: 3000,

  // gRPC on separate port with Node.js
  protocols: {
    grpc: {
      port: 50051,  // Separate port for gRPC
      enabled: true
    }
  }
});
```

**Architecture:**
```
Port 3000 (uWebSockets)
   ├─ REST API (ultra-fast)
   └─ GraphQL (ultra-fast)

Port 50051 (Node.js HTTP2)
   └─ gRPC
```

### Phase 3: Hybrid Mode

For ultimate flexibility:

```typescript
const app = createApp({
  adapter: {
    type: 'hybrid',  // NEW!
    config: {
      rest: 'uwebsockets',      // REST on uWS
      graphql: 'uwebsockets',    // GraphQL on uWS
      grpc: 'node-http'          // gRPC on Node.js
    }
  }
});
```

---

## User Experience Examples

### Example 1: Pure REST API (Maximum Speed)

```typescript
const app = createApp(); // Automatically uses uWebSockets!

app.get('/api/users', (ctx) => {
  ctx.json({ users: [] });
});

await app.listen(3000);
// 🚀 Using uWebSockets adapter for maximum performance
// 🚀 BlitzAPI server (uwebsockets) running at http://0.0.0.0:3000
```

**Performance: ~350k req/s** ⚡

### Example 2: REST + GraphQL (Still Fast)

```typescript
const app = createApp({
  protocols: {
    graphql: { enabled: true }
  }
});

app.get('/api/users', (ctx) => {
  ctx.json({ users: [] });
});

await app.listen(3000);
// 🚀 Using uWebSockets adapter for maximum performance
// 🚀 BlitzAPI server (uwebsockets) running at http://0.0.0.0:3000
```

**Performance: ~350k req/s** ⚡

### Example 3: REST + gRPC (Auto-fallback)

```typescript
const app = createApp({
  protocols: {
    grpc: {
      enabled: true,
      port: 50051  // gRPC on separate port
    }
  }
});

app.get('/api/users', (ctx) => {
  ctx.json({ users: [] });
});

await app.listen(3000);
// 🚀 Using uWebSockets adapter for maximum performance (REST)
// 📡 Starting gRPC server on port 50051 (Node.js)
```

**Performance:**
- REST: ~350k req/s (uWebSockets) ⚡
- gRPC: ~100k req/s (Node.js HTTP2) ✅

### Example 4: Everything (Optimized)

```typescript
const app = createApp({
  adapter: { type: 'uwebsockets' },  // Main server
  protocols: {
    graphql: { enabled: true },       // On main server (fast)
    grpc: {
      enabled: true,
      port: 50051                      // Separate port (compatible)
    }
  }
});

await app.listen(3000);
// 🚀 Using uWebSockets adapter for maximum performance
// 🚀 BlitzAPI server (uwebsockets) running at http://0.0.0.0:3000
// 🚀 GraphQL Playground: http://0.0.0.0:3000/graphql
// 📡 gRPC server running on port 50051
```

**Performance:**
- REST: ~350k req/s ⚡
- GraphQL: ~350k req/s ⚡
- gRPC: ~100k req/s ✅

---

## Decision Matrix

| Scenario | Default Adapter | Reasoning |
|----------|----------------|-----------|
| No protocols | uWebSockets | Maximum speed |
| GraphQL only | uWebSockets | GraphQL works with uWS |
| gRPC only | Node.js | gRPC needs http2 |
| REST + GraphQL | uWebSockets | Both work with uWS |
| REST + gRPC | Hybrid (uWS + Node) | Separate ports |
| Everything | Hybrid (uWS + Node) | Separate ports |

---

## Benefits

### 1. Maximum Performance by Default ⚡
- Users get 2-3x faster performance automatically
- No configuration needed
- Falls back gracefully

### 2. Zero Breaking Changes ✅
- Existing code continues to work
- Automatic adapter selection
- Explicit override if needed

### 3. Best of Both Worlds 🎯
- Speed where possible (uWebSockets)
- Compatibility where needed (Node.js)
- Transparent to the user

### 4. Clear Communication 📣
- Log messages explain what's being used
- Users understand the trade-offs
- Easy to override if needed

---

## Migration Path

### Current (Phase 3.3)
```typescript
// Default: Node.js HTTP (slower but compatible)
const app = createApp();

// Fast: Must explicitly choose uWebSockets
const app = createApp({ adapter: { type: 'uwebsockets' } });
```

### Proposed (Phase 3.4)
```typescript
// Default: uWebSockets (fast, auto-fallback)
const app = createApp();

// Override: Explicitly choose Node.js if needed
const app = createApp({ adapter: { type: 'node-http' } });
```

---

## Implementation Checklist

- [ ] **Phase 3.4.1**: Smart adapter selection logic
  - [ ] Try uWebSockets first
  - [ ] Detect protocol requirements
  - [ ] Graceful fallback to Node.js
  - [ ] Clear logging

- [ ] **Phase 3.4.2**: Protocol-specific ports
  - [ ] gRPC on separate port
  - [ ] Update ProtocolManager
  - [ ] Documentation

- [ ] **Phase 3.4.3**: Hybrid mode (optional)
  - [ ] HybridAdapter implementation
  - [ ] Per-protocol adapter config
  - [ ] Advanced documentation

---

## Documentation Updates

### README.md
```markdown
## Performance

BlitzAPI automatically uses the fastest HTTP server available:

- **uWebSockets.js** (~350k req/s) - Used by default if installed
- **Node.js HTTP** (~124k req/s) - Automatic fallback

To install uWebSockets:
\`\`\`bash
npm install uWebSockets.js
\`\`\`

BlitzAPI will automatically use it for 2-3x performance boost!
```

### Quick Start
```typescript
import { createApp } from 'blitzapi';

// That's it! Automatically uses fastest adapter
const app = createApp();

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});

await app.listen(3000);
```

---

## Performance Comparison

### Before (Manual Configuration)
```typescript
// Slow by default
const app = createApp();
// Performance: ~124k req/s

// Must manually configure for speed
const app = createApp({ adapter: { type: 'uwebsockets' } });
// Performance: ~350k req/s
```

### After (Smart Default)
```typescript
// Fast by default!
const app = createApp();
// Performance: ~350k req/s (if uWS installed)
// Performance: ~124k req/s (fallback to Node.js)
```

**Result: 2-3x faster out of the box!** 🚀

---

## Conclusion

This strategy gives users:
1. ✅ **Maximum performance by default** (uWebSockets)
2. ✅ **Zero configuration needed** (auto-detection)
3. ✅ **Full protocol support** (smart fallback)
4. ✅ **Clear communication** (helpful logs)
5. ✅ **Easy override** (explicit config)

**Next Step:** Implement Phase 3.4.1 - Smart Adapter Selection

This is the key differentiator that makes BlitzAPI the **fastest AND most feature-complete** framework! 🎯
