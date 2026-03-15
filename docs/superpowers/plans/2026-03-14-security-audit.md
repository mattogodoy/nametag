# Security Audit: Code-Level Hardening — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 13 code-level security gaps identified in the security audit spec (`docs/superpowers/specs/2026-03-14-security-audit-design.md`).

**Architecture:** Each fix is a self-contained change with its own tests and commit. Fixes are ordered by priority (critical → low) but are independent — any fix can be implemented without the others. TDD approach: write failing test first, then implement.

**Tech Stack:** Next.js, Prisma, Vitest, Node.js `crypto` module, Zod

**Spec:** `docs/superpowers/specs/2026-03-14-security-audit-design.md`

---

## Chunk 1: Token Hashing (Fixes 1.4, 2.1)

### Task 1: Hash email verification tokens

**Files:**
- Modify: `app/api/auth/register/route.ts:17-19,71-74`
- Modify: `app/api/auth/verify-email/route.ts:18-20`
- Create: `lib/token-hash.ts`
- Modify: `tests/api/auth.test.ts`

- [ ] **Step 1: Create the token hashing utility**

Create `lib/token-hash.ts`:

```typescript
import { createHash, randomBytes } from 'crypto';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 2: Write the failing test for hashed token storage**

Add to `tests/api/auth.test.ts` in the registration describe block:

```typescript
it('should store a hashed verification token, not the raw token', async () => {
  mocks.userFindUnique.mockResolvedValue(null);
  mocks.userCreate.mockResolvedValue({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test',
  });

  const request = new Request('http://localhost/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'ValidPassword123!',
      name: 'Test',
    }),
    headers: { 'content-type': 'application/json' },
  });

  await register(request);

  const createCall = mocks.userCreate.mock.calls[0][0];
  const storedToken = createCall.data.emailVerifyToken;
  // Token should be a 64-char hex string (SHA-256 output)
  expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
  // The email should contain the raw token, not the hash
  const emailCall = mocks.sendEmail.mock.calls[0];
  const emailBody = JSON.stringify(emailCall);
  // The stored token should NOT appear in the email (email has the raw token)
  expect(emailBody).not.toContain(storedToken);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/api/auth.test.ts --reporter=verbose`
Expected: FAIL — the stored token currently matches the raw token sent in the email.

- [ ] **Step 4: Update register route to hash the token before storing**

In `app/api/auth/register/route.ts`, replace the token generation import and usage:

```typescript
// Replace: import { randomBytes } from 'crypto';
// Replace: function generateVerificationToken() { return randomBytes(32).toString('hex'); }
// With:
import { generateToken, hashToken } from '@/lib/token-hash';
```

Update the user creation code (around line 71):

```typescript
const rawToken = generateToken();
const hashedToken = hashToken(rawToken);

// In prisma.user.create data:
// Replace: emailVerifyToken: verifyToken
// With: emailVerifyToken: hashedToken

// In the email URL (around line 99):
// Use rawToken (not hashedToken): `${getAppUrl()}/verify-email?token=${rawToken}`
```

- [ ] **Step 5: Update verify-email route to hash incoming token before lookup**

In `app/api/auth/verify-email/route.ts`, update the lookup (around line 18):

```typescript
import { hashToken } from '@/lib/token-hash';

// Replace:
// const user = await prisma.user.findUnique({ where: { emailVerifyToken: token } });
// With:
const hashedToken = hashToken(token);
const user = await prisma.user.findUnique({ where: { emailVerifyToken: hashedToken } });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/api/auth.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/token-hash.ts app/api/auth/register/route.ts app/api/auth/verify-email/route.ts tests/api/auth.test.ts
git commit -m "fix: hash email verification tokens before storing in database"
```

---

### Task 2: Hash password reset tokens

**Files:**
- Modify: `app/api/auth/forgot-password/route.ts:13-15,70-81`
- Modify: `app/api/auth/reset-password/route.ts:27-34`
- Modify: `tests/api/auth.test.ts`

- [ ] **Step 1: Write the failing test for hashed password reset token**

Add to `tests/api/auth.test.ts` in the forgot-password describe block:

```typescript
it('should store a hashed reset token, not the raw token', async () => {
  const existingUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordResetSentAt: null,
  };
  mocks.userFindUnique.mockResolvedValue(existingUser);
  mocks.userUpdate.mockResolvedValue(existingUser);

  const request = new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com' }),
    headers: { 'content-type': 'application/json' },
  });

  await forgotPassword(request);

  const updateCall = mocks.userUpdate.mock.calls[0][0];
  const storedToken = updateCall.data.passwordResetToken;
  expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
  // Email should contain the raw token, not the hash
  const emailCall = mocks.sendEmail.mock.calls[0];
  const emailBody = JSON.stringify(emailCall);
  expect(emailBody).not.toContain(storedToken);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/auth.test.ts --reporter=verbose`
Expected: FAIL

- [ ] **Step 3: Update forgot-password route to hash token**

In `app/api/auth/forgot-password/route.ts`:

```typescript
// Replace: import { randomBytes } from 'crypto';
// Replace: function generateResetToken() { return randomBytes(32).toString('hex'); }
// With:
import { generateToken, hashToken } from '@/lib/token-hash';

// In the update call (around line 70):
const rawToken = generateToken();
const hashedToken = hashToken(rawToken);

// Replace: passwordResetToken: resetToken
// With: passwordResetToken: hashedToken

// In the email URL: use rawToken
```

- [ ] **Step 4: Update reset-password route to hash incoming token before lookup**

In `app/api/auth/reset-password/route.ts` (around line 27), the route uses `findFirst` with a compound `where` clause that also checks token expiry. Preserve this pattern:

```typescript
import { hashToken } from '@/lib/token-hash';

// Replace the where clause in findFirst:
const user = await prisma.user.findFirst({
  where: {
    passwordResetToken: hashToken(token),  // was: token
    passwordResetExpires: {
      gt: new Date(),  // Keep this expiry check
    },
  },
});
```

Important: Do NOT change `findFirst` to `findUnique` — the compound `where` with `passwordResetExpires` requires `findFirst`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/api/auth.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts tests/api/auth.test.ts
git commit -m "fix: hash password reset tokens before storing in database"
```

---

## Chunk 2: Environment & Path Validation (Fixes 1.2, 1.3, 3.3)

### Task 3: Validate PHOTO_STORAGE_PATH at startup and at write time

**Files:**
- Modify: `lib/photo-storage.ts:52,59,241,349`
- Create: `tests/lib/photo-storage-security.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/photo-storage-security.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import path from 'path';

// Import the validation functions we'll create
import { validateStoragePath, validateFilePath } from '@/lib/photo-storage';

describe('Photo Storage Security', () => {
  describe('validateStoragePath', () => {
    it('should reject paths containing ..', () => {
      expect(() => validateStoragePath('/data/../etc')).toThrow('invalid');
    });

    it('should reject relative paths', () => {
      expect(() => validateStoragePath('data/photos')).toThrow('absolute');
    });

    it('should accept valid absolute paths', () => {
      expect(() => validateStoragePath('/data/photos')).not.toThrow();
    });
  });

  describe('validateFilePath', () => {
    const basePath = '/data/photos';

    it('should reject paths that escape the base directory', () => {
      const malicious = path.join(basePath, '..', '..', 'etc', 'passwd');
      expect(() => validateFilePath(malicious, basePath)).toThrow('escape');
    });

    it('should reject filenames with null bytes', () => {
      const malicious = path.join(basePath, 'user1', 'file\x00.jpg');
      expect(() => validateFilePath(malicious, basePath)).toThrow();
    });

    it('should accept paths within the base directory', () => {
      const valid = path.join(basePath, 'user1', 'photo.jpg');
      expect(() => validateFilePath(valid, basePath)).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/photo-storage-security.test.ts --reporter=verbose`
Expected: FAIL — functions don't exist yet.

- [ ] **Step 3: Add validation functions to photo-storage.ts**

Add to `lib/photo-storage.ts`:

```typescript
import path from 'path';

export function validateStoragePath(storagePath: string): string {
  if (!path.isAbsolute(storagePath)) {
    throw new Error('PHOTO_STORAGE_PATH must be an absolute path');
  }
  if (storagePath.includes('..')) {
    throw new Error('PHOTO_STORAGE_PATH contains invalid path traversal');
  }
  return path.resolve(storagePath);
}

export function validateFilePath(filePath: string, basePath: string): void {
  if (filePath.includes('\x00')) {
    throw new Error('File path contains null bytes');
  }
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(basePath);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error('File path attempts to escape storage directory');
  }
}
```

- [ ] **Step 4: Apply validateStoragePath at module initialization**

Update `getPhotoStoragePath()` in `lib/photo-storage.ts`:

```typescript
let _validatedPath: string | null = null;

export function getPhotoStoragePath(): string {
  if (!_validatedPath) {
    const configuredPath = process.env.PHOTO_STORAGE_PATH || path.resolve('./data/photos');
    _validatedPath = validateStoragePath(
      path.isAbsolute(configuredPath) ? configuredPath : path.resolve(configuredPath)
    );
  }
  return _validatedPath;
}
```

- [ ] **Step 5: Apply validateFilePath at write time**

In every function that constructs a file path (savePhoto, readPhoto, deletePhoto), add after path construction:

```typescript
const fullPath = path.join(dirPath, filename);
validateFilePath(fullPath, getPhotoStoragePath());
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/lib/photo-storage-security.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add lib/photo-storage.ts tests/lib/photo-storage-security.test.ts
git commit -m "fix: validate PHOTO_STORAGE_PATH and prevent path traversal"
```

---

### Task 4: Add STRIPE_WEBHOOK_SECRET to env validation

**Files:**
- Modify: `lib/env.ts:119-139`
- Modify: `tests/lib/env.test.ts` (or create if it doesn't exist)

- [ ] **Step 1: Write the failing test**

Add test to verify STRIPE_WEBHOOK_SECRET is required in SaaS mode:

```typescript
it('should require STRIPE_WEBHOOK_SECRET when SAAS_MODE is true', () => {
  // Note: validateEnv() reads from process.env, not from arguments.
  // Save and restore process.env around the test.
  const originalEnv = process.env;
  process.env = {
    ...process.env,
    SAAS_MODE: 'true',
    // Include all other required SaaS vars (NEXTAUTH_SECRET, NEXTAUTH_URL, etc.)
    // but omit STRIPE_WEBHOOK_SECRET
  };

  try {
    // validateEnv() should throw or return an error result
    expect(() => validateEnv()).toThrow(/STRIPE_WEBHOOK_SECRET/);
  } finally {
    process.env = originalEnv;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/env.test.ts --reporter=verbose`
Expected: FAIL — STRIPE_WEBHOOK_SECRET not validated.

- [ ] **Step 3: Add STRIPE_WEBHOOK_SECRET to Zod schema**

In `lib/env.ts`, add to the schema (near line 53):

```typescript
STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
```

Then in the SaaS validation block (around line 119), add:

```typescript
if (!result.data.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/env.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/env.ts tests/lib/env.test.ts
git commit -m "fix: require STRIPE_WEBHOOK_SECRET in SaaS mode env validation"
```

---

### Task 5: Validate photo paths at write time (extends Task 3)

This is already covered by Task 3's `validateFilePath` implementation. Task 3 includes both startup validation (1.2) and write-time validation (3.3). No separate task needed.

---

## Chunk 3: SSRF & Network Protections (Fixes 1.5, 3.2)

### Task 6: SSRF protection for photo URL downloads

**Files:**
- Modify: `lib/photo-storage.ts` (downloadPhoto function, around line 167)
- Modify: `lib/carddav/url-validation.ts` (extract shared utility or reuse directly)
- Create: `tests/lib/photo-download-ssrf.test.ts`

- [ ] **Step 1: Export downloadPhoto from photo-storage.ts**

`downloadPhoto` is currently a private module function. Add `export` to its declaration in `lib/photo-storage.ts` (around line 167):

```typescript
// Change: async function downloadPhoto(url: string): Promise<Buffer> {
// To:
export async function downloadPhoto(url: string): Promise<Buffer> {
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/photo-download-ssrf.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSaasMode: vi.fn(),
}));

vi.mock('@/lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

// Import after mocks
import { downloadPhoto } from '@/lib/photo-storage';

describe('downloadPhoto SSRF protection', () => {
  it('should reject private IP URLs in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('http://192.168.1.1/photo.jpg')).rejects.toThrow(
      /internal/i
    );
  });

  it('should reject localhost URLs in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('http://localhost/photo.jpg')).rejects.toThrow(
      /internal/i
    );
  });

  it('should reject non-HTTP protocols', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('ftp://example.com/photo.jpg')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/photo-download-ssrf.test.ts --reporter=verbose`
Expected: FAIL — no SSRF validation on downloadPhoto (tests will fail with network errors or no SSRF rejection).

- [ ] **Step 4: Add SSRF validation to downloadPhoto**

In `lib/photo-storage.ts`, in the `downloadPhoto` function (around line 167), add URL validation before the fetch:

```typescript
import { validateServerUrl } from '@/lib/carddav/url-validation';

export async function downloadPhoto(url: string): Promise<Buffer> {
  // Validate URL for SSRF protection
  await validateServerUrl(url);

  // ... existing download logic
}
```

Note: `validateServerUrl` already handles protocol whitelisting, private IP rejection, and DNS rebinding checks. It only enforces restrictions in SaaS mode, which is the correct behavior (self-hosted users may need to reach local servers).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/photo-download-ssrf.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/photo-storage.ts tests/lib/photo-download-ssrf.test.ts
git commit -m "fix: add SSRF protection to photo URL downloads"
```

---

### Task 7: DNS resolution timeout for CardDAV SSRF checks

**Files:**
- Modify: `lib/carddav/url-validation.ts:59-87`
- Create: `tests/lib/carddav/url-validation-timeout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/carddav/url-validation-timeout.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
  isSaasMode: vi.fn(),
}));

vi.mock('dns', () => ({
  promises: {
    resolve4: mocks.resolve4,
    resolve6: mocks.resolve6,
  },
}));

vi.mock('@/lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

import { validateServerUrl } from '@/lib/carddav/url-validation';

describe('DNS resolution timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject URLs when DNS resolution takes longer than 5 seconds', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    // Simulate a DNS resolution that never resolves
    mocks.resolve4.mockReturnValue(new Promise(() => {})); // never resolves
    mocks.resolve6.mockReturnValue(new Promise(() => {})); // never resolves

    const promise = validateServerUrl('https://slow-dns.example.com/');

    // Advance timers past the 5-second timeout
    await vi.advanceTimersByTimeAsync(6000);

    await expect(promise).rejects.toThrow(/timeout|resolve/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/carddav/url-validation-timeout.test.ts --reporter=verbose`
Expected: FAIL — test will hang (no timeout enforced) until vitest's default timeout.

- [ ] **Step 3: Add Promise.race timeout to DNS resolution**

In `lib/carddav/url-validation.ts`, update the DNS resolution block (around line 59):

```typescript
const DNS_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// Replace the existing Promise.allSettled block:
const [v4Result, v6Result] = await Promise.allSettled([
  withTimeout(dns.promises.resolve4(cleanHostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
  withTimeout(dns.promises.resolve6(cleanHostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/carddav/url-validation-timeout.test.ts --reporter=verbose`
Expected: PASS (should complete in ~5s, not hang)

- [ ] **Step 5: Commit**

```bash
git add lib/carddav/url-validation.ts tests/lib/carddav/url-validation-timeout.test.ts
git commit -m "fix: add 5-second DNS resolution timeout to SSRF checks"
```

---

## Chunk 4: Account Lockout (Fix 2.2)

### Task 8: Add lockout fields to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (User model, around line 38)

- [ ] **Step 1: Add fields to User model**

In `prisma/schema.prisma`, add after `lastLoginAt` (around line 38):

```prisma
  failedLoginAttempts  Int       @default(0)
  lockedUntil          DateTime?
```

- [ ] **Step 2: Create migration**

Run: `npx prisma migrate dev --name add-account-lockout-fields`
Expected: Migration created and applied successfully.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add account lockout fields to User model"
```

---

### Task 9: Implement account lockout logic in authorize callback

**Files:**
- Modify: `lib/auth.ts:10-74` (authorize callback)
- Create: `tests/lib/auth-lockout.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/auth-lockout.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  bcryptCompare: vi.fn(),
  isFeatureEnabled: vi.fn(),
  normalizeEmail: vi.fn((e: string) => e.toLowerCase()),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));
vi.mock('bcryptjs', () => ({
  compare: mocks.bcryptCompare,
  default: { compare: mocks.bcryptCompare },
}));
vi.mock('@/lib/features', () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));
vi.mock('@/lib/api-utils', () => ({ normalizeEmail: mocks.normalizeEmail }));
vi.mock('@/lib/email', () => ({ sendEmail: mocks.sendEmail }));

// Import the authorize function (you'll need to export it for testing)
import { authorizeCredentials } from '@/lib/auth';

describe('Account Lockout', () => {
  const lockedUser = {
    id: 'user-1',
    email: 'locked@example.com',
    password: 'hashed',
    failedLoginAttempts: 10,
    lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // locked for 30 more min
    emailVerified: true,
  };

  const normalUser = {
    id: 'user-2',
    email: 'normal@example.com',
    password: 'hashed',
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerified: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockReturnValue(false);
  });

  it('should reject login for locked accounts without checking password', async () => {
    mocks.userFindUnique.mockResolvedValue(lockedUser);

    const result = await authorizeCredentials({
      email: 'locked@example.com',
      password: 'any-password',
    });

    expect(result).toBeNull();
    expect(mocks.bcryptCompare).not.toHaveBeenCalled();
  });

  it('should increment failedLoginAttempts on wrong password', async () => {
    mocks.userFindUnique.mockResolvedValue(normalUser);
    mocks.bcryptCompare.mockResolvedValue(false);
    mocks.userUpdate.mockResolvedValue(normalUser);

    await authorizeCredentials({
      email: 'normal@example.com',
      password: 'wrong',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: { increment: 1 },
        }),
      })
    );
  });

  it('should lock account after 10 failed attempts', async () => {
    const almostLockedUser = { ...normalUser, failedLoginAttempts: 9 };
    mocks.userFindUnique.mockResolvedValue(almostLockedUser);
    mocks.bcryptCompare.mockResolvedValue(false);
    mocks.userUpdate.mockResolvedValue(almostLockedUser);

    await authorizeCredentials({
      email: 'normal@example.com',
      password: 'wrong',
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lockedUntil: expect.any(Date),
        }),
      })
    );
  });

  it('should reset failedLoginAttempts on successful login', async () => {
    const userWithFailures = { ...normalUser, failedLoginAttempts: 3 };
    mocks.userFindUnique.mockResolvedValue(userWithFailures);
    mocks.bcryptCompare.mockResolvedValue(true);
    mocks.userUpdate.mockResolvedValue(userWithFailures);

    const result = await authorizeCredentials({
      email: 'normal@example.com',
      password: 'correct',
    });

    expect(result).not.toBeNull();
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: expect.any(Date),
        }),
      })
    );
  });

  it('should allow login after lockout expires', async () => {
    const expiredLockUser = {
      ...lockedUser,
      lockedUntil: new Date(Date.now() - 1000), // expired 1 second ago
    };
    mocks.userFindUnique.mockResolvedValue(expiredLockUser);
    mocks.bcryptCompare.mockResolvedValue(true);
    mocks.userUpdate.mockResolvedValue(expiredLockUser);

    const result = await authorizeCredentials({
      email: 'locked@example.com',
      password: 'correct',
    });

    expect(result).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/auth-lockout.test.ts --reporter=verbose`
Expected: FAIL — `authorizeCredentials` not exported, lockout logic doesn't exist.

- [ ] **Step 3: Extract authorize logic into testable function**

In `lib/auth.ts`, extract the authorize logic into an exported function:

```typescript
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function authorizeCredentials(credentials: {
  email?: string;
  password?: string;
}): Promise<{ id: string; email: string; name: string; surname: string | null; nickname: string | null; photo: string | null } | null> {
  const { prisma } = await import('@/lib/prisma');
  const bcrypt = await import('bcryptjs');
  const { isFeatureEnabled } = await import('@/lib/features');
  const { normalizeEmail } = await import('@/lib/api-utils');

  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = normalizeEmail(credentials.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return null;
  if (!user.password) return null;

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return null; // Don't check password — prevents timing attacks
  }

  const passwordMatch = await bcrypt.compare(credentials.password, user.password);

  if (!passwordMatch) {
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: Record<string, unknown> = {
      failedLoginAttempts: { increment: 1 },
    };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return null;
  }

  // Check email verification (SaaS only)
  if (isFeatureEnabled('emailVerification') && !user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  // Successful login: reset lockout counters and update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    nickname: user.nickname,
    photo: user.photo,
  };
}
```

Then update the CredentialsProvider to use it:

```typescript
async authorize(credentials) {
  return authorizeCredentials(credentials as { email?: string; password?: string });
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/auth-lockout.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/auth.ts tests/lib/auth-lockout.test.ts
git commit -m "feat: add account lockout after 10 failed login attempts"
```

---

### Task 10: Add lockout email notification and i18n strings

**Files:**
- Modify: `lib/auth.ts` (send notification on lockout)
- Modify: `lib/email.ts` (add lockout email template)
- Modify: `locales/en.json`, `locales/es-ES.json`, `locales/de-DE.json`, `locales/ja-JP.json`, `locales/nb-NO.json`, `locales/zh-CN.json`

- [ ] **Step 1: Add i18n strings to all locale files**

Add to `locales/en.json` under an `auth` namespace:

```json
"auth": {
  "accountLocked": {
    "subject": "Account temporarily locked",
    "body": "Your account has been temporarily locked due to too many failed login attempts. It will be automatically unlocked in 30 minutes. If you did not attempt to log in, please reset your password immediately."
  }
}
```

Add equivalent translations to all other locale files:

`locales/es-ES.json`:
```json
"auth": {
  "accountLocked": {
    "subject": "Cuenta bloqueada temporalmente",
    "body": "Tu cuenta ha sido bloqueada temporalmente debido a demasiados intentos de inicio de sesión fallidos. Se desbloqueará automáticamente en 30 minutos. Si no intentaste iniciar sesión, restablece tu contraseña inmediatamente."
  }
}
```

`locales/de-DE.json`:
```json
"auth": {
  "accountLocked": {
    "subject": "Konto vorübergehend gesperrt",
    "body": "Ihr Konto wurde aufgrund zu vieler fehlgeschlagener Anmeldeversuche vorübergehend gesperrt. Es wird in 30 Minuten automatisch entsperrt. Wenn Sie nicht versucht haben, sich anzumelden, setzen Sie bitte sofort Ihr Passwort zurück."
  }
}
```

`locales/ja-JP.json`:
```json
"auth": {
  "accountLocked": {
    "subject": "アカウントが一時的にロックされました",
    "body": "ログイン試行の失敗が多すぎるため、アカウントが一時的にロックされました。30分後に自動的にロック解除されます。ログインを試みていない場合は、すぐにパスワードをリセットしてください。"
  }
}
```

`locales/nb-NO.json`:
```json
"auth": {
  "accountLocked": {
    "subject": "Kontoen er midlertidig låst",
    "body": "Kontoen din har blitt midlertidig låst på grunn av for mange mislykkede påloggingsforsøk. Den vil automatisk bli låst opp om 30 minutter. Hvis du ikke forsøkte å logge inn, vennligst tilbakestill passordet ditt umiddelbart."
  }
}
```

`locales/zh-CN.json`:
```json
"auth": {
  "accountLocked": {
    "subject": "账户已被临时锁定",
    "body": "由于登录失败次数过多，您的账户已被临时锁定。30分钟后将自动解锁。如果您没有尝试登录，请立即重置密码。"
  }
}
```

- [ ] **Step 2: Add lockout notification to auth logic**

In `lib/auth.ts`, in the lockout branch (where `newAttempts >= MAX_FAILED_ATTEMPTS`), add email notification. The `user` object from `findUnique` includes the `language` field, so use it to load the correct locale strings. Fire asynchronously (non-blocking):

```typescript
if (newAttempts >= MAX_FAILED_ATTEMPTS) {
  updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

  // Send lockout notification (non-blocking)
  // Use user's language preference, fallback to English
  const locale = user.language || 'en';
  import(`@/../locales/${locale}.json`).then((messages) => {
    const lockoutMessages = messages.auth?.accountLocked;
    const subject = lockoutMessages?.subject || 'Account temporarily locked';
    const text = lockoutMessages?.body || 'Your account has been temporarily locked due to too many failed login attempts.';

    return import('@/lib/email').then(({ sendEmail }) =>
      sendEmail({ to: user.email, subject, text })
    );
  }).catch(() => {}); // Don't fail login on email error
}
```

- [ ] **Step 3: Write test for lockout email notification**

Add to `tests/lib/auth-lockout.test.ts`:

```typescript
it('should send email notification when account is locked', async () => {
  const almostLockedUser = { ...normalUser, failedLoginAttempts: 9, language: 'en' };
  mocks.userFindUnique.mockResolvedValue(almostLockedUser);
  mocks.bcryptCompare.mockResolvedValue(false);
  mocks.userUpdate.mockResolvedValue(almostLockedUser);
  mocks.sendEmail.mockResolvedValue({ success: true });

  await authorizeCredentials({
    email: 'normal@example.com',
    password: 'wrong',
  });

  // Wait for async email to fire
  await vi.waitFor(() => {
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'normal@example.com',
        subject: expect.stringContaining('locked'),
      })
    );
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/lib/auth-lockout.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/email.ts locales/en.json locales/es-ES.json locales/de-DE.json locales/ja-JP.json locales/nb-NO.json locales/zh-CN.json
git commit -m "feat: send email notification on account lockout with i18n"
```

---

## Chunk 5: Stripe Webhook Idempotency (Fix 2.3)

### Task 11: Add StripeEvent model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add StripeEvent model**

Add to `prisma/schema.prisma`:

```prisma
model StripeEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique
  processedAt DateTime @default(now())

  @@index([processedAt])
  @@map("stripe_events")
}
```

- [ ] **Step 2: Create migration**

Run: `npx prisma migrate dev --name add-stripe-event-idempotency`
Expected: Migration created and applied.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add StripeEvent model for webhook idempotency"
```

---

### Task 12: Implement webhook idempotency

**Files:**
- Modify: `app/api/webhooks/stripe/route.ts`
- Create: `tests/api/webhooks/stripe-idempotency.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/webhooks/stripe-idempotency.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  stripeEventCreate: vi.fn(),
  constructWebhookEvent: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeEvent: {
      create: mocks.stripeEventCreate,
    },
    subscription: {
      update: mocks.subscriptionUpdate,
      findUnique: mocks.subscriptionFindUnique,
    },
    user: {
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('@/lib/billing/stripe', () => ({
  constructWebhookEvent: mocks.constructWebhookEvent,
}));

// Import after mocks
import { POST } from '@/app/api/webhooks/stripe/route';

describe('Stripe webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'test-secret';
  });

  it('should skip processing when event was already processed (P2002)', async () => {
    // Mock signature verification to succeed
    mocks.constructWebhookEvent.mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    });

    // Mock P2002 unique constraint error (event already exists)
    const duplicateError = new Error('Unique constraint failed');
    (duplicateError as Record<string, unknown>).code = 'P2002';
    mocks.stripeEventCreate.mockRejectedValue(duplicateError);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'test-body',
      headers: {
        'stripe-signature': 'test-sig',
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    // Verify the handler did NOT process the event
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
  });

  it('should process event when it has not been seen before', async () => {
    mocks.constructWebhookEvent.mockReturnValue({
      id: 'evt_new',
      type: 'invoice.paid',
      data: { object: { subscription: 'sub_123', amount_paid: 1000 } },
    });

    // Event insert succeeds (not a duplicate)
    mocks.stripeEventCreate.mockResolvedValue({ id: 'cuid', eventId: 'evt_new' });
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: 'test-body',
      headers: {
        'stripe-signature': 'test-sig',
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    // Event was processed (stripeEvent.create succeeded, handler ran)
    expect(mocks.stripeEventCreate).toHaveBeenCalledWith({
      data: { eventId: 'evt_new' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/webhooks/stripe-idempotency.test.ts --reporter=verbose`
Expected: FAIL — no idempotency logic exists.

- [ ] **Step 3: Add idempotency check to webhook handler**

In `app/api/webhooks/stripe/route.ts`, after successful event construction (around line 55), add:

```typescript
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// After: event = constructWebhookEvent(body, signature, webhookSecret);

// Idempotency: try to record this event. If it already exists, skip.
try {
  await prisma.stripeEvent.create({
    data: { eventId: event.id },
  });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    // Event already processed — return success to prevent Stripe retries
    logger.info({ eventId: event.id }, 'Skipping duplicate Stripe event');
    return NextResponse.json({ received: true });
  }
  throw error; // Unexpected error — rethrow
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/webhooks/stripe-idempotency.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/stripe/route.ts tests/api/webhooks/stripe-idempotency.test.ts
git commit -m "fix: add idempotency to Stripe webhook handler using unique constraint"
```

---

## Chunk 6: CSP Hardening (Fix 1.1)

### Task 13: Remove unsafe-eval from CSP

**Files:**
- Modify: `next.config.ts:62-94`

- [ ] **Step 1: Remove unsafe-eval from both CSP definitions**

In `next.config.ts`, in the main CSP (around line 63), change:

```typescript
// From:
"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Remove unsafe-inline and unsafe-eval in production
// To:
"script-src 'self' 'unsafe-inline'", // TODO: Remove unsafe-inline — verify with production build first
```

Note: The `/api/docs` CSP does NOT have `unsafe-eval` — it only has `'unsafe-inline'` and `https://unpkg.com`. No changes needed there for this step.

- [ ] **Step 2: Build the production app to verify no breakage**

Run: `npm run build`
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix: remove unsafe-eval from CSP script-src directive"
```

---

### Task 14: Assess and remove unsafe-inline from CSP

**Files:**
- Modify: `next.config.ts`
- Potentially modify: `middleware.ts` (if nonce-based CSP needed)

- [ ] **Step 1: Build and test with unsafe-inline removed**

Temporarily remove `'unsafe-inline'` from the CSP in `next.config.ts`:

```typescript
"script-src 'self'",
```

Run: `npm run build && npm run start`

- [ ] **Step 2: Open the app in a browser and check for CSP violations**

Open DevTools → Console. Navigate through key pages: login, dashboard, people list, person detail, settings. Check for any `Refused to execute inline script` errors.

- [ ] **Step 3a: If NO violations — keep unsafe-inline removed**

Remove the TODO comment. Done.

- [ ] **Step 3b: If violations — implement nonce-based CSP**

Create or update `middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64');
  const response = NextResponse.next();

  // Set the nonce as a request header so pages can use it
  response.headers.set('x-nonce', nonce);

  // Override CSP with nonce
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // ... other directives from next.config.ts
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}
```

Then remove the static CSP headers from `next.config.ts` (since middleware now handles them dynamically).

- [ ] **Step 4: Verify the chosen approach works**

Run: `npm run build && npm run start`
Check browser console for CSP violations on all key pages.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts middleware.ts
git commit -m "fix: remove unsafe-inline from CSP (nonce-based if needed)"
```

---

## Chunk 7: Rate Limiting & CSRF (Fixes 3.1, 3.4)

### Task 15: Rate limit email verification endpoint

**Files:**
- Modify: `app/api/auth/verify-email/route.ts`
- Modify: `lib/rate-limit.ts` (add config)

- [ ] **Step 1: Add rate limit config**

In `lib/rate-limit.ts`, add to `rateLimitConfigs`:

```typescript
verifyEmail: { maxAttempts: 10, windowMs: 15 * 60 * 1000 }, // 10/15min
```

- [ ] **Step 2: Add rate limit check to verify-email route**

In `app/api/auth/verify-email/route.ts`, at the start of the POST handler. Most auth routes use the sync `lib/rate-limit` module (not the async Redis version), so follow that pattern:

```typescript
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, 'verifyEmail');
  if (rateLimitResponse) return rateLimitResponse;

  // ... existing logic
}
```

- [ ] **Step 3: Run existing tests to check for regressions**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/verify-email/route.ts lib/rate-limit.ts
git commit -m "fix: add rate limiting to email verification endpoint"
```

---

### Task 16: Add CSRF protection for state-changing API endpoints

**Files:**
- Create: `lib/csrf.ts`
- Create: `tests/lib/csrf.test.ts`
- Modify: `lib/api-utils.ts` (integrate into withAuth)

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/csrf.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAppUrl: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  getAppUrl: mocks.getAppUrl,
}));

import { validateOrigin } from '@/lib/csrf';

describe('CSRF Origin Validation', () => {
  beforeEach(() => {
    mocks.getAppUrl.mockReturnValue('https://nametag.one');
  });

  it('should allow requests with matching origin', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { origin: 'https://nametag.one' },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should reject requests with mismatched origin', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    expect(validateOrigin(request)).toBe(false);
  });

  it('should allow GET requests without origin check', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'GET',
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow requests without origin header (same-origin browser requests)', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
    });
    // No origin header — likely same-origin navigation or server-to-server
    expect(validateOrigin(request)).toBe(true);
  });

  it('should fall back to referer if origin not present', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { referer: 'https://evil.com/attack-page' },
    });
    expect(validateOrigin(request)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/csrf.test.ts --reporter=verbose`
Expected: FAIL — `validateOrigin` doesn't exist.

- [ ] **Step 3: Implement CSRF validation**

Create `lib/csrf.ts`:

```typescript
import { getAppUrl } from '@/lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function validateOrigin(request: Request): boolean {
  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(request.method)) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If neither header is present, allow the request.
  // Trade-off: some browsers omit Origin on same-origin POST, and non-browser
  // clients (cURL, server-to-server) never send it. Blocking these would break
  // legitimate use. The risk is low because an attacker would need to craft a
  // request that strips both Origin and Referer, which modern browsers prevent
  // for cross-origin form submissions.
  if (!origin && !referer) {
    return true;
  }

  const appUrl = getAppUrl();
  const expectedOrigin = new URL(appUrl).origin;

  if (origin) {
    return origin === expectedOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return true;
}
```

- [ ] **Step 4: Integrate into withAuth**

In `lib/api-utils.ts`, update the `withAuth` function to check origin:

```typescript
import { validateOrigin } from '@/lib/csrf';

export function withAuth(handler: AuthenticatedHandler) {
  return withLogging(async (
    request: Request,
    context?: RouteContext
  ): Promise<Response | NextResponse> => {
    if (!validateOrigin(request)) {
      return apiResponse.forbidden('Invalid request origin');
    }

    const session = await auth();
    if (!session?.user?.id) {
      return apiResponse.unauthorized();
    }

    return handler(request, session as AuthenticatedSession, context as RouteContext);
  });
}
```

Note: Do NOT add CSRF validation to the Stripe webhook route — it uses `withLogging` directly, not `withAuth`, and has its own signature verification.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/lib/csrf.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS. If any existing tests fail because they don't set an `origin` header, that's expected — the validation allows requests without origin headers, so they should still pass.

- [ ] **Step 7: Commit**

```bash
git add lib/csrf.ts tests/lib/csrf.test.ts lib/api-utils.ts
git commit -m "fix: add CSRF origin validation to state-changing API endpoints"
```

---

## Chunk 8: Security Headers (Fix 4.1)

### Task 17: Expand Permissions-Policy header

**Files:**
- Modify: `next.config.ts:36-39`

- [ ] **Step 1: Update the Permissions-Policy header**

In `next.config.ts`, find the existing `Permissions-Policy` header (around line 36) and expand it to include additional features:

```typescript
{
  key: 'Permissions-Policy',
  value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
},
```

Preserve any existing restrictions and add the new ones.

- [ ] **Step 2: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix: expand Permissions-Policy header to restrict additional browser features"
```

---

## Final Verification

### Task 18: Full regression test and build verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --reporter=verbose`
Expected: All tests PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run linter**

Run: `npx eslint . --ext .ts,.tsx`
Expected: No new warnings or errors.

- [ ] **Step 4: Verify Prisma schema is in sync**

Run: `npx prisma validate`
Expected: Schema is valid.

- [ ] **Step 5: Review all changes**

Run: `git log --oneline master..HEAD`
Verify all commits are present and have clear messages.
