# Request-Level HTTP Logging Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add structured HTTP request/response logging to all API routes so production logs show method, path, status, and duration for every request.

**Architecture:** A `withLogging` HOF in `lib/api-utils.ts` wraps route handlers. It records start time, calls the handler, then logs method/path/status/duration/IP via pino. `withAuth` is modified to call `withLogging` internally so all authenticated routes get logging for free. Non-`withAuth` routes wrap their exports with `withLogging` directly.

**Tech Stack:** pino (existing), Next.js route handlers, vitest

---

### Task 1: Add `withLogging` to `lib/api-utils.ts`

**Files:**
- Modify: `lib/api-utils.ts`
- Test: `tests/lib/api-utils.test.ts`

**Step 1: Write the failing tests**

Add to `tests/lib/api-utils.test.ts`, inside the top-level `describe('api-utils', ...)` block. The logger mock already exists at the top of the file.

```typescript
describe('withLogging', () => {
  it('should log method, path, status, and duration', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { logger } = await import('@/lib/logger');

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/people', { method: 'GET' });
    const response = await wrapped(request);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(request, undefined);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/people',
        status: 200,
      }),
      expect.stringContaining('GET /api/people 200')
    );
  });

  it('should log error status when handler returns error', async () => {
    const { withLogging, apiResponse: freshApiResponse } = await import('@/lib/api-utils');
    const { logger } = await import('@/lib/logger');

    const handler = vi.fn().mockResolvedValue(freshApiResponse.notFound('Not found'));
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/people/123', { method: 'GET' });
    await wrapped(request);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/people/123',
        status: 404,
      }),
      expect.stringContaining('GET /api/people/123 404')
    );
  });

  it('should log 500 and re-throw when handler throws', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { logger } = await import('@/lib/logger');

    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/test', { method: 'POST' });
    await expect(wrapped(request)).rejects.toThrow('boom');

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/api/test',
        status: 500,
      }),
      expect.stringContaining('POST /api/test 500')
    );
  });

  it('should pass context through to handler', async () => {
    const { withLogging } = await import('@/lib/api-utils');

    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/people/123', { method: 'GET' });
    const context = { params: Promise.resolve({ id: '123' }) };
    await wrapped(request, context);

    expect(handler).toHaveBeenCalledWith(request, context);
  });

  it('should include durationMs in log', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { logger } = await import('@/lib/logger');

    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/test', { method: 'GET' });
    await wrapped(request);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
      }),
      expect.any(String)
    );
  });

  it('should include IP in log', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { logger } = await import('@/lib/logger');

    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withLogging(handler);

    const request = new Request('http://localhost/api/test', {
      method: 'GET',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    await wrapped(request);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '1.2.3.4' }),
      expect.any(String)
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/api-utils.test.ts --reporter=verbose`
Expected: FAIL — `withLogging` is not exported from `@/lib/api-utils`

**Step 3: Implement `withLogging`**

Add to `lib/api-utils.ts`, after the existing imports, add a child logger:

```typescript
import { createModuleLogger } from './logger';

const httpLog = createModuleLogger('http');
```

Then add the `withLogging` function before `withAuth`:

```typescript
/**
 * Higher-order function that wraps API handlers with request/response logging.
 * Logs method, path, status code, duration (ms), and client IP for every request.
 *
 * @example
 * export const POST = withLogging(async (request) => {
 *   // ...handler logic
 *   return NextResponse.json({ data });
 * });
 */
export function withLogging(
  handler: (request: Request, context?: RouteContext) => Promise<Response | NextResponse>
) {
  return async (
    request: Request,
    context?: RouteContext
  ): Promise<Response | NextResponse> => {
    const start = Date.now();
    const method = request.method;
    const path = new URL(request.url).pathname;
    const ip = getClientIp(request);

    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - start;

      httpLog.info(
        { method, path, status: response.status, durationMs, ip },
        `${method} ${path} ${response.status}`
      );

      return response;
    } catch (error) {
      const durationMs = Date.now() - start;

      httpLog.error(
        { method, path, status: 500, durationMs, ip, err: error instanceof Error ? error : new Error(String(error)) },
        `${method} ${path} 500`
      );

      throw error;
    }
  };
}
```

Also update the `import` at the top — replace `import { logger } from './logger';` with:

```typescript
import { logger, createModuleLogger } from './logger';

const httpLog = createModuleLogger('http');
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/api-utils.test.ts --reporter=verbose`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add lib/api-utils.ts tests/lib/api-utils.test.ts
git commit -m "feat: add withLogging HOF for request-level HTTP logging"
```

---

### Task 2: Integrate logging into `withAuth`

**Files:**
- Modify: `lib/api-utils.ts`
- Test: `tests/lib/api-utils.test.ts`

**Step 1: Write the failing test**

Add to the existing `describe('withAuth', ...)` block in `tests/lib/api-utils.test.ts`:

```typescript
it('should log request with withLogging', async () => {
  const { auth } = await import('@/lib/auth');
  const mockSession = {
    user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
  };
  vi.mocked(auth).mockResolvedValue(mockSession as any);

  const { withAuth: freshWithAuth, apiResponse: freshApiResponse } = await import('@/lib/api-utils');
  const { logger } = await import('@/lib/logger');

  const handler = vi.fn().mockResolvedValue(freshApiResponse.ok({ data: 'test' }));
  const wrappedHandler = freshWithAuth(handler);

  const request = new Request('http://localhost/api/people');
  await wrappedHandler(request);

  expect(logger.info).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'GET',
      path: '/api/people',
      status: 200,
    }),
    expect.stringContaining('GET /api/people 200')
  );
});

it('should log 401 when not authenticated', async () => {
  const { auth } = await import('@/lib/auth');
  vi.mocked(auth).mockResolvedValue(null as never);

  const { withAuth: freshWithAuth } = await import('@/lib/api-utils');
  const { logger } = await import('@/lib/logger');

  const handler = vi.fn();
  const wrappedHandler = freshWithAuth(handler);

  const request = new Request('http://localhost/api/people');
  await wrappedHandler(request);

  expect(logger.info).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'GET',
      path: '/api/people',
      status: 401,
    }),
    expect.stringContaining('GET /api/people 401')
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/api-utils.test.ts --reporter=verbose`
Expected: FAIL — `logger.info` is not called by `withAuth`

**Step 3: Modify `withAuth` to use `withLogging`**

Replace the current `withAuth` implementation in `lib/api-utils.ts`:

```typescript
export function withAuth(handler: AuthenticatedHandler) {
  return withLogging(async (
    request: Request,
    context?: RouteContext
  ): Promise<Response | NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return apiResponse.unauthorized();
    }

    return handler(request, session as AuthenticatedSession, context);
  });
}
```

This wraps the inner auth-checking function with `withLogging`, so auth failures (401s) are also logged.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/api-utils.test.ts --reporter=verbose`
Expected: ALL PASS (including all existing withAuth tests — the signature is unchanged)

**Step 5: Commit**

```bash
git add lib/api-utils.ts tests/lib/api-utils.test.ts
git commit -m "feat: integrate withLogging into withAuth for automatic request logging"
```

---

### Task 3: Wrap non-`withAuth` route handlers

**Files:** All 33 route files that don't use `withAuth`. Listed below grouped by category.

The pattern is the same for all: import `withLogging` and wrap the exported handler(s).

**Before:**
```typescript
export async function POST(request: Request) {
```

**After:**
```typescript
import { withLogging } from '@/lib/api-utils';
// ... (may already import other things from api-utils)

export const POST = withLogging(async function POST(request: Request) {
```

Close the function with `});` instead of `}`.

**Special cases:**
- `app/api/auth/[...nextauth]/route.ts` — The `GET` is destructured from `handlers`. Wrap it: `export const GET = withLogging(handlers.GET);`. For `POST`, wrap the existing function.
- `app/api/health/route.ts` — **SKIP** (intentionally excluded, too noisy from orchestration pings).
- `app/api/[...notfound]/route.ts` — Already logs via `logger.warn`. Wrap with `withLogging` anyway for consistent structured access logging, the warn log is separate concern (alerting on 404s).
- `app/api/carddav/sync/route.ts` — Returns streaming `Response`, not `NextResponse.json`. `withLogging` still works since it only reads `response.status`.

**Step 1: Auth routes (8 files)**

Files to modify:
- `app/api/auth/[...nextauth]/route.ts` — wrap GET and POST
- `app/api/auth/available-providers/route.ts` — wrap GET
- `app/api/auth/check-verification/route.ts` — wrap POST
- `app/api/auth/forgot-password/route.ts` — wrap POST
- `app/api/auth/register/route.ts` — wrap POST
- `app/api/auth/registration-status/route.ts` — wrap GET
- `app/api/auth/resend-verification/route.ts` — wrap POST
- `app/api/auth/reset-password/route.ts` — wrap POST
- `app/api/auth/verify-email/route.ts` — wrap POST

For `app/api/auth/[...nextauth]/route.ts`, the transformation is:

```typescript
import { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { withLogging } from '@/lib/api-utils';

export const runtime = 'nodejs';

export const GET = withLogging(handlers.GET);

export const POST = withLogging(async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, 'login');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return handlers.POST(request);
});
```

For a typical auth route like `app/api/auth/register/route.ts`, add `withLogging` to the existing import from `@/lib/api-utils`:

```typescript
import { handleApiError, parseRequestBody, normalizeEmail, withLogging } from '@/lib/api-utils';
```

Then change:
```typescript
export async function POST(request: Request) {
```
to:
```typescript
export const POST = withLogging(async function POST(request: Request) {
```
And close the function body with `});` instead of `}`.

**Step 2: CardDAV routes (9 files)**

Files to modify:
- `app/api/carddav/backup/route.ts` — wrap POST
- `app/api/carddav/conflicts/[id]/resolve/route.ts` — wrap POST
- `app/api/carddav/connection/route.ts` — wrap POST, PUT, DELETE
- `app/api/carddav/connection/test/route.ts` — wrap POST
- `app/api/carddav/discover/route.ts` — wrap POST
- `app/api/carddav/export-bulk/route.ts` — wrap POST
- `app/api/carddav/import/route.ts` — wrap POST
- `app/api/carddav/pending-count/route.ts` — wrap GET
- `app/api/carddav/sync/route.ts` — wrap POST

Same pattern: add `withLogging` import, wrap each exported handler.

**Step 3: Cron routes (3 files)**

- `app/api/cron/carddav-sync/route.ts` — wrap GET
- `app/api/cron/purge-deleted/route.ts` — wrap GET
- `app/api/cron/send-reminders/route.ts` — wrap GET

**Step 4: Other routes (6 files)**

- `app/api/[...notfound]/route.ts` — wrap GET, POST, PUT, DELETE, PATCH
- `app/api/dev/clear-rate-limits/route.ts` — wrap DELETE
- `app/api/docs/route.ts` — wrap GET
- `app/api/log-error/route.ts` — wrap POST
- `app/api/openapi.json/route.ts` — wrap GET
- `app/api/unsubscribe/route.ts` — wrap POST
- `app/api/user/language/route.ts` — wrap PUT
- `app/api/vcard/import/route.ts` — wrap POST
- `app/api/vcard/upload/route.ts` — wrap POST
- `app/api/webhooks/stripe/route.ts` — wrap POST

**Step 5: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add app/api/
git commit -m "feat: wrap all non-withAuth routes with withLogging"
```

---

### Task 4: Verify build succeeds

**Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit design doc and plan**

```bash
git add docs/plans/2026-02-25-request-logging-design.md docs/plans/2026-02-25-request-logging.md
git commit -m "docs: add request-level logging design and implementation plan"
```
