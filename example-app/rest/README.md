# REST API Example

A complete REST API demonstrating Phase 1 features of BlitzAPI.

## Features

- User registration with password hashing
- JWT authentication
- Protected routes
- Todo CRUD operations
- Request validation with Zod
- Rate limiting
- CORS support
- Error handling

## Running

```bash
npm run example:rest
```

## Testing

```bash
./example-app/rest/test-api.sh
```

Or test manually:

```bash
# Register user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Create todo (use token from login)
curl -X POST http://localhost:3000/todos \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn BlitzAPI"}'
```

## API Endpoints

- `GET /` - Health check
- `POST /auth/register` - Register user
- `POST /auth/login` - Login
- `GET /auth/profile` - Get profile (protected)
- `GET /todos` - List todos (protected)
- `POST /todos` - Create todo (protected)
- `GET /todos/:id` - Get todo (protected)
- `PATCH /todos/:id` - Update todo (protected)
- `DELETE /todos/:id` - Delete todo (protected)
