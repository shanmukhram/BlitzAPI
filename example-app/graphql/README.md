# GraphQL API Example

A library management API demonstrating GraphQL support in RamAPI.

## Features

- GraphQL queries
- GraphQL mutations
- Automatic schema generation from Zod
- GraphQL Playground UI
- Type-safe operations
- Shared data layer with REST

## Running

```bash
npm run example:graphql
```

Then open http://localhost:3000/graphql in your browser for the GraphQL Playground.

## Example Queries

```graphql
# List all books
query {
  listBooks {
    id
    title
    author
    year
    genre
  }
}

# Get specific book
query {
  getBook(id: "1") {
    title
    author
    year
  }
}

# List authors
query {
  listAuthors {
    id
    name
    bio
    booksWritten
  }
}
```

## Example Mutations

```graphql
# Create a new book
mutation {
  createBook(
    title: "Animal Farm"
    author: "George Orwell"
    year: 1945
    genre: "Political Satire"
  ) {
    id
    title
    author
  }
}

# Delete a book
mutation {
  deleteBook(id: "1")
}
```

## REST Endpoints (Also Available!)

The same data is accessible via REST:

- `GET /books` - List all books
- `GET /books/:id` - Get specific book
- `POST /books` - Create book
- `DELETE /books/:id` - Delete book
- `GET /authors` - List authors

This demonstrates the multi-protocol capability - one data source, multiple access methods!
