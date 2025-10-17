import express from 'express';

const app = express();

// Simple JSON response
app.get('/json', (req, res) => {
  res.json({ message: 'Hello, World!', timestamp: Date.now() });
});

// With middleware (auth simulation)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    req.user = { id: '123', name: 'Test User' };
  }
  next();
};

app.get('/with-middleware', authMiddleware, (req, res) => {
  res.json({ user: req.user, message: 'Authenticated' });
});

// Route parameters
app.get('/users/:id', (req, res) => {
  res.json({ userId: req.params.id, name: 'John Doe' });
});

// Query parameters
app.get('/search', (req, res) => {
  res.json({ query: req.query.q, limit: req.query.limit, results: [] });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express listening on port ${PORT}`);
});
