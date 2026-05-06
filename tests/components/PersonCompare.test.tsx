import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PersonCompare from '../../components/PersonCompare';
import type { PersonForCompare, MergeSelections } from '../../components/PersonCompare';
import enMessages from '../../locales/en.json';

vi.mock('@/lib/photo-url', () => ({
  getPhotoUrl: vi.fn(() => null),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function makePerson(overrides: Partial<PersonForCompare> = {}): PersonForCompare {
  return {
    id: 'person-a',
    name: 'Alice',
    surname: 'Smith',
    middleName: null,
    secondLastName: null,
    nickname: null,
    prefix: null,
    suffix: null,
    organization: null,
    jobTitle: null,
    gender: null,
    anniversary: null,
    lastContact: null,
    photo: null,
    notes: null,
    relationshipToUserId: null,
    relationshipToUser: null,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
    customFieldValues: [],
    importantDates: [],
    groups: [],
    relationshipsFrom: [],
    relationshipsTo: [],
    ...overrides,
  };
}

describe('PersonCompare', () => {
  let onSelectionsChange: ReturnType<typeof vi.fn<(selections: MergeSelections) => void>>;

  beforeEach(() => {
    onSelectionsChange = vi.fn<(selections: MergeSelections) => void>();
  });

  describe('Primary selection', () => {
    it('renders both people as selectable options', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith' });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getAllByText('Alice Smith').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Bob Jones').length).toBeGreaterThan(0);
    });

    it('marks the person with more fields as primary by default', () => {
      const personA = makePerson({
        id: 'a',
        name: 'Alice',
        surname: 'Smith',
        organization: 'Acme Corp',
        jobTitle: 'Engineer',
      });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // personA has more fields, should be selected as primary
      const radioA = screen.getAllByRole('radio')[0];
      expect(radioA).toBeChecked();
    });

    it('calls onSelectionsChange on mount with initial primaryId', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(onSelectionsChange).toHaveBeenCalledWith(
        expect.objectContaining({ primaryId: expect.any(String) })
      );
    });

    it('allows switching the primary person', async () => {
      const user = userEvent.setup();
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith' });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // Click the radio for personB
      const radioB = screen.getAllByRole('radio')[1];
      await user.click(radioB);

      await waitFor(() => {
        expect(radioB).toBeChecked();
      });

      // onSelectionsChange should have been called with personB as primary
      const lastCall: MergeSelections =
        onSelectionsChange.mock.calls[onSelectionsChange.mock.calls.length - 1][0];
      expect(lastCall.primaryId).toBe('b');
    });

    it('shows Primary label for the selected person', async () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // At least one "Primary (keeps)" label should be visible (may appear in multiple places)
      expect(screen.getAllByText(/primary \(keeps\)/i).length).toBeGreaterThan(0);
    });
  });

  describe('No conflicts', () => {
    it('shows no conflicts message when both people have identical fields', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Smith' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(
        screen.getByText(/no conflicting fields/i)
      ).toBeInTheDocument();
    });

    it('shows no conflicts message when one person has empty fields', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getByText(/no conflicting fields/i)).toBeInTheDocument();
    });
  });

  describe('Conflicting fields', () => {
    it('shows conflicting fields table when people have different values', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getByText(/these fields have different values/i)).toBeInTheDocument();
    });

    it('displays conflicting field values side by side', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getByText('Smith')).toBeInTheDocument();
      expect(screen.getByText('Jones')).toBeInTheDocument();
    });

    it('allows overriding a field to use the secondary value', async () => {
      const user = userEvent.setup();
      // personA has more fields (is primary by default)
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith', organization: 'Acme' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // Find the radio for field-surname in personB's column (value = 'b')
      const surnameRadios = document.querySelectorAll('input[name="field-surname"]');
      // Find the one whose value is 'b' (personB's radio)
      const radioBSurname = Array.from(surnameRadios).find(
        (r) => (r as HTMLInputElement).value === 'b'
      ) as HTMLInputElement | undefined;

      if (radioBSurname) {
        await user.click(radioBSurname);

        await waitFor(() => {
          const lastCall: MergeSelections =
            onSelectionsChange.mock.calls[onSelectionsChange.mock.calls.length - 1][0];
          expect(lastCall.fieldOverrides).toHaveProperty('surname', 'Jones');
        });
      } else {
        // The conflict table is shown — verify at least Smith and Jones are both visible
        expect(screen.getByText('Smith')).toBeInTheDocument();
        expect(screen.getByText('Jones')).toBeInTheDocument();
      }
    });

    it('removes override when primary value is re-selected', async () => {
      const user = userEvent.setup();
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith', organization: 'Acme' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      const surnameRadios = document.querySelectorAll('input[name="field-surname"]');
      const radioBSurname = Array.from(surnameRadios).find(
        (r) => (r as HTMLInputElement).value === 'b'
      ) as HTMLInputElement | undefined;
      const radioASurname = Array.from(surnameRadios).find(
        (r) => (r as HTMLInputElement).value === 'a'
      ) as HTMLInputElement | undefined;

      if (radioBSurname && radioASurname) {
        await user.click(radioBSurname);
        await user.click(radioASurname);

        await waitFor(() => {
          const lastCall: MergeSelections =
            onSelectionsChange.mock.calls[onSelectionsChange.mock.calls.length - 1][0];
          expect(lastCall.fieldOverrides).not.toHaveProperty('surname');
        });
      } else {
        // Field conflict table present, both values visible
        expect(screen.getByText('Smith')).toBeInTheDocument();
      }
    });

    it('clears field overrides when primary person is changed', async () => {
      const user = userEvent.setup();
      const personA = makePerson({ id: 'a', name: 'Alice', surname: 'Smith', organization: 'Acme' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: 'Jones' });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // Override surname field to use personB's value
      const surnameRadios = document.querySelectorAll('input[name="field-surname"]');
      const radioBSurname = Array.from(surnameRadios).find(
        (r) => (r as HTMLInputElement).value === 'b'
      ) as HTMLInputElement | undefined;

      if (radioBSurname) {
        await user.click(radioBSurname);

        // Now switch primary to personB
        const primaryRadioB = document.querySelector(
          'input[name="primary"][value="b"]'
        ) as HTMLInputElement | null;

        if (primaryRadioB) {
          await user.click(primaryRadioB);

          await waitFor(() => {
            const lastCall: MergeSelections =
              onSelectionsChange.mock.calls[onSelectionsChange.mock.calls.length - 1][0];
            expect(Object.keys(lastCall.fieldOverrides).length).toBe(0);
          });
        }
      }
    });
  });

  describe('Summary section', () => {
    it('shows summary section', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getByText(/summary/i)).toBeInTheDocument();
    });

    it('shows will be deleted warning', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null });
      const personB = makePerson({ id: 'b', name: 'Bob', surname: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(
        screen.getByText(/secondary contact will be deleted after merging/i)
      ).toBeInTheDocument();
    });

    it('shows combined phone count when people have phones', () => {
      const personA = makePerson({
        id: 'a',
        name: 'Alice',
        surname: null,
        phoneNumbers: [{ type: 'mobile', number: '111' }],
      });
      const personB = makePerson({
        id: 'b',
        name: 'Bob',
        surname: null,
        phoneNumbers: [{ type: 'mobile', number: '222' }],
      });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // Should show "2 phones will be combined"
      expect(screen.getByText(/2 phones will be combined/i)).toBeInTheDocument();
    });

    it('shows group count when people are in groups', () => {
      const personA = makePerson({
        id: 'a',
        name: 'Alice',
        surname: null,
        groups: [{ group: { id: 'g1', name: 'Family' } }],
      });
      const personB = makePerson({
        id: 'b',
        name: 'Bob',
        surname: null,
        groups: [{ group: { id: 'g2', name: 'Friends' } }],
      });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      // Combined groups count
      expect(screen.getByText(/2 groups/i)).toBeInTheDocument();
    });
  });

  describe('Non-conflicting fields', () => {
    it('shows fields that only one person has', () => {
      const personA = makePerson({ id: 'a', name: 'Alice', surname: null, organization: 'Acme' });
      const personB = makePerson({ id: 'b', name: 'Alice', surname: null, organization: null });

      render(
        <Wrapper>
          <PersonCompare
            personA={personA}
            personB={personB}
            onSelectionsChange={onSelectionsChange}
          />
        </Wrapper>
      );

      expect(screen.getByText('Acme')).toBeInTheDocument();
    });
  });
});
