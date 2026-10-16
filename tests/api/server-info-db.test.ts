import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Exercises the real getServerInfo chain, so a change that swallows or
// reshapes the registration count error is caught here, not only in mocks.
const mocks = vi.hoisted(() => ({ userCount: vi.fn() }));

vi.mock('@/lib/prisma', () => ({ prisma: { user: { count: mocks.userCount } } }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { GET } from '@/app/api/server-info/route';

describe('GET /api/server-info with the database down', () => {
  beforeEach(() => {
    vi.stubEnv('DISABLE_REGISTRATION', 'true');
    mocks.userCount.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 without the database host when the registration count fails', async () => {
    const prismaError = Object.assign(
      new Error("Can't reach database server at `db.internal.example:5432`"),
      { name: 'PrismaClientInitializationError', errorCode: 'P1001' }
    );
    mocks.userCount.mockRejectedValue(prismaError);

    const res = await GET(new Request('http://localhost/api/server-info'));
    const body = await res.json();

    expect(mocks.userCount).toHaveBeenCalled();
    expect(res.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('db.internal.example');
  });
});
