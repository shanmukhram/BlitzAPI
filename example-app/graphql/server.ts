/**
 * BlitzAPI GraphQL Example
 * Demonstrates multi-protocol support with GraphQL
 */

import { z } from 'zod';
import { createApp, logger, cors, type Operation } from '../src/index.js';

// ============================================================================
// 1. DATA MODELS
// ============================================================================

interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  genre: string;
}

interface Author {
  id: string;
  name: string;
  bio: string;
  booksWritten: number;
}

// In-memory data store
const books: Book[] = [
  { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, genre: 'Classic' },
  { id: '2', title: '1984', author: 'George Orwell', year: 1949, genre: 'Dystopian' },
  { id: '3', title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, genre: 'Classic' },
];

const authors: Author[] = [
  { id: '1', name: 'F. Scott Fitzgerald', bio: 'American novelist', booksWritten: 4 },
  { id: '2', name: 'George Orwell', bio: 'English novelist and essayist', booksWritten: 6 },
  { id: '3', name: 'Harper Lee', bio: 'American novelist', booksWritten: 2 },
];

let bookIdCounter = 4;

// ============================================================================
// 2. VALIDATION SCHEMAS
// ============================================================================

const BookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  year: z.number(),
  genre: z.string(),
});

const CreateBookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  year: z.number().int().min(1000).max(new Date().getFullYear()),
  genre: z.string().min(1),
});

const GetBookSchema = z.object({
  id: z.string(),
});

const AuthorSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string(),
  booksWritten: z.number(),
});

// ============================================================================
// 3. DEFINE OPERATIONS (Work for both REST and GraphQL!)
// ============================================================================

const operations: Operation[] = [
  // Query: List all books
  {
    name: 'listBooks',
    description: 'Get all books in the library',
    output: z.array(BookSchema),
    handler: async () => {
      return books;
    },
    rest: {
      method: 'GET',
      path: '/books',
    },
    graphql: {
      type: 'query',
    },
  },

  // Query: Get single book
  {
    name: 'getBook',
    description: 'Get a book by ID',
    input: GetBookSchema,
    output: BookSchema.nullable(),
    handler: async (input) => {
      const book = books.find((b) => b.id === input.id);
      return book || null;
    },
    rest: {
      method: 'GET',
      path: '/books/:id',
    },
    graphql: {
      type: 'query',
    },
  },

  // Mutation: Create book
  {
    name: 'createBook',
    description: 'Add a new book to the library',
    input: CreateBookSchema,
    output: BookSchema,
    handler: async (input) => {
      const newBook: Book = {
        id: String(bookIdCounter++),
        ...input,
      };
      books.push(newBook);
      return newBook;
    },
    rest: {
      method: 'POST',
      path: '/books',
    },
    graphql: {
      type: 'mutation',
    },
  },

  // Mutation: Delete book
  {
    name: 'deleteBook',
    description: 'Remove a book from the library',
    input: GetBookSchema,
    output: z.boolean(),
    handler: async (input) => {
      const index = books.findIndex((b) => b.id === input.id);
      if (index === -1) return false;
      books.splice(index, 1);
      return true;
    },
    rest: {
      method: 'DELETE',
      path: '/books/:id',
    },
    graphql: {
      type: 'mutation',
    },
  },

  // Query: List authors
  {
    name: 'listAuthors',
    description: 'Get all authors',
    output: z.array(AuthorSchema),
    handler: async () => {
      return authors;
    },
    rest: {
      method: 'GET',
      path: '/authors',
    },
    graphql: {
      type: 'query',
    },
  },
];

// ============================================================================
// 4. CREATE SERVER WITH MULTI-PROTOCOL SUPPORT
// ============================================================================

const app = createApp({
  middleware: [logger(), cors()],
  protocols: {
    graphql: {
      path: '/graphql',
      playground: true,
    },
  },
});

// Register operations (works for both REST and GraphQL!)
const protocolManager = app.getProtocolManager();

for (const operation of operations) {
  // Register with GraphQL
  if (protocolManager) {
    protocolManager.registerOperation(operation);
  }

  // Register with REST (manually for now)
  if (operation.rest) {
    const { method, path } = operation.rest;

    switch (method) {
      case 'GET':
        app.get(path, async (ctx) => {
          const input = { ...ctx.query, ...ctx.params };
          const result = await operation.handler(input as any, ctx);
          ctx.json(result);
        });
        break;

      case 'POST':
        app.post(path, async (ctx) => {
          const result = await operation.handler(ctx.body as any, ctx);
          ctx.json(result, 201);
        });
        break;

      case 'DELETE':
        app.delete(path, async (ctx) => {
          const input = { ...ctx.params };
          const result = await operation.handler(input as any, ctx);
          ctx.json({ success: result });
        });
        break;
    }
  }
}

// ============================================================================
// 5. START SERVER
// ============================================================================

app.listen(3000, '0.0.0.0').then(() => {
  console.log('');
  console.log('📚 Library API - Multi-Protocol Example');
  console.log('');
  console.log('REST Endpoints:');
  console.log('  GET    http://localhost:3000/books');
  console.log('  GET    http://localhost:3000/books/:id');
  console.log('  POST   http://localhost:3000/books');
  console.log('  DELETE http://localhost:3000/books/:id');
  console.log('  GET    http://localhost:3000/authors');
  console.log('');
  console.log('GraphQL:');
  console.log('  Endpoint:   http://localhost:3000/graphql');
  console.log('  Playground: http://localhost:3000/graphql');
  console.log('');
  console.log('Example GraphQL Queries:');
  console.log(`
  query {
    listBooks {
      id
      title
      author
      year
    }
  }

  query {
    getBook(id: "1") {
      title
      author
    }
  }

  mutation {
    createBook(
      title: "Animal Farm"
      author: "George Orwell"
      year: 1945
      genre: "Political Satire"
    ) {
      id
      title
    }
  }
  `);
});
