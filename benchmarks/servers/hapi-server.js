import Hapi from '@hapi/hapi';

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3004,
    host: '0.0.0.0',
  });

  // Simple JSON response
  server.route({
    method: 'GET',
    path: '/json',
    handler: (request, h) => {
      return { message: 'Hello, World!', timestamp: Date.now() };
    }
  });

  // With middleware (auth simulation)
  server.route({
    method: 'GET',
    path: '/with-middleware',
    handler: (request, h) => {
      const token = request.headers.authorization;
      const user = token ? { id: '123', name: 'Test User' } : undefined;
      return { user, message: 'Authenticated' };
    }
  });

  // Route parameters
  server.route({
    method: 'GET',
    path: '/users/{id}',
    handler: (request, h) => {
      return { userId: request.params.id, name: 'John Doe' };
    }
  });

  // Query parameters
  server.route({
    method: 'GET',
    path: '/search',
    handler: (request, h) => {
      return {
        query: request.query.q,
        limit: request.query.limit,
        results: []
      };
    }
  });

  await server.start();
  console.log(`Hapi listening on port ${server.info.port}`);
};

init();
