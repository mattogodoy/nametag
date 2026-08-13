import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted so the mocks exist before the mocked modules are hoisted above imports
const mocks = vi.hoisted(() => ({
  unsubscribeTokenFindUnique: vi.fn(),
  unsubscribeTokenUpdate: vi.fn(),
  userUpdate: vi.fn(),
  importantDateUpdate: vi.fn(),
  personUpdate: vi.fn(),
  loggerInfo: vi.fn(),
}));

// The real consumeUnsubscribeToken (lib/unsubscribe-tokens.ts) is exercised as-is here.
// Only its Prisma dependency is mocked, since that is where the WEEKLY_DIGEST branch
// added in this task actually lives, not in the route handler itself.
vi.mock('../../../lib/prisma', () => ({
  prisma: {
    unsubscribeToken: {
      findUnique: mocks.unsubscribeTokenFindUnique,
      update: mocks.unsubscribeTokenUpdate,
    },
    user: {
      update: mocks.userUpdate,
    },
    importantDate: {
      update: mocks.importantDateUpdate,
    },
    person: {
      update: mocks.personUpdate,
    },
  },
}));

vi.mock('../../../lib/logger', () => {
  const childLogger = {
    info: mocks.loggerInfo,
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  return {
    logger: {
      info: mocks.loggerInfo,
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => childLogger),
    },
    createModuleLogger: vi.fn(() => childLogger),
    securityLogger: {
      authFailure: vi.fn(),
      rateLimitExceeded: vi.fn(),
      suspiciousActivity: vi.fn(),
    },
  };
});

vi.mock('../../../lib/api-utils', () => ({
  handleApiError: vi.fn((_error: Error) => {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }),
  withLogging: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// Import after mocking. The real route exports POST (not GET) and responds with
// JSON, not a redirect, so this differs from the brief's original test snippet.
import { POST } from '../../../app/api/unsubscribe/route';

function makeRequest(token: string): Request {
  return new Request('http://localhost/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * days);
}

describe('weekly digest unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unsubscribeTokenUpdate.mockResolvedValue({});
    mocks.userUpdate.mockResolvedValue({});
    mocks.importantDateUpdate.mockResolvedValue({});
    mocks.personUpdate.mockResolvedValue({});
  });

  it('disables the digest for the user named by entityId', async () => {
    mocks.unsubscribeTokenFindUnique.mockResolvedValue({
      id: 'token-id',
      token: 'tok-1',
      userId: 'user-1',
      reminderType: 'WEEKLY_DIGEST',
      entityId: 'user-1',
      used: false,
      expiresAt: daysFromNow(30),
      user: { id: 'user-1', email: 'user@example.com', language: 'en' },
    });

    const response = await POST(makeRequest('tok-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.reminderType).toBe('WEEKLY_DIGEST');
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { weeklyDigestEnabled: false },
    });
  });

  it('does not touch important dates or people', async () => {
    mocks.unsubscribeTokenFindUnique.mockResolvedValue({
      id: 'token-id',
      token: 'tok-1',
      userId: 'user-1',
      reminderType: 'WEEKLY_DIGEST',
      entityId: 'user-1',
      used: false,
      expiresAt: daysFromNow(30),
      user: { id: 'user-1', email: 'user@example.com', language: 'en' },
    });

    await POST(makeRequest('tok-1'));

    expect(mocks.importantDateUpdate).not.toHaveBeenCalled();
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it('does not flip the flag when the token was already used', async () => {
    mocks.unsubscribeTokenFindUnique.mockResolvedValue({
      id: 'token-id',
      token: 'tok-1',
      userId: 'user-1',
      reminderType: 'WEEKLY_DIGEST',
      entityId: 'user-1',
      used: true,
      expiresAt: daysFromNow(30),
      user: { id: 'user-1', email: 'user@example.com', language: 'en' },
    });

    const response = await POST(makeRequest('tok-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('ALREADY_USED');
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('still disables an important date reminder for that token type', async () => {
    mocks.unsubscribeTokenFindUnique.mockResolvedValue({
      id: 'token-id',
      token: 'tok-1',
      userId: 'user-1',
      reminderType: 'IMPORTANT_DATE',
      entityId: 'date-1',
      used: false,
      expiresAt: daysFromNow(30),
      user: { id: 'user-1', email: 'user@example.com', language: 'en' },
    });

    const response = await POST(makeRequest('tok-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reminderType).toBe('IMPORTANT_DATE');
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.importantDateUpdate).toHaveBeenCalledWith({
      where: { id: 'date-1' },
      data: { reminderEnabled: false },
    });
  });
});
