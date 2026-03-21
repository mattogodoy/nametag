import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cronJobLogCreate: vi.fn(),
  cronJobLogUpdate: vi.fn(),
  eventFindMany: vi.fn(),
  eventUpdate: vi.fn(),
  personUpdateMany: vi.fn(),
  transaction: vi.fn(),
  authFailure: vi.fn(),
}));

const mockEnv = vi.hoisted(() => ({
  CRON_SECRET: 'test-cron-secret-16-chars',
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    cronJobLog: {
      create: mocks.cronJobLogCreate,
      update: mocks.cronJobLogUpdate,
    },
    event: {
      findMany: mocks.eventFindMany,
      update: mocks.eventUpdate,
    },
    person: {
      updateMany: mocks.personUpdateMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../../lib/env', () => ({
  env: mockEnv,
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  securityLogger: {
    authFailure: mocks.authFailure,
  },
}));

vi.mock('../../lib/api-utils', () => ({
  withLogging: (fn: (...args: unknown[]) => unknown) => fn,
  getClientIp: () => '127.0.0.1',
  handleApiError: (error: unknown) =>
    new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    }),
}));

import { GET } from '../../app/api/cron/process-past-events/route';

describe('GET /api/cron/process-past-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronJobLogCreate.mockResolvedValue({ id: 'cron-1' });
    mocks.cronJobLogUpdate.mockResolvedValue({ id: 'cron-1' });
    mocks.transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
    mocks.personUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventUpdate.mockResolvedValue({ id: 'event-1' });
  });

  it('returns 401 when the cron secret is invalid', async () => {
    const request = new Request('http://localhost/api/cron/process-past-events', {
      headers: { authorization: 'Bearer invalid-secret' },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mocks.authFailure).toHaveBeenCalled();
    expect(mocks.cronJobLogCreate).not.toHaveBeenCalled();
  });

  it('updates lastContact only within the owning user scope and marks events processed', async () => {
    const eventDate = new Date('2026-03-20T10:00:00.000Z');
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-1',
        date: eventDate,
        people: [{ id: 'person-1' }],
      },
    ]);

    const request = new Request('http://localhost/api/cron/process-past-events', {
      headers: { authorization: `Bearer ${mockEnv.CRON_SECRET}` },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, processed: 1 });
    expect(mocks.personUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'person-1',
        userId: 'user-1',
        OR: [
          { lastContact: null },
          { lastContact: { lt: eventDate } },
        ],
      },
      data: { lastContact: eventDate },
    });
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { lastContactProcessed: true },
    });
  });

  it('marks empty events as processed without updating people', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        userId: 'user-1',
        date: new Date('2026-03-20T10:00:00.000Z'),
        people: [],
      },
    ]);

    const request = new Request('http://localhost/api/cron/process-past-events', {
      headers: { authorization: `Bearer ${mockEnv.CRON_SECRET}` },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mocks.personUpdateMany).not.toHaveBeenCalled();
    expect(mocks.eventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { lastContactProcessed: true },
    });
  });
});
