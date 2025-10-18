/**
 * RamAPI Example Application
 * Demonstrates all Phase 1 features:
 * - Core HTTP server with routing
 * - Middleware system
 * - Type-safe validation with Zod
 * - JWT authentication
 * - Rate limiting
 * - CORS
 */

import { z } from 'zod';
import {
  createApp,
  logger,
  cors,
  rateLimit,
  validate,
  JWTService,
  authenticate,
  passwordService,
  HTTPError,
} from '../src/index.js';

// ============================================================================
// 1. SETUP
// ============================================================================

const app = createApp({
  port: 3000,
  middleware: [
    logger(), // Log all requests
    cors(), // Enable CORS
  ],
});

// JWT service for authentication
const jwtService = new JWTService({
  secret: 'your-super-secret-key-change-in-production',
  expiresIn: 86400, // 24 hours in seconds
});

// ============================================================================
// 2. IN-MEMORY DATA STORE (for demo purposes)
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
}

interface Todo {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

const users: User[] = [];
const todos: Todo[] = [];

// Helper to generate IDs
let userIdCounter = 1;
let todoIdCounter = 1;

// ============================================================================
// 3. VALIDATION SCHEMAS
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
});

const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  completed: z.boolean().optional(),
});

const todoParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid todo ID'),
});

// ============================================================================
// 4. PUBLIC ROUTES
// ============================================================================

// Health check
app.get('/', async (ctx) => {
  ctx.json({
    message: 'RamAPI Example Server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /',
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      profile: 'GET /auth/profile (requires auth)',
      todos: 'GET /todos (requires auth)',
      createTodo: 'POST /todos (requires auth)',
      getTodo: 'GET /todos/:id (requires auth)',
      updateTodo: 'PATCH /todos/:id (requires auth)',
      deleteTodo: 'DELETE /todos/:id (requires auth)',
    },
  });
});

// ============================================================================
// 5. AUTH ROUTES
// ============================================================================

app.group('/auth', (auth) => {
  // Register new user
  auth.post(
    '/register',
    validate({ body: registerSchema }),
    async (ctx) => {
      const { email, password, name } = ctx.body as z.infer<typeof registerSchema>;

      // Check if user already exists
      if (users.find((u) => u.email === email)) {
        throw new HTTPError(400, 'User already exists');
      }

      // Hash password
      const passwordHash = await passwordService.hash(password);

      // Create user
      const user: User = {
        id: String(userIdCounter++),
        email,
        name,
        passwordHash,
        createdAt: new Date(),
      };

      users.push(user);

      // Generate JWT
      const token = jwtService.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      ctx.json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      }, 201);
    }
  );

  // Login
  auth.post(
    '/login',
    validate({ body: loginSchema }),
    async (ctx) => {
      const { email, password } = ctx.body as z.infer<typeof loginSchema>;

      // Find user
      const user = users.find((u) => u.email === email);
      if (!user) {
        throw new HTTPError(401, 'Invalid credentials');
      }

      // Verify password
      const valid = await passwordService.verify(password, user.passwordHash);
      if (!valid) {
        throw new HTTPError(401, 'Invalid credentials');
      }

      // Generate JWT
      const token = jwtService.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
      });

      ctx.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }
  );

  // Get current user profile (protected)
  auth.get(
    '/profile',
    authenticate(jwtService),
    async (ctx) => {
      const userId = ctx.state.userId as string;
      const user = users.find((u) => u.id === userId);

      if (!user) {
        throw new HTTPError(404, 'User not found');
      }

      ctx.json({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      });
    }
  );
});

// ============================================================================
// 6. TODO ROUTES (Protected)
// ============================================================================

app.group('/todos', (todoRouter) => {
  // Apply authentication to all todo routes
  todoRouter.use(authenticate(jwtService));

  // Apply rate limiting (10 requests per minute)
  todoRouter.use(rateLimit({ maxRequests: 10, windowMs: 60000 }));

  // List all todos for current user
  todoRouter.get('/', async (ctx) => {
    const userId = ctx.state.userId as string;
    const userTodos = todos.filter((t) => t.userId === userId);

    ctx.json({
      count: userTodos.length,
      todos: userTodos,
    });
  });

  // Create new todo
  todoRouter.post(
    '/',
    validate({ body: createTodoSchema }),
    async (ctx) => {
      const userId = ctx.state.userId as string;
      const { title } = ctx.body as z.infer<typeof createTodoSchema>;

      const todo: Todo = {
        id: String(todoIdCounter++),
        userId,
        title,
        completed: false,
        createdAt: new Date(),
      };

      todos.push(todo);

      ctx.json(todo, 201);
    }
  );

  // Get specific todo
  todoRouter.get(
    '/:id',
    validate({ params: todoParamsSchema }),
    async (ctx) => {
      const userId = ctx.state.userId as string;
      const { id } = ctx.params as z.infer<typeof todoParamsSchema>;

      const todo = todos.find((t) => t.id === id && t.userId === userId);

      if (!todo) {
        throw new HTTPError(404, 'Todo not found');
      }

      ctx.json(todo);
    }
  );

  // Update todo
  todoRouter.patch(
    '/:id',
    validate({ params: todoParamsSchema, body: updateTodoSchema }),
    async (ctx) => {
      const userId = ctx.state.userId as string;
      const { id } = ctx.params as z.infer<typeof todoParamsSchema>;
      const updates = ctx.body as z.infer<typeof updateTodoSchema>;

      const todo = todos.find((t) => t.id === id && t.userId === userId);

      if (!todo) {
        throw new HTTPError(404, 'Todo not found');
      }

      // Apply updates
      if (updates.title !== undefined) {
        todo.title = updates.title;
      }
      if (updates.completed !== undefined) {
        todo.completed = updates.completed;
      }

      ctx.json(todo);
    }
  );

  // Delete todo
  todoRouter.delete(
    '/:id',
    validate({ params: todoParamsSchema }),
    async (ctx) => {
      const userId = ctx.state.userId as string;
      const { id } = ctx.params as z.infer<typeof todoParamsSchema>;

      const index = todos.findIndex((t) => t.id === id && t.userId === userId);

      if (index === -1) {
        throw new HTTPError(404, 'Todo not found');
      }

      todos.splice(index, 1);

      ctx.json({ message: 'Todo deleted successfully' });
    }
  );
});

// ============================================================================
// 7. START SERVER
// ============================================================================

app.listen(3000, '0.0.0.0').then(() => {
  console.log('');
  console.log('📚 Example endpoints:');
  console.log('  GET    http://localhost:3000/');
  console.log('  POST   http://localhost:3000/auth/register');
  console.log('  POST   http://localhost:3000/auth/login');
  console.log('  GET    http://localhost:3000/auth/profile');
  console.log('  GET    http://localhost:3000/todos');
  console.log('  POST   http://localhost:3000/todos');
  console.log('  GET    http://localhost:3000/todos/:id');
  console.log('  PATCH  http://localhost:3000/todos/:id');
  console.log('  DELETE http://localhost:3000/todos/:id');
  console.log('');
});
