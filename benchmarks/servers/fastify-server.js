import Fastify from 'fastify';

const fastify = Fastify({ logger: false });

// Simple JSON response
fastify.get('/json', async (request, reply) => {
  return { message: 'Hello, World!', timestamp: Date.now() };
});

// With middleware (auth simulation)
fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/with-middleware')) {
    const token = request.headers.authorization;
    if (token) {
      request.user = { id: '123', name: 'Test User' };
    }
  }
});

fastify.get('/with-middleware', async (request, reply) => {
  return { user: request.user, message: 'Authenticated' };
});

// Route parameters
fastify.get('/users/:id', async (request, reply) => {
  return { userId: request.params.id, name: 'John Doe' };
});

// Query parameters
fastify.get('/search', async (request, reply) => {
  return { query: request.query.q, limit: request.query.limit, results: [] };
});

const PORT = process.env.PORT || 3002;
fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) throw err;
  console.log(`Fastify listening on port ${PORT}`);
});
