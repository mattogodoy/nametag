import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  customValueFindMany: vi.fn(),
  importantDateFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany },
    personGroup: { findMany: mocks.personGroupFindMany },
    personCustomFieldValue: { findMany: mocks.customValueFindMany },
    importantDate: { findMany: mocks.importantDateFindMany },
  },
}));

// Spy on the real parseCalendarDate rather than stubbing it out: the test
// below needs both its real conversion behaviour (to build the expected
// value) and proof that context.ts actually calls it. A spy that wraps the
// real implementation gives a zone-independent failure signal: on the
// unfixed loader the spy is simply never invoked, which fails on any
// machine regardless of its local timezone, unlike comparing timestamps
// directly (that only diverges on a machine whose local zone isn't UTC).
vi.mock('@/lib/date-format', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/date-format')>();
  return { ...actual, parseCalendarDate: vi.fn(actual.parseCalendarDate) };
});

import {
  collectDataNeeds,
  loadPersonContexts,
  type LabelDataNeeds,
} from '@/lib/relationship-labels/context';
import { parseCalendarDate } from '@/lib/date-format';
import type { LabelVariant } from '@/lib/relationship-labels/types';

describe('collectDataNeeds', () => {
  it('asks for nothing when no variant carries a condition', () => {
    const variants: LabelVariant[] = [{ label: 'ami', conditions: [] }];
    expect(collectDataNeeds(variants)).toEqual({
      fields: [],
      groups: false,
      templateIds: [],
      dates: false,
    });
  });

  it('collects only the sources actually referenced, without duplicates', () => {
    const variants: LabelVariant[] = [
      {
        label: 'a',
        conditions: [
          { subject: 'DESCRIBED', source: 'PERSON_FIELD', subjectRef: 'gender', operator: 'IS', operand: 'lit:Homme' },
          { subject: 'OTHER', source: 'PERSON_FIELD', subjectRef: 'gender', operator: 'IS', operand: 'lit:Homme' },
          { subject: 'DESCRIBED', source: 'CUSTOM_FIELD', subjectRef: 'tpl-1', operator: 'IS_SET', operand: null },
        ],
      },
    ];
    expect(collectDataNeeds(variants)).toEqual({
      fields: ['gender'],
      groups: false,
      templateIds: ['tpl-1'],
      dates: false,
    });
  });

  it('ignores a native field outside the allowed list', () => {
    const variants: LabelVariant[] = [
      {
        label: 'a',
        conditions: [
          { subject: 'DESCRIBED', source: 'PERSON_FIELD', subjectRef: 'notes', operator: 'IS_SET', operand: null },
        ],
      },
    ];
    expect(collectDataNeeds(variants).fields).toEqual([]);
  });

  it('follows a cross-person reference into the needs', () => {
    const variants: LabelVariant[] = [
      {
        label: 'a',
        conditions: [
          { subject: 'DESCRIBED', source: 'DATE_TYPE', subjectRef: 'birthday', operator: 'BEFORE', operand: 'ref:birthday' },
        ],
      },
    ];
    expect(collectDataNeeds(variants).dates).toBe(true);
  });
});

describe('loadPersonContexts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindMany.mockResolvedValue([]);
    mocks.personGroupFindMany.mockResolvedValue([]);
    mocks.customValueFindMany.mockResolvedValue([]);
    mocks.importantDateFindMany.mockResolvedValue([]);
  });

  const noNeeds: LabelDataNeeds = { fields: [], groups: false, templateIds: [], dates: false };

  it('issues no query when nothing is needed', async () => {
    const contexts = await loadPersonContexts('user-1', ['p1'], { ...noNeeds });
    expect(contexts.size).toBe(0);
    expect(mocks.personFindMany).not.toHaveBeenCalled();
    expect(mocks.personGroupFindMany).not.toHaveBeenCalled();
    expect(mocks.customValueFindMany).not.toHaveBeenCalled();
    expect(mocks.importantDateFindMany).not.toHaveBeenCalled();
  });

  it('issues no query when there is no person to load', async () => {
    await loadPersonContexts('user-1', [], { ...noNeeds, groups: true });
    expect(mocks.personGroupFindMany).not.toHaveBeenCalled();
  });

  it('loads native fields in a single query scoped to the user', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'p1', gender: 'Homme' }]);
    const contexts = await loadPersonContexts('user-1', ['p1', 'p2'], {
      ...noNeeds,
      fields: ['gender'],
    });
    expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
    expect(mocks.personFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, userId: 'user-1', deletedAt: null },
      select: { id: true, gender: true },
    });
    expect(contexts.get('p1')?.fields.gender).toBe('Homme');
  });

  it('excludes soft-deleted groups, dates and templates', async () => {
    await loadPersonContexts('user-1', ['p1'], {
      fields: [],
      groups: true,
      templateIds: ['tpl-1'],
      dates: true,
    });
    expect(mocks.personGroupFindMany).toHaveBeenCalledWith({
      where: { personId: { in: ['p1'] }, group: { deletedAt: null, userId: 'user-1' } },
      select: { personId: true, groupId: true },
    });
    expect(mocks.customValueFindMany).toHaveBeenCalledWith({
      where: {
        personId: { in: ['p1'] },
        templateId: { in: ['tpl-1'] },
        template: { deletedAt: null, userId: 'user-1' },
      },
      select: { personId: true, templateId: true, value: true, template: { select: { type: true } } },
    });
    expect(mocks.importantDateFindMany).toHaveBeenCalledWith({
      where: {
        personId: { in: ['p1'] },
        deletedAt: null,
        person: { userId: 'user-1', deletedAt: null },
      },
      select: { personId: true, type: true, title: true, date: true },
    });
  });

  it('groups every source under one context per person', async () => {
    mocks.personGroupFindMany.mockResolvedValue([
      { personId: 'p1', groupId: 'g1' },
      { personId: 'p1', groupId: 'g2' },
    ]);
    mocks.customValueFindMany.mockResolvedValue([
      { personId: 'p1', templateId: 'tpl-1', value: '42', template: { type: 'NUMBER' } },
    ]);
    mocks.importantDateFindMany.mockResolvedValue([
      { personId: 'p1', type: 'birthday', title: 'Anniversaire', date: new Date(1985, 10, 2) },
    ]);

    const contexts = await loadPersonContexts('user-1', ['p1'], {
      fields: [],
      groups: true,
      templateIds: ['tpl-1'],
      dates: true,
    });

    const context = contexts.get('p1');
    expect(context?.groupIds.has('g2')).toBe(true);
    expect(context?.customValues.get('tpl-1')).toEqual({ type: 'NUMBER', value: '42' });
    expect(context?.dates).toHaveLength(1);
  });

  it('anchors an important date to its stored UTC calendar day, not the local one (Finding 1)', async () => {
    // Important dates are written as UTC-midnight DateTime values. A row
    // stored for 15 May would read back as 14 May under plain getDate() on
    // any server west of UTC. The stored value below is deliberately built
    // with Date.UTC so the test does not depend on the machine's own zone.
    const raw = new Date(Date.UTC(1990, 4, 15));
    mocks.importantDateFindMany.mockResolvedValue([
      { personId: 'p1', type: 'birthday', title: 'Anniversaire', date: raw },
    ]);

    const contexts = await loadPersonContexts('user-1', ['p1'], {
      fields: [],
      groups: false,
      templateIds: [],
      dates: true,
    });

    // The loader must have run the stored date through parseCalendarDate.
    // This assertion is what makes the test able to fail: the unfixed
    // loader pushes `row.date` straight through and never calls this
    // function, so the spy assertion fails on any machine, in any
    // timezone, including a CI container that happens to run in UTC (where
    // comparing raw timestamps directly would not have caught the bug).
    expect(parseCalendarDate).toHaveBeenCalledWith(raw);

    // And the output must actually be the converted value: local midnight
    // on the stored calendar day, per parseCalendarDate's own contract.
    const expected = parseCalendarDate(raw);
    expect(contexts.get('p1')?.dates[0]?.date.getTime()).toBe(expected.getTime());
  });
});
