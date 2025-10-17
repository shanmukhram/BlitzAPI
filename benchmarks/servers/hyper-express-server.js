import HyperExpress from 'hyper-express';

const app = new HyperExpress.Server();

// Simple JSON response
app.get('/json', (req, res) => {
  res.json({ message: 'Hello, World!', timestamp: Date.now() });
});

// With middleware (auth simulation)
app.get('/with-middleware', (req, res) => {
  const token = req.headers.authorization;
  const user = token ? { id: '123', name: 'Test User' } : undefined;
  res.json({ user, message: 'Authenticated' });
});

// Route parameters
app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id, name: 'John Doe' });
});

// Query parameters
app.get('/search', (req, res) => {
  res.json({
    query: req.query.q,
    limit: req.query.limit,
    results: []
  });
});

const PORT = process.env.PORT || 3005;
app.listen(PORT)
  .then(() => console.log(`Hyper-Express listening on port ${PORT}`))
  .catch((err) => console.error('Error starting Hyper-Express:', err));
