# gRPC API Example

A user service demonstrating gRPC support in BlitzAPI.

## Features

- gRPC service definitions
- Protocol Buffers schema generation
- Type-safe RPC calls
- Error handling
- Integration with BlitzAPI operations

## Running

```bash
npm run example:grpc
```

The gRPC server will start on port `50051`.

## Service Definition

```protobuf
service UserService {
  rpc GetUser (GetUserRequest) returns (GetUserResponse);
  rpc ListUsers (ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser (CreateUserRequest) returns (CreateUserResponse);
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserResponse);
}
```

## Testing

```bash
# Install grpcurl if not already installed
# brew install grpcurl

# List services
grpcurl -plaintext localhost:50051 list

# Call GetUser
grpcurl -plaintext -d '{"id": "1"}' localhost:50051 UserService/GetUser

# Call ListUsers
grpcurl -plaintext localhost:50051 UserService/ListUsers

# Call CreateUser
grpcurl -plaintext -d '{"name": "John Doe", "email": "john@example.com"}' localhost:50051 UserService/CreateUser
```

## Notes

gRPC runs on a separate server (port 50051) from HTTP/REST (port 3000). This is by design as gRPC uses HTTP/2 and has different requirements than REST/GraphQL.

In a production setup, you would typically:
1. Run gRPC on its own port for service-to-service communication
2. Run REST/GraphQL on standard HTTP ports for client access
3. Use an API gateway to route between them if needed
