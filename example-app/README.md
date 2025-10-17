# BlitzAPI Example Application

This is a complete example application demonstrating all Phase 1 features of BlitzAPI.

## Features Demonstrated

1. **Core HTTP Server** - Fast, lightweight server built on Node.js
2. **Type-Safe Routing** - Define routes with full TypeScript support
3. **Middleware System** - Composable middleware with proper flow control
4. **Zod Validation** - Runtime validation with automatic TypeScript type inference
5. **JWT Authentication** - Secure token-based authentication
6. **Password Hashing** - bcrypt-based password security
7. **Rate Limiting** - Prevent abuse with request rate limits
8. **CORS** - Cross-Origin Resource Sharing support
9. **Logging** - Request/response logging with timing

## Running the Example

### Prerequisites

- Node.js 20+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Run the example server
npm run example
```

The server will start on `http://localhost:3000`.

### Testing the API

Make the test script executable and run it:

```bash
chmod +x example-app/test-api.sh
./example-app/test-api.sh
```

Or test manually with curl:

```bash
# Health check
curl http://localhost:3000/

# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'

# Login (returns JWT token)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get profile (requires authentication)
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create a todo (requires authentication)
curl -X POST http://localhost:3000/todos \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn BlitzAPI"
  }'

# List todos (requires authentication)
curl -X GET http://localhost:3000/todos \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## API Endpoints

### Public Endpoints

- `GET /` - Health check and API information

### Authentication Endpoints

- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and receive JWT token
- `GET /auth/profile` - Get current user profile (requires auth)

### Todo Endpoints (All require authentication)

- `GET /todos` - List all todos for current user
- `POST /todos` - Create a new todo
- `GET /todos/:id` - Get a specific todo
- `PATCH /todos/:id` - Update a todo
- `DELETE /todos/:id` - Delete a todo

## Code Structure

```
example-app/
├── server.ts          # Main application file
├── test-api.sh        # Shell script to test all endpoints
└── README.md          # This file
```

## Key Concepts

### 1. Request Validation

```typescript
const createTodoSchema = z.object({
  title: z.string().min(1).max(200),
});

app.post('/todos',
  validate({ body: createTodoSchema }),
  async (ctx) => {
    // ctx.body is now typed and validated
  }
);
```

### 2. Middleware Composition

```typescript
app.group('/todos', (router) => {
  // All routes in this group use these middleware
  router.use(authenticate(jwtService));
  router.use(rateLimit({ maxRequests: 10 }));

  router.get('/', handler);
  router.post('/', handler);
});
```

### 3. Error Handling

```typescript
throw new HTTPError(404, 'Todo not found');
// Automatically returns: { "error": true, "message": "Todo not found" }
```

### 4. Type Safety

```typescript
// Zod schema infers TypeScript types
type CreateTodoInput = z.infer<typeof createTodoSchema>;

// Context is fully typed
const { title } = ctx.body as CreateTodoInput;
```

## Next Steps

- Explore the source code in `src/` to see how the framework works
- Try adding new features (e.g., todo categories, user roles)
- Replace in-memory storage with a real database
- Add more middleware (compression, helmet, etc.)

## Notes

⚠️ This is a demo application. Do NOT use in production without:
- Changing the JWT secret
- Adding a real database
- Implementing proper error logging
- Adding input sanitization
- Setting up HTTPS
- Using environment variables for configuration
