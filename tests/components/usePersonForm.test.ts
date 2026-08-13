import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePersonForm } from '@/hooks/usePersonForm';

describe('usePersonForm - initial state from an existing person', () => {
  it('carries an existing per-date reminderLeadDays override into initial state', () => {
    // Regression: buildInitialState maps each Prisma-shaped importantDates
    // entry into an ImportantDateItem by hand, field by field. It's easy to
    // add a new field to the API/DB and forget to also add it here, in which
    // case an existing per-date override would silently read back as
    // undefined/null the moment the edit form mounts, even though the
    // database still has the real value.
    const { result } = renderHook(() =>
      usePersonForm({
        mode: 'edit',
        availablePeople: [],
        youLabel: 'You',
        person: {
          id: 'person-1',
          name: 'Alice',
          surname: null,
          middleName: null,
          secondLastName: null,
          nickname: null,
          prefix: null,
          suffix: null,
          organization: null,
          jobTitle: null,
          lastContact: null,
          notes: null,
          relationshipToUserId: null,
          groups: [],
          importantDates: [
            {
              id: 'date-1',
              type: 'birthday',
              title: '',
              date: new Date('1990-05-12'),
              reminderEnabled: true,
              reminderType: 'RECURRING',
              reminderInterval: 1,
              reminderIntervalUnit: 'YEARS',
              reminderLeadDays: 14,
            },
          ],
        },
      })
    );

    expect(result.current.state.importantDates).toHaveLength(1);
    expect(result.current.state.importantDates[0].reminderLeadDays).toBe(14);
  });

  it('carries null through when a date has no override, distinct from a missing field', () => {
    const { result } = renderHook(() =>
      usePersonForm({
        mode: 'edit',
        availablePeople: [],
        youLabel: 'You',
        person: {
          id: 'person-1',
          name: 'Alice',
          surname: null,
          middleName: null,
          secondLastName: null,
          nickname: null,
          prefix: null,
          suffix: null,
          organization: null,
          jobTitle: null,
          lastContact: null,
          notes: null,
          relationshipToUserId: null,
          groups: [],
          importantDates: [
            {
              id: 'date-1',
              type: 'birthday',
              title: '',
              date: new Date('1990-05-12'),
              reminderEnabled: true,
              reminderType: 'RECURRING',
              reminderInterval: 1,
              reminderIntervalUnit: 'YEARS',
              reminderLeadDays: null,
            },
          ],
        },
      })
    );

    expect(result.current.state.importantDates[0].reminderLeadDays).toBeNull();
  });
});
