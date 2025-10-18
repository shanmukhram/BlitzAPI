# Documentation Images

This directory contains images used in the documentation.

## Images Needed

### flow-visualization-diagram.png

**Location:** `docs/images/flow-visualization-diagram.png`

**Description:** Sequence diagram showing a complete request flow through RamAPI with the following components:

- Client → RamAPI
- RamAPI → Database
- RamAPI → ExternalAPI
- RamAPI → Cache

**Flow shown:**
1. Client sends `GET /users/123` request
2. Routing (3.2ms)
3. Validation (8.5ms)
4. Auth (7.1ms)
5. SELECT * FROM users query to Database (35.4ms)
6. GET /user-details to ExternalAPI (32.1ms)
7. SET user:123 to Cache (7.8ms)
8. Response 200 OK (245.8ms total)

**Usage:** Referenced in main README.md in the "Request Flow Visualization" section.

---

Please place the flow visualization diagram image in this directory as `flow-visualization-diagram.png`.
