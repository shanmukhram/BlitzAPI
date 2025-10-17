# Performance Profiling - Complete Test Guide

## Overview

This guide shows you how to test the complete timeline visualization with all stages:
**Routing → Validation → Authentication → Middleware → Handler → Serialization**

## Quick Start

### 1. Clean Environment

```bash
# Kill any running processes
pkill -f "npm run example"

# Clean build
npm run build
```

### 2. Start the Complete Timeline Example

```bash
npm run example:profiling:complete
```

The server will start on `http://localhost:3000`

---

## Test Scenarios

### Scenario 1: Full Stack Request (All Middleware)

**Test all stages: Routing → Validation → Auth → RateLimit → Handler → Serialization**

```bash
# Step 1: Make request
curl -H "Authorization: Bearer token" http://localhost:3000/full-stack

# Step 2: Copy the traceId from response

# Step 3: View complete timeline
curl http://localhost:3000/profile/<TRACE_ID>
```

**Expected Output:**
```
Timeline (228ms total):
├─ Routing           0.50ms (0.2%)
├─ Validation        8ms (3.5%)
├─ Authentication    18ms (7.9%)
├─ RateLimit         3ms (1.3%)
├─ Handler           195ms (85.2%) ⚠️ SLOW
└─ Serialization     0.03ms (0.0%)
```

### Scenario 2: Protected Endpoint (Validation + Auth)

```bash
# With auth header
curl -H "Authorization: Bearer token" http://localhost:3000/protected
```

**Expected stages:** Routing → Validation → Authentication → Handler → Serialization

### Scenario 3: Simple Endpoint (Validation Only)

```bash
curl http://localhost:3000/simple
```

**Expected stages:** Routing → Validation → Handler → Serialization

### Scenario 4: Fast Endpoint (Should NOT be slow)

```bash
curl -H "Authorization: Bearer token" http://localhost:3000/fast
```

**Expected:** No SLOW warnings, all stages fast

### Scenario 5: Complex Validation

```bash
curl -X POST http://localhost:3000/complex-validation
```

**Expected:** Validation stage should be slow (45ms)

---

## Testing Commands (Copy & Paste)

### Complete Test Flow

```bash
# 1. Start server
npm run example:profiling:complete

# 2. In a NEW terminal, run these tests:

# Test 1: Full stack
curl -s -H "Authorization: Bearer token" http://localhost:3000/full-stack | jq '{message, traceId}'

# Test 2: Get slowest requests
curl -s http://localhost:3000/profile/slow | head -20

# Test 3: View statistics
curl -s http://localhost:3000/profile/stats | head -20

# Test 4: Get specific profile (replace TRACE_ID)
curl http://localhost:3000/profile/TRACE_ID

# Test 5: Generate mixed traffic
for i in {1..5}; do
  curl -s http://localhost:3000/simple > /dev/null
  curl -s -H "Authorization: Bearer token" http://localhost:3000/protected > /dev/null
  curl -s -H "Authorization: Bearer token" http://localhost:3000/full-stack > /dev/null
done

# Test 6: View patterns
curl -s http://localhost:3000/profile/patterns | jq '.'
```

---

## Visual Output Examples

### Good Performance (Fast Endpoint)

```
Timeline (38ms total):
├─ Routing           ░░░░░░░░░░░░░░░░ 0.50ms (1.3%)
├─ Validation        ▓░░░░░░░░░░░░░░░ 8ms (21.1%)
├─ Authentication    ▓▓░░░░░░░░░░░░░░ 18ms (47.4%)
├─ Handler           ▓░░░░░░░░░░░░░░░ 10ms (26.3%)
└─ Serialization     ░░░░░░░░░░░░░░░░ 0.03ms (0.1%)
```

### Slow Performance (Handler Bottleneck)

```
Timeline (234ms total):
├─ Routing           ░░░░░░░░░░░░░░░░ 0.50ms (0.2%)
├─ Validation        ▓░░░░░░░░░░░░░░░ 8ms (3.4%)
├─ Authentication    ▓▓░░░░░░░░░░░░░░ 18ms (7.7%)
├─ Handler           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ 195ms (83.3%) ⚠️ SLOW
└─ Serialization     ▓░░░░░░░░░░░░░░░ 11ms (4.7%)

Bottlenecks:
  • [WARNING] Handler execution is slow (195ms)
  • [INFO] Handler accounts for 83.3% of total time
```

### Slow Middleware

```
Timeline (76ms total):
├─ Routing           ░░░░░░░░░░░░░░░░ 0.50ms (0.7%)
├─ Validation (Complex) ▓▓▓▓▓▓▓▓▓▓░░░░░░ 45ms (59.2%) ⚠️ SLOW
├─ Handler           ▓▓▓▓░░░░░░░░░░░░ 30ms (39.5%)
└─ Serialization     ░░░░░░░░░░░░░░░░ 0.03ms (0.0%)

Bottlenecks:
  • [WARNING] Slow middleware detected: Validation (Complex) (45ms)
```

---

## Profile API Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /profile/:traceId` | Get detailed profile | `curl http://localhost:3000/profile/abc123` |
| `GET /profile/slow` | List slowest requests | `curl http://localhost:3000/profile/slow` |
| `GET /profile/stats` | View statistics | `curl http://localhost:3000/profile/stats` |
| `GET /profile/patterns` | Detect patterns | `curl http://localhost:3000/profile/patterns` |
| `GET /profile/list` | List all profiles | `curl http://localhost:3000/profile/list?limit=10` |

### Query Parameters

- `format=json` - Get JSON response instead of visual
- `limit=N` - Limit number of results
- `slow=true` - Filter only slow requests

---

## Using profiledMiddleware in Your App

Wrap any middleware to track its timing:

```typescript
import { profiledMiddleware } from './src/observability/profiler/index.js';

// Example: Track validation timing
const validationMiddleware = profiledMiddleware('Validation', async (ctx, next) => {
  // Your validation logic
  await validateRequest(ctx);
  await next();
});

// Example: Track auth timing
const authMiddleware = profiledMiddleware('Authentication', async (ctx, next) => {
  // Your auth logic
  const user = await verifyToken(ctx);
  ctx.user = user;
  await next();
});

// Use in routes
app.get('/protected', validationMiddleware, authMiddleware, async (ctx) => {
  ctx.json({ user: ctx.user });
});
```

---

## Troubleshooting

### No Middleware Stages Showing

**Problem:** Only seeing Routing, Handler, Serialization

**Solution:** Make sure you're wrapping middleware with `profiledMiddleware()`:

```typescript
// ❌ Wrong
app.use(myMiddleware);

// ✅ Correct
app.use(profiledMiddleware('MyMiddleware', myMiddleware));
```

### Timeline Shows Wrong Order

**Problem:** Middleware appears in wrong order

**Explanation:** The middleware wrapper records when each middleware completes, so nested middleware shows cumulative time. This is expected behavior.

### All Stages Marked as SLOW

**Problem:** Everything shows ⚠️ SLOW warning

**Solution:** Adjust the `slowThreshold` in profiling config:

```typescript
profiling: {
  slowThreshold: 1000,  // Increase threshold (default: 1000ms)
}
```

---

## Performance Impact

- **Profiling disabled:** 0ms overhead
- **Profiling enabled:** ~0.5-1ms overhead per request
- **Memory profiling enabled:** ~2-3ms additional overhead

## Next Steps

1. ✅ Test all scenarios above
2. ✅ Verify visual output matches expectations
3. ✅ Check bottleneck detection works
4. ✅ Test with your own middleware
5. 🚀 Use in production with adjusted thresholds!

---

## Support

If you encounter issues:
1. Check the console output for errors
2. Verify build completed successfully (`npm run build`)
3. Ensure server is running on port 3000
4. Check that observability is enabled in config
