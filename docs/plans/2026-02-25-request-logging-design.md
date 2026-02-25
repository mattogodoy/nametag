# Request-Level HTTP Logging

## Problem

With `LOG_LEVEL=info` in production, there are no HTTP access logs. The only info-level logs come from specific events (auth, cron, CardDAV). Normal API traffic produces zero output.

## Design

Add a `withLogging` higher-order function that wraps route handlers and logs every request/response with: method, path, status, duration (ms), and IP.

### Log fields

| Field      | Source                          |
|------------|---------------------------------|
| `method`   | `request.method`                |
| `path`     | `new URL(request.url).pathname` |
| `status`   | `response.status`               |
| `durationMs` | `Date.now() - start`          |
| `ip`       | `getClientIp(request)`          |

### Integration

- **`withAuth` routes (~41 routes):** Logging added inside `withAuth` automatically. Zero changes to individual route files.
- **Non-`withAuth` routes (~33 routes):** Wrap exported handlers with `withLogging(handler)`. These include:
  - Auth routes (register, login, forgot-password, etc.)
  - CardDAV routes (call `auth()` directly)
  - vCard routes
  - Cron routes
  - Stripe webhook
  - Catch-all 404, unsubscribe, user/language
- **Excluded from logging:** Health check (`/api/health`) — too noisy from orchestration pings.

### API

```typescript
// Public/unauthenticated routes
export const POST = withLogging(async (request) => {
  // ...handler
});

// Authenticated routes — logging is automatic
export const GET = withAuth(async (request, session) => {
  // ...handler
});
```

### Implementation location

`withLogging` goes in `lib/api-utils.ts` next to `withAuth`. Uses the existing pino logger with `module: 'http'`.

### Log output (production, JSON)

```json
{"level":"info","time":"...","module":"http","method":"GET","path":"/api/people","status":200,"durationMs":42,"ip":"1.2.3.4","msg":"GET /api/people 200"}
```
