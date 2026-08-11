import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userUpdate: vi.fn() }));

vi.mock('../../lib/prisma', () => ({
  prisma: { user: { update: mocks.userUpdate } },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'test@example.com', name: 'Test' } })
  ),
}));

import { PUT as putLeadDays } from '../../app/api/user/reminder-lead-days/route';
import { PUT as putDigest } from '../../app/api/user/weekly-digest/route';

const put = (url: string, body: unknown) =>
  new Request(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /api/user/reminder-lead-days', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({ id: 'user-123', defaultReminderLeadDays: 7 });
  });

  it('saves a valid lead time', async () => {
    const response = await putLeadDays(
      put('http://localhost/api/user/reminder-lead-days', { days: 7 })
    );
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { defaultReminderLeadDays: 7 },
      select: { id: true, defaultReminderLeadDays: true },
    });
  });

  it('accepts 0 as day-of only', async () => {
    const response = await putLeadDays(
      put('http://localhost/api/user/reminder-lead-days', { days: 0 })
    );
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { defaultReminderLeadDays: 0 },
      select: { id: true, defaultReminderLeadDays: true },
    });
  });

  it('rejects a negative value', async () => {
    const response = await putLeadDays(
      put('http://localhost/api/user/reminder-lead-days', { days: -1 })
    );
    expect(response.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('rejects a value above 365', async () => {
    const response = await putLeadDays(
      put('http://localhost/api/user/reminder-lead-days', { days: 366 })
    );
    expect(response.status).toBe(400);
  });

  it('rejects a non-integer', async () => {
    const response = await putLeadDays(
      put('http://localhost/api/user/reminder-lead-days', { days: 3.5 })
    );
    expect(response.status).toBe(400);
  });
});

describe('PUT /api/user/weekly-digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({
      id: 'user-123',
      weeklyDigestEnabled: true,
      weeklyDigestWeekday: 1,
    });
  });

  it('saves the toggle and weekday together', async () => {
    const response = await putDigest(
      put('http://localhost/api/user/weekly-digest', { enabled: true, weekday: 1 })
    );
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { weeklyDigestEnabled: true, weeklyDigestWeekday: 1 },
      select: { id: true, weeklyDigestEnabled: true, weeklyDigestWeekday: true },
    });
  });

  it('rejects a weekday above 6', async () => {
    const response = await putDigest(
      put('http://localhost/api/user/weekly-digest', { enabled: true, weekday: 7 })
    );
    expect(response.status).toBe(400);
  });

  it('rejects a negative weekday', async () => {
    const response = await putDigest(
      put('http://localhost/api/user/weekly-digest', { enabled: true, weekday: -1 })
    );
    expect(response.status).toBe(400);
  });
});
