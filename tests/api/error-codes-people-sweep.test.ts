import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Error codes on the people, group, relationship, important date, journal and
 * vCard routes that the per-route test files do not already cover.
 */

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  personCount: vi.fn(),
  importantDateFindFirst: vi.fn(),
  importantDateCount: vi.fn(),
  groupFindFirst: vi.fn(),
  groupFindUnique: vi.fn(),
  personGroupFindUnique: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
  dismissedUpsert: vi.fn(),
  canCreateResource: vi.fn(),
  canEnableReminder: vi.fn(),
  getUserUsage: vi.fn(),
  isSaasMode: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      findMany: mocks.personFindMany,
      count: mocks.personCount,
    },
    importantDate: {
      findFirst: mocks.importantDateFindFirst,
      count: mocks.importantDateCount,
    },
    group: { findFirst: mocks.groupFindFirst, findUnique: mocks.groupFindUnique },
    personGroup: { findUnique: mocks.personGroupFindUnique },
    relationshipType: { findFirst: mocks.relationshipTypeFindFirst },
  },
  prismaIncludingDeleted: {
    importantDate: { findFirst: mocks.importantDateFindFirst },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'test@example.com', name: 'Test' } })
  ),
}));

vi.mock('@/lib/billing', () => ({
  canCreateResource: mocks.canCreateResource,
  canEnableReminder: mocks.canEnableReminder,
  getUserUsage: mocks.getUserUsage,
}));

vi.mock('@/lib/features', () => ({ isSaasMode: mocks.isSaasMode }));

vi.mock('@/lib/carddav/auto-export', () => ({
  autoUpdatePerson: vi.fn(() => Promise.resolve()),
  autoExportPerson: vi.fn(() => Promise.resolve()),
}));

import { POST as createPerson } from '@/app/api/people/route';
import { PUT as updatePerson } from '@/app/api/people/[id]/route';
import { POST as createDate } from '@/app/api/people/[id]/important-dates/route';
import { PUT as updateDate } from '@/app/api/people/[id]/important-dates/[dateId]/route';
import { POST as restoreDate } from '@/app/api/people/[id]/important-dates/[dateId]/restore/route';
import { POST as dismiss } from '@/app/api/people/duplicates/dismiss/route';
import { POST as createGroup } from '@/app/api/groups/route';
import { POST as addMember } from '@/app/api/groups/[id]/members/route';
import { POST as createRelationshipType } from '@/app/api/relationship-types/route';
import { POST as createJournal } from '@/app/api/journal/route';
import { POST as vcardImport } from '@/app/api/vcard/import/route';
import { POST as vcardUpload } from '@/app/api/vcard/upload/route';

function json(url: string, method: string, body: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const limitCheck = { allowed: false, current: 50, limit: 50, tier: 'FREE', isUnlimited: false };
const reminderCap = { allowed: true, isUnlimited: false, current: 5, limit: 5 };

describe('error codes: people, groups, relationships, dates, journal, vcard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.canCreateResource.mockResolvedValue({ ...limitCheck, allowed: true, current: 0 });
    mocks.canEnableReminder.mockResolvedValue({ allowed: true, isUnlimited: true, current: 0, limit: 5 });
    mocks.isSaasMode.mockReturnValue(false);
  });

  it('POST /api/people returns plan_limit_reached with resource and limit', async () => {
    mocks.canCreateResource.mockResolvedValue(limitCheck);
    const res = await createPerson(json('/api/people', 'POST', { name: 'A' }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'people', limit: 50 });
    expect(body.error).toContain('plan limit of 50 people');
  });

  it('POST /api/people reminder cap returns plan_limit_reached for reminders', async () => {
    mocks.canEnableReminder.mockResolvedValue(reminderCap);
    const res = await createPerson(
      json('/api/people', 'POST', {
        name: 'A',
        relationshipToUserId: 'rt-1',
        contactReminderEnabled: true,
        contactReminderInterval: 1,
        contactReminderIntervalUnit: 'MONTHS',
      })
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'reminders', limit: 5 });
  });

  it('PUT /api/people/[id] reminder cap returns plan_limit_reached for reminders', async () => {
    mocks.canEnableReminder.mockResolvedValue(reminderCap);
    mocks.personFindUnique.mockResolvedValue({ id: 'p1', userId: 'user-123', contactReminderEnabled: false });
    mocks.importantDateCount.mockResolvedValue(0);
    const res = await updatePerson(
      json('/api/people/p1', 'PUT', {
        contactReminderEnabled: true,
        contactReminderInterval: 1,
        contactReminderIntervalUnit: 'MONTHS',
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'reminders', limit: 5 });
  });

  it('POST /api/groups returns plan_limit_reached for groups', async () => {
    mocks.canCreateResource.mockResolvedValue(limitCheck);
    const res = await createGroup(json('/api/groups', 'POST', { name: 'G' }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'groups', limit: 50 });
  });

  it('POST important-dates returns important_date_type_exists as 409', async () => {
    mocks.personFindUnique.mockResolvedValue({ id: 'p1' });
    mocks.importantDateFindFirst.mockResolvedValue({ id: 'd1' });
    const res = await createDate(
      json('/api/people/p1/important-dates', 'POST', { type: 'birthday', title: '', date: '1990-05-12' }),
      { params: Promise.resolve({ id: 'p1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('important_date_type_exists');
    expect(body.params).toEqual({ type: 'birthday' });
    expect(body.error).toBe('A "birthday" date already exists for this person.');
  });

  it('PUT important-dates/[dateId] returns important_date_type_exists as 409', async () => {
    mocks.personFindUnique.mockResolvedValue({ id: 'p1' });
    mocks.importantDateFindFirst.mockResolvedValue({ id: 'd2' });
    const res = await updateDate(
      json('/api/people/p1/important-dates/d1', 'PUT', { type: 'birthday', title: '', date: '1990-05-12' }),
      { params: Promise.resolve({ id: 'p1', dateId: 'd1' }) }
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('important_date_type_exists');
    expect(body.params).toEqual({ type: 'birthday' });
    expect(body.error).toBe('A "birthday" date already exists for this person.');
  });

  it('restore important date returns important_date_type_exists as 409', async () => {
    mocks.importantDateFindFirst
      .mockResolvedValueOnce({ id: 'd1', type: 'birthday', deletedAt: new Date() })
      .mockResolvedValueOnce({ id: 'd2' });
    const res = await restoreDate(new Request('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'p1', dateId: 'd1' }),
    });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('important_date_type_exists');
    expect(body.params).toEqual({ type: 'birthday' });
    expect(body.error).toContain('already exists for this person');
  });

  it('dismiss with the same person returns self_relationship', async () => {
    const res = await dismiss(json('/api/people/duplicates/dismiss', 'POST', { personAId: 'a', personBId: 'a' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('self_relationship');
    expect(body.error).toBe('Cannot dismiss a person with themselves');
  });

  it('dismiss with a malformed body keeps details and adds fields', async () => {
    const res = await dismiss(json('/api/people/duplicates/dismiss', 'POST', { personAId: 'a' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('validation_failed');
    expect(body.error).toBe('Invalid request body');
    expect(body.fields).toEqual([{ path: 'personBId', issue: 'required' }]);
  });

  it('adding an existing group member returns already_group_member as 409', async () => {
    mocks.groupFindUnique.mockResolvedValue({ id: 'g1' });
    mocks.personFindUnique.mockResolvedValue({ id: 'p1' });
    mocks.personGroupFindUnique.mockResolvedValue({ personId: 'p1', groupId: 'g1' });
    const res = await addMember(json('/api/groups/g1/members', 'POST', { personId: 'p1' }), {
      params: Promise.resolve({ id: 'g1' }),
    });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('already_group_member');
    expect(body.error).toBe('Person is already a member of this group');
  });

  it('existing inverse relationship type returns relationship_type_name_taken with the name', async () => {
    mocks.relationshipTypeFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'x' });
    const res = await createRelationshipType(
      json('/api/relationship-types', 'POST', { name: 'Mentor', label: 'Mentor', inverseLabel: 'Mentee' })
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('relationship_type_name_taken');
    expect(body.params).toEqual({ name: 'Mentee' });
    expect(body.error).toBe('The inverse relationship type "Mentee" already exists');
  });

  it('journal with unknown person ids returns invalid_person_ids', async () => {
    mocks.personCount.mockResolvedValue(0);
    const res = await createJournal(
      json('/api/journal', 'POST', { title: 'T', date: '2025-01-01', body: 'B', personIds: ['c1111111111111111111111a'] })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('invalid_person_ids');
    expect(body.error).toBe('One or more person IDs are invalid');
  });

  it.each([
    ['import', vcardImport],
    ['upload', vcardUpload],
  ])('vcard %s rejects non-vCard text with invalid_vcard', async (_name, handler) => {
    const res = await handler(
      new Request('http://localhost/api/vcard', { method: 'POST', body: 'hello' })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('invalid_vcard');
    expect(body.error).toBe('Invalid vCard file');
  });
});
