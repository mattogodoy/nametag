import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}));

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLog,
  createModuleLogger: vi.fn(() => mockLog),
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports healthy when the database responds', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('connected');
  });

  it('reports unhealthy with 503 when the database is unreachable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432')
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('disconnected');
  });

  it('does not leak database error details to an unauthenticated caller', async () => {
    // A real Prisma connection error carries the host, port, and sometimes the
    // user from the connection string. /api/health is unauthenticated, so the
    // response must not echo it back.
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error(
        "Can't reach database server at `db.internal.example:5432`. " +
          'Credentials: nametag_admin / hunter2'
      )
    );

    const res = await GET();
    const raw = await res.text();

    expect(res.status).toBe(503);
    expect(raw).not.toContain('db.internal.example');
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('nametag_admin');
  });

  it('logs the underlying error so operators can still diagnose it', async () => {
    const dbError = new Error("Can't reach database server at `db.internal:5432`");
    vi.mocked(prisma.$queryRaw).mockRejectedValue(dbError);

    await GET();

    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError }),
      expect.any(String)
    );
  });
});
