# Structured Logging with Pino — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the homegrown logger with Pino for structured, Datadog-compatible JSON logging and migrate all server-side `console.*` calls to use it.

**Architecture:** Pino as the core logger producing JSON to stdout. Child loggers per module for filterable context. `pino-http` middleware for automatic request logging. ESLint `no-console` rule to prevent regression.

**Tech Stack:** pino, pino-pretty (dev), pino-http

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install pino and pino-http as production deps**

Run: `npm install pino pino-http`

**Step 2: Install pino-pretty as dev dep**

Run: `npm install -D pino-pretty`

**Step 3: Verify installation**

Run: `npm ls pino pino-http pino-pretty`
Expected: All three packages listed without errors.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pino, pino-http, pino-pretty dependencies"
```

---

### Task 2: Rewrite Core Logger with Pino

**Files:**
- Modify: `lib/logger.ts`
- Test: `tests/lib/logger.test.ts`

**Step 1: Write the failing tests**

Rewrite `tests/lib/logger.test.ts` entirely. The new tests must verify:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pino before importing logger
const mockChild = vi.fn();
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockFatal = vi.fn();

const mockPinoInstance = {
  debug: mockDebug,
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
  fatal: mockFatal,
  child: mockChild.mockReturnValue({
    debug: mockDebug,
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    fatal: mockFatal,
    child: mockChild,
  }),
};

vi.mock('pino', () => ({
  default: vi.fn(() => mockPinoInstance),
  pino: vi.fn(() => mockPinoInstance),
}));

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger functions', () => {
    it('should export a logger with standard log methods', async () => {
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
    });

    it('should log info messages with context', async () => {
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.info({ userId: '123' }, 'User logged in');
      expect(mockInfo).toHaveBeenCalledWith({ userId: '123' }, 'User logged in');
    });

    it('should log error messages with error objects', async () => {
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      const err = new Error('Something broke');
      logger.error({ err }, 'Operation failed');
      expect(mockError).toHaveBeenCalledWith({ err }, 'Operation failed');
    });

    it('should log warn messages', async () => {
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.warn({ endpoint: '/api/test' }, 'Slow response');
      expect(mockWarn).toHaveBeenCalledWith({ endpoint: '/api/test' }, 'Slow response');
    });

    it('should log debug messages', async () => {
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.debug({ query: 'SELECT' }, 'DB query');
      expect(mockDebug).toHaveBeenCalledWith({ query: 'SELECT' }, 'DB query');
    });
  });

  describe('child loggers', () => {
    it('should create child loggers with module context', async () => {
      vi.resetModules();
      const { createModuleLogger } = await import('@/lib/logger');

      const childLogger = createModuleLogger('carddav');
      expect(mockChild).toHaveBeenCalledWith({ module: 'carddav' });
      expect(childLogger).toBeDefined();
    });
  });

  describe('securityLogger', () => {
    it('should log rate limit exceeded', async () => {
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login');
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RATE_LIMIT_EXCEEDED',
          ip: '192.168.1.1',
          endpoint: '/api/auth/login',
        }),
        'Rate limit exceeded'
      );
    });

    it('should log auth failure', async () => {
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.authFailure('192.168.1.1', 'Invalid credentials');
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AUTH_FAILURE',
          ip: '192.168.1.1',
          reason: 'Invalid credentials',
        }),
        'Authentication failure'
      );
    });

    it('should log suspicious activity', async () => {
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.suspiciousActivity('192.168.1.1', 'Multiple failed logins');
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUSPICIOUS_ACTIVITY',
          ip: '192.168.1.1',
          activity: 'Multiple failed logins',
        }),
        'Suspicious activity detected'
      );
    });

    it('should include additional context', async () => {
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login', { attempts: 10 });
      expect(mockWarn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RATE_LIMIT_EXCEEDED',
          attempts: 10,
        }),
        'Rate limit exceeded'
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/logger.test.ts`
Expected: FAIL — the current logger exports don't match the new Pino-based API.

**Step 3: Rewrite `lib/logger.ts` with Pino**

```typescript
import pino from 'pino';

type LogContext = Record<string, unknown>;

// Pino log level mapping
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Create base Pino instance
const pinoOptions: pino.LoggerOptions = {
  level: LOG_LEVEL,
  // Add string level name for Datadog (in addition to numeric)
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

// Use pino-pretty in development for readable output
if (process.env.NODE_ENV !== 'production') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(pinoOptions);

/**
 * Create a child logger with a module name for filtering.
 * Usage: const log = createModuleLogger('carddav');
 *        log.info({ syncId }, 'Sync started');
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

// Security-specific logging — preserves the existing interface
const securityLog = logger.child({ module: 'security' });

export const securityLogger = {
  rateLimitExceeded: (ip: string, endpoint: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'RATE_LIMIT_EXCEEDED', ip, endpoint, ...context },
      'Rate limit exceeded'
    );
  },

  authFailure: (ip: string, reason: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'AUTH_FAILURE', ip, reason, ...context },
      'Authentication failure'
    );
  },

  suspiciousActivity: (ip: string, activity: string, context?: LogContext) => {
    securityLog.warn(
      { type: 'SUSPICIOUS_ACTIVITY', ip, activity, ...context },
      'Suspicious activity detected'
    );
  },
};
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/logger.test.ts`
Expected: PASS — all tests green.

**Step 5: Commit**

```bash
git add lib/logger.ts tests/lib/logger.test.ts
git commit -m "feat: replace homegrown logger with Pino"
```

---

### Task 3: Update Existing Logger Callers (API Signature Change)

The old logger used positional args: `logger.error('message', context, error)`. Pino uses: `logger.error({ err, ...context }, 'message')`. This task updates all files that import from `@/lib/logger` directly.

**Files:**
- Modify: `lib/api-utils.ts`
- Modify: `lib/redis.ts`
- Modify: `lib/token-blacklist.ts`
- Modify: `lib/billing/emails.ts`
- Modify: `lib/carddav/sync.ts`
- Modify: `lib/carddav/auto-export.ts`
- Modify: `lib/carddav/discover.ts`
- Modify: `lib/carddav/client.ts`
- Modify: `lib/carddav/delete-contact.ts`
- Modify: `app/api/cron/carddav-sync/route.ts`
- Modify: `app/api/cron/send-reminders/route.ts`
- Modify: `app/api/[...notfound]/route.ts`
- Modify: `app/api/webhooks/stripe/route.ts`
- Modify: `app/api/auth/register/route.ts`
- Modify: `app/api/auth/verify-email/route.ts`
- Modify: `app/api/auth/reset-password/route.ts`
- Modify: `app/api/log-error/route.ts`
- Modify: `app/api/user/delete/route.ts`
- Modify: `app/api/unsubscribe/route.ts`
- Modify: `app/actions/auth.ts`

**Step 1: Update the calling convention in all files**

The pattern change is:

```typescript
// OLD:
logger.info('Message', { key: 'value' });
logger.error('Error occurred', { context: 'foo' }, error);
logger.warn('Warning', { data: 123 });

// NEW (Pino convention — context object first, message string second):
logger.info({ key: 'value' }, 'Message');
logger.error({ err: error, context: 'foo' }, 'Error occurred');
logger.warn({ data: 123 }, 'Warning');

// For messages with no context:
// OLD: logger.info('Simple message');
// NEW: logger.info('Simple message');  // Same — Pino accepts a string-only call
```

For `lib/api-utils.ts` specifically, update `handleApiError`:

```typescript
// OLD:
logger.error(`API Error in ${context}`, { context, ...additionalInfo }, errorObj);

// NEW:
logger.error({ err: errorObj, context, ...additionalInfo }, `API Error in ${context}`);
```

For `lib/carddav/*.ts` files, also import `createModuleLogger` and use a module-scoped child logger:

```typescript
// At the top of each carddav lib file:
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('carddav');

// Then use `log` instead of `logger`:
log.info({ syncId }, 'Sync started');
log.error({ err }, 'vCard processing failed');
```

Similarly for `lib/redis.ts` → `createModuleLogger('redis')`, `lib/billing/emails.ts` → `createModuleLogger('billing')`, `lib/token-blacklist.ts` → `createModuleLogger('auth')`.

For API routes that already import `logger`, update the calling convention only (don't add child loggers to routes — they'll use the base `logger`).

**Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — no regressions.

**Step 3: Run the linter and type checker**

Run: `npm run lint && npm run typecheck`
Expected: PASS — no new errors.

**Step 4: Commit**

```bash
git add lib/ app/
git commit -m "refactor: update all logger callers to Pino API convention"
```

---

### Task 4: Migrate CardDAV API Routes (console.error → logger)

**Files:**
- Modify: `app/api/carddav/connection/route.ts`
- Modify: `app/api/carddav/connection/test/route.ts`
- Modify: `app/api/carddav/sync/route.ts`
- Modify: `app/api/carddav/import/route.ts`
- Modify: `app/api/carddav/export-bulk/route.ts`
- Modify: `app/api/carddav/backup/route.ts`
- Modify: `app/api/carddav/discover/route.ts`
- Modify: `app/api/carddav/pending-count/route.ts`
- Modify: `app/api/carddav/conflicts/[id]/resolve/route.ts`

**Step 1: Replace all `console.error` calls with structured logger**

In each file, add at the top:

```typescript
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('carddav');
```

Then replace the pattern:

```typescript
// OLD:
console.error('Error creating CardDAV connection:', error);

// NEW:
log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error creating CardDAV connection');
```

For the sync route that uses streaming, be especially careful to replace `console.error` inside the stream controller callbacks.

**Step 2: Verify no remaining `console.*` calls in these files**

Run: `grep -rn 'console\.' app/api/carddav/`
Expected: No matches.

**Step 3: Run the test suite**

Run: `npx vitest run`
Expected: PASS.

**Step 4: Commit**

```bash
git add app/api/carddav/
git commit -m "refactor: migrate CardDAV API routes from console.error to structured logger"
```

---

### Task 5: Migrate Remaining API Routes (console.error → logger)

**Files:**
- Modify: `app/api/people/route.ts`
- Modify: `app/api/people/[id]/route.ts`
- Modify: `app/api/vcard/upload/route.ts`
- Modify: `app/api/vcard/import/route.ts`
- Modify: `app/api/auth/check-verification/route.ts`
- Modify: `app/api/user/language/route.ts`
- Modify: `app/api/dev/clear-rate-limits/route.ts`
- Modify: `app/api/cron/send-reminders/route.ts`
- Modify: `app/api/log-error/route.ts`

**Step 1: Replace all `console.error` / `console.log` / `console.warn` calls**

For each file, import the logger (or `createModuleLogger` where a specific module makes sense):

```typescript
import { logger } from '@/lib/logger';
// or for domain-specific routes:
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('people'); // or 'vcard', 'auth', 'cron'
```

Replace the patterns as in Task 4.

For `send-reminders` cron, replace the per-email `console.log` calls with structured logging:

```typescript
// OLD:
console.log(`Sent reminder for ${personName}'s ${importantDate.title} to ${userEmail}`);

// NEW:
log.info({ personName, dateTitle: importantDate.title, userEmail }, 'Reminder sent');
```

For `app/api/log-error/route.ts`, the catch block's `console.error` is a safety fallback — replace it with the base logger since the module logger itself could theoretically fail:

```typescript
// OLD:
console.error('Failed to log client error:', error);

// NEW:
logger.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to log client error');
```

**Step 2: Verify no remaining server-side `console.*` in API routes**

Run: `grep -rn 'console\.' app/api/`
Expected: No matches.

**Step 3: Run tests and linter**

Run: `npx vitest run && npm run lint`
Expected: PASS.

**Step 4: Commit**

```bash
git add app/api/
git commit -m "refactor: migrate remaining API routes from console.* to structured logger"
```

---

### Task 6: Migrate Lib Files (console.* → logger)

**Files:**
- Modify: `lib/photo-storage.ts`
- Modify: `lib/email.ts`
- Modify: `lib/locale.ts`
- Modify: `lib/vcard-helpers.ts`
- Modify: `lib/client-features.ts`
- Modify: `instrumentation.ts`

**Do NOT modify:** `lib/env.ts` — this runs before the logger is available and intentionally uses `console.error`.

**Step 1: Replace `console.*` calls with module loggers**

For each file:

```typescript
// lib/photo-storage.ts
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('photos');
// Replace console.error/warn with log.error/warn

// lib/email.ts
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('email');

// lib/locale.ts
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('locale');

// lib/vcard-helpers.ts
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('vcard');

// lib/client-features.ts
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('features');

// instrumentation.ts (root level)
import { createModuleLogger } from '@/lib/logger';
const log = createModuleLogger('init');
```

**Step 2: Verify no remaining `console.*` in lib files (except env.ts and logger.ts)**

Run: `grep -rn 'console\.' lib/ instrumentation.ts | grep -v 'env.ts' | grep -v 'logger.ts' | grep -v 'node_modules'`
Expected: No matches.

**Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS.

**Step 4: Commit**

```bash
git add lib/ instrumentation.ts
git commit -m "refactor: migrate lib files from console.* to structured logger"
```

---

### Task 7: Add ESLint no-console Rule

**Files:**
- Modify: `eslint.config.mjs`

**Step 1: Write the failing lint check**

Before adding the rule, verify there are console calls that would be caught:

Run: `npx eslint lib/photo-storage.ts 2>&1 | head -20`
Expected: No `no-console` warnings (rule doesn't exist yet).

**Step 2: Add the no-console rule to `eslint.config.mjs`**

Add a new config entry that targets server-side files and enables `no-console` as a warning:

```javascript
// After the existing global rules block, add:
{
  files: [
    "app/api/**/*.ts",
    "app/actions/**/*.ts",
    "lib/**/*.ts",
    "instrumentation.ts",
  ],
  ignores: ["lib/env.ts"],
  rules: {
    "no-console": "warn",
  },
},
```

This targets only server-side code. Client components (`components/*.tsx`, `app/**/page.tsx`, `app/**/error.tsx`) are intentionally excluded since they can't use the server Pino logger.

**Step 3: Run lint to verify the rule is active**

Run: `npm run lint`
Expected: PASS with zero `no-console` warnings (since we've already migrated all server-side `console.*` calls in Tasks 3-6). If any warnings appear, fix them.

**Step 4: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: add ESLint no-console rule for server-side files"
```

---

### Task 8: Add Datadog Labels to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

**Step 1: Add Datadog autodiscovery labels to the `app` service**

In `docker-compose.yml`, under the `app` service, add the `labels` section:

```yaml
  app:
    image: ghcr.io/mattogodoy/nametag:latest
    container_name: nametag-app
    restart: unless-stopped
    labels:
      com.datadoghq.ad.logs: '[{"source": "nodejs", "service": "nametag"}]'
    ports:
      - 3000:3000
    # ... rest stays the same
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add Datadog autodiscovery labels to docker-compose"
```

---

### Task 9: Final Verification

**Step 1: Run the full verification suite**

Run: `npm run verify`
Expected: Lint, typecheck, tests, and build all pass.

**Step 2: Manual smoke test — check JSON output**

Run: `LOG_LEVEL=debug NODE_ENV=production node -e "const { logger } = require('./lib/logger'); logger.info({ test: true }, 'Smoke test');" 2>&1 || echo "ESM — use: node --import tsx/esm -e \"import('./lib/logger').then(m => m.logger.info({ test: true }, 'Smoke test'))\""`

Alternatively, start the dev server and check that logs are pretty-printed:

Run: `npm run dev` (then check terminal output)
Expected: Colored, human-readable log lines in development.

**Step 3: Verify no remaining unstructured server-side logging**

Run: `grep -rn 'console\.' app/api/ lib/ app/actions/ instrumentation.ts | grep -v node_modules | grep -v env.ts`
Expected: No matches.

**Step 4: Commit any final fixes and tag**

```bash
git add -A
git commit -m "feat: structured logging migration complete"
```
