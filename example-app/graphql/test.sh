#!/bin/bash
# GraphQL API Test Script

BASE_URL="http://localhost:3000"

echo "🧪 Testing BlitzAPI GraphQL Example"
echo "===================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: List books via GraphQL
echo -e "${BLUE}Test 1: GraphQL Query - List Books${NC}"
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { listBooks { id title author year genre } }"}' | jq '.'
echo ""

# Test 2: Get specific book via GraphQL
echo -e "${BLUE}Test 2: GraphQL Query - Get Book${NC}"
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { getBook(id: \"1\") { title author year } }"}' | jq '.'
echo ""

# Test 3: Create book via GraphQL
echo -e "${BLUE}Test 3: GraphQL Mutation - Create Book${NC}"
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { createBook(title: \"Brave New World\", author: \"Aldous Huxley\", year: 1932, genre: \"Dystopian\") { id title author } }"}' | jq '.'
echo ""

# Test 4: List books via REST (same data!)
echo -e "${BLUE}Test 4: REST GET - List Books (same data as GraphQL!)${NC}"
curl -s "$BASE_URL/books" | jq '.'
echo ""

# Test 5: List authors via GraphQL
echo -e "${BLUE}Test 5: GraphQL Query - List Authors${NC}"
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "query { listAuthors { id name bio booksWritten } }"}' | jq '.'
echo ""

# Test 6: Delete book via GraphQL
echo -e "${BLUE}Test 6: GraphQL Mutation - Delete Book${NC}"
curl -s -X POST "$BASE_URL/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { deleteBook(id: \"4\") }"}' | jq '.'
echo ""

echo -e "${GREEN}✅ All GraphQL tests completed!${NC}"
echo ""
echo "💡 Try the GraphQL Playground: http://localhost:3000/graphql"
