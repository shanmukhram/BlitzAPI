import { createApp } from '../../dist/index.js';

// Disable observability for fair benchmark comparison
const app = createApp({
  observability: {
    tracing: { enabled: false },
    logging: { enabled: false },
    metrics: { enabled: false },
    profiling: { enabled: false }
  }
});

// Simple JSON response
app.get('/json', async (ctx) => {
  ctx.json({ message: 'Hello, World!', timestamp: Date.now() });
});

// With middleware (auth simulation)
const authMiddleware = async (ctx, next) => {
  const token = ctx.req.headers.authorization;
  if (token) {
    ctx.user = { id: '123', name: 'Test User' };
  }
  await next();
};

app.get('/with-middleware', authMiddleware, async (ctx) => {
  ctx.json({ user: ctx.user, message: 'Authenticated' });
});

// Route parameters
app.get('/users/:id', async (ctx) => {
  ctx.json({ userId: ctx.params.id, name: 'John Doe' });
});

// Query parameters
app.get('/search', async (ctx) => {
  ctx.json({ query: ctx.query.q, limit: ctx.query.limit, results: [] });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BlitzAPI listening on port ${PORT}`);
});
