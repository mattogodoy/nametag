# NameTag Application Security & Code Quality Review Plan

## Executive Summary

This document outlines a comprehensive review plan for the NameTag application - a personal relationships manager built with Next.js, Prisma, and PostgreSQL. The review focuses on security hardening, code quality improvements, architectural optimizations, and production readiness.

---

## Phase 1: Security Audit

### 1.1 Authentication & Authorization

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Missing rate limiting on auth endpoints | HIGH | `app/api/auth/*` | Login, register, forgot-password, and reset-password endpoints lack rate limiting, making them vulnerable to brute force attacks |
| JWT secret configuration | HIGH | `lib/auth.ts` | Verify `NEXTAUTH_SECRET` is properly configured and sufficiently strong |
| Password policy validation | MEDIUM | `app/api/auth/register/route.ts`, `app/api/auth/reset-password/route.ts` | Only checks minimum 8 characters; should add complexity requirements |
| Session token expiration | MEDIUM | `lib/auth.ts` | Review JWT session duration and implement refresh token rotation |
| Email enumeration vulnerability | LOW | `app/api/auth/forgot-password/route.ts` | Rate limiting response reveals timing differences |

**Recommendations:**
- Implement rate limiting using `@upstash/ratelimit` or similar
- Add password complexity validation (uppercase, lowercase, numbers, special chars)
- Configure session expiration and implement token refresh
- Consider adding account lockout after failed attempts

### 1.2 API Security

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Missing input validation | HIGH | All API routes | No schema validation (e.g., Zod) on request bodies |
| IDOR potential in orphan deletion | HIGH | `app/api/people/[id]/route.ts:214-222` | Orphan IDs come from client without re-verification |
| Cron endpoint security | MEDIUM | `app/api/cron/send-reminders/route.ts` | Uses Bearer token but consider IP allowlisting |
| Missing Content-Security-Policy | MEDIUM | `middleware.ts` | No CSP headers configured |
| No request size limits | MEDIUM | `app/api/user/import/route.ts` | Import endpoint accepts unbounded JSON |

**Recommendations:**
- Add Zod validation to all API endpoints
- Re-verify orphan ownership server-side before deletion
- Add security headers (CSP, X-Frame-Options, etc.)
- Implement request size limits

### 1.3 Data Protection

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Sensitive data in JWT | MEDIUM | `lib/auth.ts` | User data stored in client-side JWT token |
| Console logging of sensitive data | LOW | Various API routes | Error logging may expose sensitive information |
| Missing data sanitization | MEDIUM | Email templates | User-provided names in email templates not sanitized |

**Recommendations:**
- Store minimal data in JWT, fetch user data server-side when needed
- Implement structured logging that redacts sensitive fields
- Sanitize user input before including in emails

---

## Phase 2: Code Quality & Architecture

### 2.1 Code Duplication to Address

| Component Pattern | Files | Consolidation Strategy |
|-------------------|-------|------------------------|
| Delete confirmation modals | `DeletePersonButton.tsx`, `DeleteGroupButton.tsx`, `DeleteRelationshipTypeButton.tsx` | Create reusable `ConfirmationModal` component |
| API auth check pattern | All API routes | Create `withAuth` higher-order function or middleware |
| Error display component | `PersonForm.tsx`, `GroupForm.tsx`, `RelationshipTypeForm.tsx`, login/register pages | Create reusable `ErrorAlert` component |
| Form loading states | All forms | Create `useFormSubmit` custom hook |
| Toast notification pattern | Multiple components | Centralize toast calls in a service |

**Detailed Refactoring:**

```
// Proposed: lib/api-utils.ts
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: Request, context?: RouteContext) => {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(request, session, context);
  };
}
```

### 2.2 Missing Error Boundaries

| Location | Impact | Action |
|----------|--------|--------|
| Graph visualization | HIGH | Add error boundary around D3 components |
| Form components | MEDIUM | Wrap forms in error boundaries |
| Page-level | MEDIUM | Add error.tsx files for each route segment |

### 2.3 Type Safety Improvements

| Issue | Location | Action |
|-------|----------|--------|
| Use of `any` type | `app/api/people/route.ts:96`, `app/api/people/[id]/route.ts:105` | Define proper TypeScript interfaces |
| Missing return types | Various API routes | Add explicit return types to all handlers |
| Untyped environment variables | Multiple files | Create typed env config with validation |

### 2.4 API Response Consistency

Current inconsistencies:
- Some endpoints return `{ people }`, others return `{ data: people }`
- Error formats vary between endpoints
- Success messages inconsistent

**Recommendation:** Create standardized response helpers:
```typescript
// lib/api-response.ts
export const apiResponse = {
  success: <T>(data: T, status = 200) => NextResponse.json({ data }, { status }),
  error: (message: string, status = 400) => NextResponse.json({ error: message }, { status }),
  created: <T>(data: T) => NextResponse.json({ data }, { status: 201 }),
};
```

---

## Phase 3: Performance Optimization

### 3.1 Database Queries

| Issue | Location | Optimization |
|-------|----------|--------------|
| N+1 queries in import | `app/api/user/import/route.ts` | Batch relationship type lookups |
| Unbounded people fetch | `app/api/people/route.ts` | Add pagination |
| Full graph data fetch | `app/api/dashboard/graph/route.ts` | Implement lazy loading for large networks |
| Missing indexes | `prisma/schema.prisma` | Review query patterns and add indexes |

### 3.2 Frontend Optimizations

| Issue | Location | Optimization |
|-------|----------|--------------|
| Large component re-renders | `UnifiedNetworkGraph.tsx` | Memoize with React.memo and useMemo |
| Unoptimized image loading | Various pages | Already using next/image - verify proper sizing |
| Missing loading states | Various pages | Add Suspense boundaries and skeleton loaders |

### 3.3 Caching Strategy

| Resource | Current | Recommended |
|----------|---------|-------------|
| Static assets | Default | Configure aggressive caching |
| API responses | None | Add Cache-Control headers for read endpoints |
| Database queries | None | Consider Prisma query caching |

---

## Phase 4: Production Readiness

### 4.1 Environment Configuration

| Issue | Severity | Action |
|-------|----------|--------|
| Missing env validation | HIGH | Add runtime validation for required env vars |
| Hardcoded defaults | MEDIUM | Review `localhost` fallbacks in production |
| Missing production configs | MEDIUM | Ensure all production env vars documented |

### 4.2 Logging & Monitoring

| Component | Current State | Recommended |
|-----------|---------------|-------------|
| Application logs | console.log/error | Implement structured logging (Pino/Winston) |
| Error tracking | None | Add Sentry or similar |
| Performance monitoring | None | Add observability (OpenTelemetry) |
| Health checks | None | Add /api/health endpoint |

### 4.3 Database Migrations

| Issue | Action |
|-------|--------|
| Schema drift detected during review | Ensure migrations are up to date before deployment |
| Missing migration for password reset fields | Create proper migration file |

### 4.4 CI/CD Considerations

| Check | Implementation |
|-------|----------------|
| Linting | Run ESLint in CI |
| Type checking | Run `tsc --noEmit` |
| Unit tests | Add Jest/Vitest test suite |
| Integration tests | Add API endpoint tests |
| Security scanning | Add npm audit, dependency check |

---

## Phase 5: Feature-Specific Reviews

### 5.1 Email System

| Issue | Location | Action |
|-------|----------|--------|
| Email delivery failures silent | `lib/email.ts` | Implement retry logic with dead letter queue |
| HTML injection in templates | `emailTemplates` | Escape user-provided content |
| Missing email validation | Various | Validate email format before sending |

### 5.2 Import/Export

| Issue | Location | Action |
|-------|----------|--------|
| Large file handling | `app/api/user/import/route.ts` | Stream processing for large imports |
| Data validation | Same | Validate imported data structure deeply |
| Transaction safety | Same | Wrap import in database transaction |

### 5.3 Cron/Reminder System

| Issue | Location | Action |
|-------|----------|--------|
| Concurrent execution | `app/api/cron/send-reminders/route.ts` | Add distributed locking |
| Failure handling | Same | Implement retry with exponential backoff |
| Timezone handling | Same | Consider user timezone for reminders |

---

## Implementation Priority

### Critical (Do First)
1. Add input validation (Zod) to all API endpoints
2. Implement rate limiting on authentication endpoints
3. Add proper error handling and logging
4. Fix IDOR vulnerability in orphan deletion
5. Add environment variable validation

### High Priority
1. Create reusable confirmation modal component
2. Implement withAuth wrapper for API routes
3. Add security headers (CSP, etc.)
4. Add proper TypeScript types (remove `any`)
5. Implement structured logging

### Medium Priority
1. Add pagination to list endpoints
2. Create standardized API response helpers
3. Add error boundaries to all pages
4. Implement request size limits
5. Add health check endpoint

### Low Priority (Nice to Have)
1. Add caching layer
2. Implement retry logic for emails
3. Add comprehensive test suite
4. Optimize graph rendering performance
5. Add observability/monitoring

---

## Estimated Effort

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1: Security | 2-3 days | None |
| Phase 2: Code Quality | 3-4 days | Phase 1 |
| Phase 3: Performance | 2-3 days | Phase 2 |
| Phase 4: Production | 2-3 days | Phase 1-3 |
| Phase 5: Feature-Specific | 2-3 days | Phase 1-2 |

**Total estimated effort: 11-16 days**

---

## Next Steps

1. Review and approve this plan
2. Create GitHub issues for each item
3. Prioritize based on deployment timeline
4. Begin implementation starting with Critical items
