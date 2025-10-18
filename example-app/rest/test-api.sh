#!/bin/bash
# RamAPI Example Test Script
# Tests all API endpoints

BASE_URL="http://localhost:3000"
TOKEN=""

echo "🧪 Testing RamAPI Example Server"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health check
echo -e "${BLUE}Test 1: Health Check${NC}"
curl -s -X GET "$BASE_URL/" | jq '.'
echo ""

# Test 2: Register user
echo -e "${BLUE}Test 2: Register User${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token')
echo -e "${GREEN}Token: $TOKEN${NC}"
echo ""

# Test 3: Login
echo -e "${BLUE}Test 3: Login${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
echo ""

# Test 4: Get profile (authenticated)
echo -e "${BLUE}Test 4: Get Profile (Authenticated)${NC}"
curl -s -X GET "$BASE_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 5: Create todo
echo -e "${BLUE}Test 5: Create Todo${NC}"
TODO_RESPONSE=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn RamAPI"
  }')

echo "$TODO_RESPONSE" | jq '.'
TODO_ID=$(echo "$TODO_RESPONSE" | jq -r '.id')
echo ""

# Test 6: List todos
echo -e "${BLUE}Test 6: List Todos${NC}"
curl -s -X GET "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 7: Get specific todo
echo -e "${BLUE}Test 7: Get Todo #$TODO_ID${NC}"
curl -s -X GET "$BASE_URL/todos/$TODO_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 8: Update todo
echo -e "${BLUE}Test 8: Update Todo #$TODO_ID${NC}"
curl -s -X PATCH "$BASE_URL/todos/$TODO_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completed": true,
    "title": "Learned RamAPI!"
  }' | jq '.'
echo ""

# Test 9: Validation error (missing field)
echo -e "${BLUE}Test 9: Validation Error (should fail)${NC}"
curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
echo ""

# Test 10: Unauthorized request (no token)
echo -e "${BLUE}Test 10: Unauthorized Request (should fail)${NC}"
curl -s -X GET "$BASE_URL/todos" | jq '.'
echo ""

# Test 11: Delete todo
echo -e "${BLUE}Test 11: Delete Todo #$TODO_ID${NC}"
curl -s -X DELETE "$BASE_URL/todos/$TODO_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo -e "${GREEN}✅ All tests completed!${NC}"
