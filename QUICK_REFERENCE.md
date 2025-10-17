# BlitzAPI Quick Reference

## Installation

```bash
npm install blitzapi zod
```

## Basic Server

```typescript
import { createApp } from 'blitzapi';

const app = createApp();

app.get('/', async (ctx) => {
  ctx.json({ message: 'Hello!' });
});

app.listen(3000);
```

## Routing

```typescript
// Basic routes
app.get('/users', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.patch('/users/:id', handler);
app.delete('/users/:id', handler);

// Route parameters
app.get('/users/:id', async (ctx) => {
  const userId = ctx.params.id;
  ctx.json({ userId });
});

// Query parameters
app.get('/search', async (ctx) => {
  const query = ctx.query.q;  // /search?q=test
  ctx.json({ query });
});

// Multiple handlers (middleware + handler)
app.get('/protected', authenticate(jwt), async (ctx) => {
  ctx.json({ user: ctx.user });
});

// All HTTP methods
app.all('/webhook', handler);
```

## Route Groups

```typescript
app.group('/api/v1', (api) => {
  api.group('/users', (users) => {
    users.get('/', listUsers);
    users.post('/', createUser);
    users.get('/:id', getUser);
  });
});
// Creates: /api/v1/users, /api/v1/users/:id, etc.
```

## Middleware

```typescript
// Global middleware
app.use(logger());
app.use(cors());

// Group middleware
app.group('/admin', (admin) => {
  admin.use(authenticate(jwt));
  admin.use(requireAdmin);
  // All routes here require auth + admin
});

// Per-route middleware
app.post('/api/data',
  rateLimit({ maxRequests: 5 }),
  validate({ body: schema }),
  handler
);
```

## Validation

```typescript
import { z } from 'zod';
import { validate } from 'blitzapi';

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

app.post('/users',
  validate({ body: userSchema }),
  async (ctx) => {
    // ctx.body is typed and validated
    const user = ctx.body as z.infer<typeof userSchema>;
    ctx.json({ user }, 201);
  }
);

// Query validation
const querySchema = z.object({
  page: z.string().transform(Number),
  limit: z.string().transform(Number),
});

app.get('/items',
  validate({ query: querySchema }),
  handler
);

// Params validation
const paramsSchema = z.object({
  id: z.string().uuid(),
});

app.get('/items/:id',
  validate({ params: paramsSchema }),
  handler
);
```

## Authentication

```typescript
import { JWTService, authenticate } from 'blitzapi';

// Create JWT service
const jwt = new JWTService({
  secret: process.env.JWT_SECRET!,
  expiresIn: 86400, // 24 hours in seconds
});

// Generate token
const token = jwt.sign({
  sub: userId,
  email: user.email,
});

// Verify token (middleware)
app.use(authenticate(jwt));

// Access user in handler
app.get('/profile', async (ctx) => {
  console.log(ctx.user);  // Decoded JWT payload
  console.log(ctx.state.userId);  // User ID
});
```

## Password Hashing

```typescript
import { passwordService } from 'blitzapi';

// Hash password
const hash = await passwordService.hash('password123');

// Verify password
const valid = await passwordService.verify('password123', hash);
```

## Response Helpers

```typescript
app.get('/data', async (ctx) => {
  // JSON response
  ctx.json({ data: 'value' });

  // JSON with status
  ctx.json({ data: 'value' }, 201);

  // Text response
  ctx.text('Hello World');

  // Status code
  ctx.status(404).json({ error: 'Not found' });

  // Headers
  ctx.setHeader('X-Custom', 'value');
  ctx.json({ data: 'value' });
});
```

## Error Handling

```typescript
import { HTTPError } from 'blitzapi';

app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);

  if (!user) {
    throw new HTTPError(404, 'User not found');
  }

  ctx.json(user);
});

// Custom error handler
const app = createApp({
  onError: async (error, ctx) => {
    console.error(error);

    const status = error instanceof HTTPError
      ? error.statusCode
      : 500;

    ctx.json({ error: error.message }, status);
  }
});
```

## CORS

```typescript
import { cors } from 'blitzapi';

// Enable all origins
app.use(cors());

// Specific origins
app.use(cors({
  origin: ['https://example.com'],
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Dynamic origin
app.use(cors({
  origin: (origin) => origin.endsWith('.example.com'),
}));
```

## Rate Limiting

```typescript
import { rateLimit } from 'blitzapi';

// Global rate limit
app.use(rateLimit({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
}));

// Per-endpoint rate limit
app.post('/api/expensive',
  rateLimit({ maxRequests: 5, windowMs: 60000 }),
  handler
);
```

## Logging

```typescript
import { logger } from 'blitzapi';

app.use(logger());
// Output: [200] GET /api/users - 15ms
```

## Context Object

```typescript
interface Context {
  // Request
  req: IncomingMessage;
  res: ServerResponse;
  method: HTTPMethod;
  url: string;
  path: string;
  query: Record<string, any>;
  params: Record<string, string>;
  body: any;
  headers: Record<string, string>;

  // Response helpers
  json(data: any, status?: number): void;
  text(data: string, status?: number): void;
  status(code: number): Context;
  setHeader(key: string, value: string): Context;

  // State (for middleware)
  state: Record<string, any>;
  user?: any;
}
```

## Custom Middleware

```typescript
import { Middleware } from 'blitzapi';

const timing: Middleware = async (ctx, next) => {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  ctx.setHeader('X-Response-Time', `${duration}ms`);
};

app.use(timing);
```

## Server Configuration

```typescript
const app = createApp({
  port: 3000,
  host: '0.0.0.0',
  cors: true,
  middleware: [logger(), cors()],
  onError: customErrorHandler,
  onNotFound: customNotFoundHandler,
});
```

## Lifecycle

```typescript
// Start server
await app.listen(3000);

// Graceful shutdown
await app.close();
```

## Common Patterns

### Protected Route Group
```typescript
app.group('/api', (api) => {
  api.use(authenticate(jwt));
  api.use(rateLimit({ maxRequests: 100 }));

  // All routes here are protected and rate-limited
  api.get('/profile', getProfile);
  api.get('/data', getData);
});
```

### Validated POST Endpoint
```typescript
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

app.post('/users',
  validate({ body: createUserSchema }),
  async (ctx) => {
    const data = ctx.body as z.infer<typeof createUserSchema>;
    const user = await db.createUser(data);
    ctx.json(user, 201);
  }
);
```

### Login Endpoint
```typescript
app.post('/login',
  validate({ body: loginSchema }),
  async (ctx) => {
    const { email, password } = ctx.body;

    const user = await db.findByEmail(email);
    if (!user) throw new HTTPError(401, 'Invalid credentials');

    const valid = await passwordService.verify(password, user.hash);
    if (!valid) throw new HTTPError(401, 'Invalid credentials');

    const token = jwt.sign({ sub: user.id, email: user.email });

    ctx.json({ token, user });
  }
);
```

## Tips

1. **Always validate input** - Use Zod schemas for type safety
2. **Use middleware composition** - Keep handlers focused
3. **Throw HTTPError** - Don't manually set status codes
4. **Type your schemas** - Use `z.infer<typeof schema>` for types
5. **Group related routes** - Use `app.group()` for organization
6. **Enable logging** - Use `logger()` in development
7. **Rate limit sensitive endpoints** - Prevent abuse
8. **Use environment variables** - Never hardcode secrets

## Full Example

```typescript
import { createApp, logger, cors, validate, authenticate, JWTService } from 'blitzapi';
import { z } from 'zod';

const app = createApp({
  middleware: [logger(), cors()],
});

const jwt = new JWTService({
  secret: process.env.JWT_SECRET!,
  expiresIn: 86400,
});

app.post('/login',
  validate({
    body: z.object({
      email: z.string().email(),
      password: z.string(),
    }),
  }),
  async (ctx) => {
    // ... login logic
    const token = jwt.sign({ sub: '123' });
    ctx.json({ token });
  }
);

app.group('/api', (api) => {
  api.use(authenticate(jwt));

  api.get('/profile', async (ctx) => {
    ctx.json({ user: ctx.user });
  });
});

app.listen(3000);
```
