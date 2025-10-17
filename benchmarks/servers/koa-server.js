import Koa from 'koa';

const app = new Koa();

// Simple router middleware
const router = async (ctx, next) => {
  if (ctx.path === '/json' && ctx.method === 'GET') {
    ctx.body = { message: 'Hello, World!', timestamp: Date.now() };
  } else if (ctx.path === '/with-middleware' && ctx.method === 'GET') {
    const token = ctx.headers.authorization;
    if (token) {
      ctx.user = { id: '123', name: 'Test User' };
    }
    ctx.body = { user: ctx.user, message: 'Authenticated' };
  } else if (ctx.path.startsWith('/users/') && ctx.method === 'GET') {
    const id = ctx.path.split('/')[2];
    ctx.body = { userId: id, name: 'John Doe' };
  } else if (ctx.path === '/search' && ctx.method === 'GET') {
    const query = new URL(ctx.url, 'http://localhost').searchParams;
    ctx.body = { query: query.get('q'), limit: query.get('limit'), results: [] };
  } else {
    await next();
  }
};

app.use(router);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Koa listening on port ${PORT}`);
});
