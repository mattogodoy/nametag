# Security Audit: Code-Level Hardening

**Date:** 2026-03-14
**Scope:** Code-level security audit and hardening of the Nametag SaaS application
**Approach:** Priority-driven fix list — surgical, independent changes ordered by severity

## Context

Nametag is a personal relationships manager SaaS (nametag.one) built with Next.js, Prisma, and PostgreSQL. It stores sensitive personal data (contacts, relationships, photos) and handles payments via Stripe. It integrates with external CardDAV servers for contact sync.

The existing security posture is solid: bcrypt password hashing, JWT with token blacklist, Prisma ORM (no raw SQL), Zod input validation, rate limiting, strong CSP headers, SSRF protection on CardDAV, and Stripe webhook signature verification. This audit addresses the remaining gaps.

## Breaking Changes

Two fixes invalidate existing tokens:
- **1.4 (hash email verification tokens):** Pending verification links become invalid. Tokens expire in 24h, so impact is minimal.
- **2.1 (hash password reset tokens):** Pending reset links become invalid. Same minimal impact.

All other fixes are non-breaking.

---

## Critical Priority

### 1.1 — Harden CSP: remove `unsafe-eval`, assess `unsafe-inline`

**Problem:** `next.config.ts` includes `unsafe-inline` and `unsafe-eval` in the CSP `script-src` directive with a TODO comment. This negates XSS protection in production.

**Fix:**
1. Remove `unsafe-eval` unconditionally — it is never needed in production Next.js.
2. Build the production app with `unsafe-inline` also removed.
3. Test all pages in the browser with CSP violation reporting enabled (`Content-Security-Policy-Report-Only`).
4. If violations occur (Next.js hydration requires inline scripts), implement nonce-based CSP by generating a nonce in `middleware.ts`, passing it via a request header, and referencing it in the CSP directive as `'nonce-<value>'`.
5. If no violations occur, remove `unsafe-inline` outright.

**Files:** `next.config.ts`, potentially `middleware.ts`

### 1.2 — Validate PHOTO_STORAGE_PATH at startup

**Problem:** `lib/photo-storage.ts` uses the configured storage path without validating it resolves to an expected directory. A misconfigured or injected env var could allow filesystem writes anywhere.

**Fix:** At startup, resolve the path to an absolute path, verify it exists and is a directory, reject paths containing `..`. Fail fast with a clear error if validation fails.

**Files:** `lib/photo-storage.ts`

### 1.3 — Add STRIPE_WEBHOOK_SECRET to env validation schema

**Problem:** The Stripe webhook handler in `app/api/webhooks/stripe/route.ts` checks for `STRIPE_WEBHOOK_SECRET` at runtime, but `lib/env.ts` doesn't require it in SaaS mode. Missing secret causes silent 500 errors on webhook delivery.

**Fix:** Add `STRIPE_WEBHOOK_SECRET` to the Zod schema in `lib/env.ts` as required when `SAAS_MODE=true`.

**Files:** `lib/env.ts`

### 1.4 — Hash email verification tokens in database

**Problem:** Verification tokens are stored as plaintext in the database. A database breach exposes all pending tokens, allowing account takeover by verifying arbitrary accounts.

**Fix:** Generate token as before (`randomBytes(32).toString('hex')`). Store `SHA-256(token)` in the `emailVerifyToken` field using `crypto.createHash('sha256').update(token).digest('hex')`. On verification, hash the incoming token and compare against the stored hash. Send the unhashed token in the email link. The DB column type does not need to change — SHA-256 hex output is 64 characters, same as the current token format.

**Breaking change:** Pending verification tokens become invalid. Users must request a new verification email. Impact is minimal given the 24h expiry.

**Files:** `app/api/auth/register/route.ts`, `app/api/auth/verify-email/route.ts`

### 1.5 — SSRF protection for photo URL downloads

**Problem:** `lib/photo-storage.ts` has a `downloadPhoto` function that fetches arbitrary URLs provided by users (when they supply a photo URL instead of uploading a file). There is no validation that the URL doesn't point to internal/private IP addresses.

**Fix:** Reuse the existing `validateServerUrl` utility from `lib/carddav/url-validation.ts` (or extract it to a shared location) to validate the photo URL before fetching. Reject private IPs, loopback, link-local, and non-HTTP(S) protocols.

**Files:** `lib/photo-storage.ts`, `lib/carddav/url-validation.ts` (may extract shared utility)

---

## High Priority

### 2.1 — Hash password reset tokens in database

**Problem:** Same as 1.4 — password reset tokens stored as plaintext. Database breach allows resetting any account's password.

**Fix:** Same pattern as 1.4. Store `SHA-256(token)` using `crypto.createHash('sha256').update(token).digest('hex')`, compare hashes on submission. DB column type unchanged (64 char hex).

**Breaking change:** Pending reset links invalidated. Minimal impact — tokens expire quickly.

**Files:** `app/api/auth/forgot-password/route.ts` (creates token), `app/api/auth/reset-password/route.ts` (consumes token)

### 2.2 — Account lockout after repeated failed logins

**Problem:** Rate limiting exists (5 attempts / 15 min) but an attacker can wait and retry indefinitely. No per-account lockout mechanism.

**Fix:**
- Add `failedLoginAttempts` (Int, default 0) and `lockedUntil` (DateTime, nullable) fields to the User model.
- On failed login: increment `failedLoginAttempts`. After N failures (configurable, default 10), set `lockedUntil` to current time + lockout duration (configurable, default 30 min).
- On successful login: reset `failedLoginAttempts` to 0 and clear `lockedUntil`.
- On login attempt while locked: reject with "account temporarily locked" message without checking password (prevents timing attacks). This check goes in the `authorize` callback inside the NextAuth `CredentialsProvider` config in `lib/auth.ts`.
- Send email notification on lockout. This requires a new email template and new i18n strings in all 6 locale files (`en`, `es-ES`, `de-DE`, `ja-JP`, `nb-NO`, `zh-CN`).

**Files:** `prisma/schema.prisma`, `lib/auth.ts` (specifically the `authorize` callback), `lib/email.ts` (lockout notification template), all locale files in `/locales/`

### 2.3 — Stripe webhook idempotency

**Problem:** If Stripe retries a webhook (network timeout, 5xx), the same event could be processed twice — potentially double-crediting a subscription or creating duplicate records.

**Fix:**
- Create a `StripeEvent` model with `eventId` (String, `@unique`) and `processedAt` (DateTime) fields.
- Before processing, attempt to insert the event ID. Use a unique constraint so that concurrent duplicate deliveries result in a Prisma `P2002` unique violation error rather than a TOCTOU race condition.
- If `P2002` is caught, return 200 and skip processing (event already handled).
- If insert succeeds, proceed with event processing.
- Optionally: add a cleanup job to prune events older than 30 days.

**Files:** `prisma/schema.prisma`, `app/api/webhooks/stripe/route.ts`

*(2.4 dropped — see Out of Scope)*

---

## Medium Priority

### 3.1 — Rate limit email verification endpoint

**Problem:** `/api/auth/verify-email` has no rate limiting. While brute-forcing a 64-character hex token is computationally infeasible, rate limiting is cheap defense-in-depth.

**Fix:** Add rate limiting config: 10 attempts / 15 min per IP. Use the existing `checkRateLimit` utility.

**Files:** `app/api/auth/verify-email/route.ts`, `lib/rate-limit.ts`

### 3.2 — DNS resolution timeout for CardDAV SSRF checks

**Problem:** `dns.promises.resolve*` in `lib/carddav/url-validation.ts` has no timeout. A slow or malicious DNS server could hang the request indefinitely, tying up server resources.

**Fix:** Use `Promise.race` to race the DNS resolution against a 5-second timeout promise that rejects. Alternatively, use the `dns.Resolver` class which supports `cancel()` for cleanup. Treat timeout as a validation failure (reject the URL). Note: `dns.promises` does not support `AbortSignal`, so `Promise.race` is the correct approach.

**Files:** `lib/carddav/url-validation.ts`

### 3.3 — Validate photo paths at write time

**Problem:** Extending 1.2 — even with startup validation, individual file paths should be sanitized at write time to prevent path traversal via crafted `personId` or filename.

**Fix:**
- After constructing the full file path, resolve it and verify it starts with the validated `PHOTO_STORAGE_PATH` prefix.
- Reject any path that escapes the storage directory.
- Ensure `personId` and generated filenames are alphanumeric/UUID-safe (no `/`, `..`, or null bytes).

**Files:** `lib/photo-storage.ts`

### 3.4 — CSRF protection for state-changing API endpoints

**Problem:** The app uses JWT-based sessions. Next.js API routes do not have built-in CSRF protection. While CSP `form-action 'self'` helps, state-changing endpoints (password reset, account settings, person CRUD) are vulnerable to cross-origin requests from a malicious page.

**Fix:** Add an `Origin` header check in middleware or a shared utility. For state-changing requests (POST, PUT, DELETE), verify the `Origin` (or `Referer`) header matches the expected host (`NEXTAUTH_URL`). Reject requests with mismatched or missing `Origin` headers. Apply to all API routes except the Stripe webhook endpoint (which uses its own signature verification).

**Files:** `middleware.ts` or `lib/api-utils.ts`

---

## Low Priority

### 4.1 — Expand `Permissions-Policy` header

**Problem:** The existing `Permissions-Policy` header in `next.config.ts` restricts some browser features but does not cover all unnecessary ones.

**Fix:** Expand the existing header to also restrict: `payment=()`, `usb=()`, `magnetometer=()`, `gyroscope=()`, `accelerometer=()`.

**Files:** `next.config.ts`

---

## Out of Scope

The following were considered and explicitly excluded:

- **PII masking in logs** — dropped per user decision
- **CardDAV sync rate limiting** — dropped per user decision
- **Token out of URL query params** — dropped per user decision
- **Email verification token reuse** — already implemented (token nullified on verification)
- **Password reset token reuse** — already implemented (token nullified on reset)
- **`Referrer-Policy` header** — already set to `strict-origin-when-cross-origin`
- **Infrastructure hardening** — Docker, network, DB access controls are out of scope
- **Security policies** — incident response, secret rotation, pen testing procedures are out of scope
- **Dependency upgrades** — next-auth beta upgrade is a separate effort
- **CardDAV encryption key rotation** — architectural change better suited for a dedicated effort

## Testing Strategy

Each fix should include:
1. Unit tests for the new behavior (e.g., token hashing comparison, path validation rejection, SSRF URL rejection)
2. Verification that existing tests still pass
3. Manual testing for CSP changes (browser console for CSP violations)
4. For CSRF protection: test that cross-origin requests are rejected and same-origin requests succeed
