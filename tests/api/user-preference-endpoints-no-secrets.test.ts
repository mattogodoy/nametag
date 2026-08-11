import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * These endpoints all return the updated user to the client. Without a `select`
 * allowlist, Prisma returns every column, which includes the bcrypt password hash
 * and live account-recovery tokens.
 *
 * The `update` mock below deliberately behaves the way Prisma does: it honours a
 * `select` clause and returns the whole row when there isn't one. That is what
 * makes these tests fail against an unselected query rather than silently passing
 * on a mock that returns whatever it was told to.
 */

const SECRET_FIELDS = [
  'password',
  'emailVerifyToken',
  'passwordResetToken',
  'emailVerifyExpires',
  'passwordResetExpires',
  'failedLoginAttempts',
  'lockedUntil',
] as const;

const FULL_USER_ROW: Record<string, unknown> = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test',
  surname: null,
  nickname: null,
  theme: 'DARK',
  dateFormat: 'MDY',
  nameOrder: 'WESTERN',
  nameDisplayFormat: 'FULL',
  graphMode: 'individuals',
  language: 'en',
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  // Everything below must never reach the client.
  password: '$2b$10$notarealhashbutshapedlikeone',
  emailVerifyToken: 'verify-token-abc',
  emailVerifyExpires: new Date('2026-01-02'),
  emailVerifySentAt: new Date('2026-01-01'),
  passwordResetToken: 'reset-token-xyz',
  passwordResetExpires: new Date('2026-01-02'),
  passwordResetSentAt: new Date('2026-01-01'),
  failedLoginAttempts: 0,
  lockedUntil: null,
  provider: 'credentials',
  providerAccountId: null,
};

function applySelect(args: { select?: Record<string, boolean> }): Record<string, unknown> {
  if (!args?.select) return { ...FULL_USER_ROW };
  return Object.fromEntries(
    Object.keys(args.select).map((key) => [key, FULL_USER_ROW[key]])
  );
}

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: { update: mocks.userUpdate, findUnique: mocks.userFindUnique },
    personAddress: { updateMany: vi.fn() },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'test@example.com', name: 'Test' } })
  ),
}));

vi.mock('../../lib/email', async () => {
  const actual = await vi.importActual<typeof import('../../lib/email')>('../../lib/email');
  return { ...actual, sendEmail: vi.fn(() => Promise.resolve({ success: true })) };
});

import { PUT as putTheme } from '../../app/api/user/theme/route';
import { PUT as putDateFormat } from '../../app/api/user/date-format/route';
import { PUT as putNameOrder } from '../../app/api/user/name-order/route';
import { PUT as putNameDisplayFormat } from '../../app/api/user/name-display-format/route';
import { PUT as putGraphDisplay } from '../../app/api/user/graph-display/route';
import { PUT as putProfile } from '../../app/api/user/profile/route';
import { PUT as putGeocoding } from '../../app/api/user/geocoding/route';

type Handler = (request: Request) => Promise<Response>;

const put = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const ENDPOINTS: Array<{ name: string; path: string; handler: Handler; body: unknown }> = [
  { name: 'theme', path: '/api/user/theme', handler: putTheme as Handler, body: { theme: 'DARK' } },
  { name: 'date-format', path: '/api/user/date-format', handler: putDateFormat as Handler, body: { dateFormat: 'MDY' } },
  { name: 'name-order', path: '/api/user/name-order', handler: putNameOrder as Handler, body: { nameOrder: 'WESTERN' } },
  { name: 'name-display-format', path: '/api/user/name-display-format', handler: putNameDisplayFormat as Handler, body: { nameDisplayFormat: 'FULL' } },
  { name: 'graph-display', path: '/api/user/graph-display', handler: putGraphDisplay as Handler, body: { graphMode: 'individuals' } },
  { name: 'geocoding', path: '/api/user/geocoding', handler: putGeocoding as Handler, body: { geocodingEnabled: false } },
];

describe('user preference endpoints do not leak account secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockImplementation((args) => Promise.resolve(applySelect(args)));
    // Two lookups happen in the profile flow: "is this email taken by someone
    // else" (no) and "what is my current email" (the same one, so the email is
    // unchanged and we exercise the branch that returns the user).
    mocks.userFindUnique.mockImplementation((args: { where: { id?: string; email?: string } }) =>
      Promise.resolve(args.where.id ? { email: FULL_USER_ROW.email } : null)
    );
  });

  for (const endpoint of ENDPOINTS) {
    describe(`PUT ${endpoint.path}`, () => {
      it('succeeds', async () => {
        const response = await endpoint.handler(put(endpoint.path, endpoint.body));
        expect(response.status).toBe(200);
      });

      it('constrains the Prisma query with a select allowlist', async () => {
        await endpoint.handler(put(endpoint.path, endpoint.body));

        const args = mocks.userUpdate.mock.calls[0][0];
        expect(args.select, `${endpoint.name} must pass a select clause`).toBeDefined();

        for (const field of SECRET_FIELDS) {
          expect(args.select[field], `${endpoint.name} must not select ${field}`).toBeUndefined();
        }
      });

      it('returns no secret field in the response body', async () => {
        const response = await endpoint.handler(put(endpoint.path, endpoint.body));
        const body = await response.json();

        for (const field of SECRET_FIELDS) {
          expect(body.user?.[field], `${endpoint.name} leaked ${field}`).toBeUndefined();
        }
      });

      it('does not serialise the password hash anywhere in the response', async () => {
        const response = await endpoint.handler(put(endpoint.path, endpoint.body));
        const raw = await response.text();

        expect(raw).not.toContain(FULL_USER_ROW.password as string);
        expect(raw).not.toContain(FULL_USER_ROW.passwordResetToken as string);
        expect(raw).not.toContain(FULL_USER_ROW.emailVerifyToken as string);
      });
    });
  }

  describe('PUT /api/user/profile', () => {
    const profileBody = { name: 'Test', surname: null, nickname: null, email: 'test@example.com' };

    it('returns no secret field when the email is unchanged', async () => {
      const response = await putProfile(put('/api/user/profile', profileBody));
      const body = await response.json();

      expect(response.status).toBe(200);
      for (const field of SECRET_FIELDS) {
        expect(body.user?.[field], `profile leaked ${field}`).toBeUndefined();
      }
    });

    it('constrains the Prisma query with a select allowlist', async () => {
      await putProfile(put('/api/user/profile', profileBody));

      const args = mocks.userUpdate.mock.calls[0][0];
      expect(args.select).toBeDefined();
      for (const field of SECRET_FIELDS) {
        expect(args.select[field]).toBeUndefined();
      }
    });

    it('does not serialise the password hash anywhere in the response', async () => {
      const response = await putProfile(put('/api/user/profile', profileBody));
      const raw = await response.text();

      expect(raw).not.toContain(FULL_USER_ROW.password as string);
      expect(raw).not.toContain(FULL_USER_ROW.passwordResetToken as string);
    });

    // The email-change branch returns only a flag today. Pin that, so a future
    // edit that starts returning the user has to make the allowlist decision
    // deliberately rather than inheriting a leak.
    it('returns no user object at all when the email changes', async () => {
      mocks.userFindUnique.mockImplementation((args: { where: { id?: string; email?: string } }) =>
        Promise.resolve(args.where.id ? { email: 'old@example.com' } : null)
      );

      const response = await putProfile(put('/api/user/profile', profileBody));
      const body = await response.json();
      const raw = JSON.stringify(body);

      expect(body.emailChanged).toBe(true);
      expect(body.user).toBeUndefined();
      expect(raw).not.toContain(FULL_USER_ROW.password as string);
    });
  });
});
