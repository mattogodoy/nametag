import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import ConditionRow from '../../components/relationship-labels/ConditionRow';
import type { LabelCondition } from '../../lib/relationship-labels/types';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

type Messages = typeof enMessages;

/**
 * Clones the real en.json messages with `conditionalLabels.segmentOrder`
 * overridden, so a test can prove the component actually reads the key
 * instead of only ever exercising the shipped value.
 */
function messagesWithSegmentOrder(order: string): Messages {
  const clone = JSON.parse(JSON.stringify(enMessages)) as Messages;
  clone.relationshipTypes.form.conditionalLabels.segmentOrder = order;
  return clone;
}

function WrapperWithMessages({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const groups = [
  { id: 'group-1', name: 'Family' },
  { id: 'group-2', name: 'Coworkers' },
];

const templates = [
  { id: 'tpl-1', name: 'Favorite color', type: 'SELECT' as const, options: ['Red', 'Blue'] },
  { id: 'tpl-2', name: 'Is vegetarian', type: 'BOOLEAN' as const, options: [] },
];

const genderSuggestions = ['woman', 'man', 'nonbinary'];

function baseCondition(overrides: Partial<LabelCondition> = {}): LabelCondition {
  return {
    subject: 'DESCRIBED',
    source: 'PERSON_FIELD',
    subjectRef: 'gender',
    operator: 'IS',
    operand: 'lit:woman',
    ...overrides,
  };
}

function renderRow(
  condition: LabelCondition,
  handlers: { onChange?: (c: LabelCondition) => void; onRemove?: () => void } = {}
) {
  const onChange = handlers.onChange ?? vi.fn();
  const onRemove = handlers.onRemove ?? vi.fn();
  render(
    <Wrapper>
      <ConditionRow
        condition={condition}
        groups={groups}
        templates={templates}
        genderSuggestions={genderSuggestions}
        onChange={onChange}
        onRemove={onRemove}
      />
    </Wrapper>
  );
  return { onChange, onRemove };
}

function renderRowWithMessages(
  messages: Messages,
  condition: LabelCondition,
  handlers: { onChange?: (c: LabelCondition) => void; onRemove?: () => void } = {}
) {
  const onChange = handlers.onChange ?? vi.fn();
  const onRemove = handlers.onRemove ?? vi.fn();
  render(
    <WrapperWithMessages messages={messages}>
      <ConditionRow
        condition={condition}
        groups={groups}
        templates={templates}
        genderSuggestions={genderSuggestions}
        onChange={onChange}
        onRemove={onRemove}
      />
    </WrapperWithMessages>
  );
  return { onChange, onRemove };
}

/** True when `before` precedes `after` in document order. */
function precedes(before: Element, after: Element): boolean {
  // eslint-disable-next-line no-bitwise
  return Boolean(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('ConditionRow', () => {
  it('renders the segments in the order supplied by the locale template, and follows an overridden order', () => {
    renderRow(baseCondition());

    // segmentOrder in en.json is "prefix,subject,data,operator,operand"
    const prefix = screen.getByText('if');
    const subjectSelect = screen.getByRole('combobox', { name: 'Which person' });
    const dataSelect = screen.getByRole('combobox', { name: 'Which data' });
    const operatorSelect = screen.getByRole('combobox', { name: 'Comparison' });
    const operandModeSelect = screen.getByRole('combobox', { name: 'Compare against' });

    expect(precedes(prefix, subjectSelect)).toBe(true);
    expect(precedes(subjectSelect, dataSelect)).toBe(true);
    expect(precedes(dataSelect, operatorSelect)).toBe(true);
    expect(precedes(operatorSelect, operandModeSelect)).toBe(true);

    // A component that hardcoded this JSX order and ignored the locale key
    // would pass the assertions above identically, so also render with the
    // key overridden to the exact reverse and confirm the DOM order flips.
    cleanup();
    renderRowWithMessages(messagesWithSegmentOrder('operand,operator,data,subject,prefix'), baseCondition());

    const reversedPrefix = screen.getByText('if');
    const reversedSubjectSelect = screen.getByRole('combobox', { name: 'Which person' });
    const reversedDataSelect = screen.getByRole('combobox', { name: 'Which data' });
    const reversedOperatorSelect = screen.getByRole('combobox', { name: 'Comparison' });
    const reversedOperandModeSelect = screen.getByRole('combobox', { name: 'Compare against' });

    expect(precedes(reversedOperandModeSelect, reversedOperatorSelect)).toBe(true);
    expect(precedes(reversedOperatorSelect, reversedDataSelect)).toBe(true);
    expect(precedes(reversedDataSelect, reversedSubjectSelect)).toBe(true);
    expect(precedes(reversedSubjectSelect, reversedPrefix)).toBe(true);
  });

  it("keeps the subject select's accessible name stable regardless of which person is selected", () => {
    renderRow(baseCondition({ subject: 'DESCRIBED' }));
    expect(screen.getByRole('combobox', { name: 'Which person' })).toHaveValue('DESCRIBED');

    cleanup();
    renderRow(baseCondition({ subject: 'OTHER' }));
    // The accessible name must stay "Which person" in both states: it must
    // never adopt the text of whichever option happens to be selected.
    expect(screen.getByRole('combobox', { name: 'Which person' })).toHaveValue('OTHER');
  });

  it('resets the operator and clears the operand when the data selector changes', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(baseCondition());

    const dataSelect = screen.getByDisplayValue('gender');
    await user.selectOptions(dataSelect, 'GROUP::group-1');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'GROUP',
        subjectRef: 'group-1',
        operator: 'IN_GROUP',
        operand: null,
      })
    );
  });

  it('hides the value input and emits operand: null when an operand-less operator is selected', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(baseCondition());

    const operatorSelect = screen.getByDisplayValue('is');
    await user.selectOptions(operatorSelect, 'IS_SET');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ operator: 'IS_SET', operand: null })
    );

    // Re-render (in a clean DOM) with the operand-less operator applied, and
    // confirm the value input is gone.
    cleanup();
    renderRow(baseCondition({ operator: 'IS_SET', operand: null }));
    expect(screen.queryAllByDisplayValue('woman')).toHaveLength(0);
  });

  it('offers only the group operators when the source is GROUP', () => {
    renderRow(
      baseCondition({ source: 'GROUP', subjectRef: 'group-1', operator: 'IN_GROUP', operand: null })
    );

    const operatorSelect = screen.getByDisplayValue('belongs to') as HTMLSelectElement;
    const optionLabels = Array.from(operatorSelect.options).map((o) => o.textContent);

    expect(optionLabels).toEqual(['belongs to', 'does not belong to']);
  });

  it('offers the seven date operators plus the two shortcuts for a date source, and "is past" emits BEFORE with operand now', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(
      baseCondition({
        source: 'DATE_TYPE',
        subjectRef: 'birthday',
        operator: 'BEFORE',
        operand: 'lit:2020-01-01',
      })
    );

    const operatorSelect = screen.getByDisplayValue('is before') as HTMLSelectElement;
    const optionLabels = Array.from(operatorSelect.options).map((o) => o.textContent);

    expect(optionLabels).toEqual([
      'is before',
      'is on or before',
      'is after',
      'is on or after',
      'is the same day as',
      'is not the same day as',
      'is set',
      'is not set',
      'is past',
      'is upcoming',
    ]);

    await user.selectOptions(operatorSelect, screen.getByText('is past') as HTMLOptionElement);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ operator: 'BEFORE', operand: 'now' })
    );
  });

  it('emits operand ref:<subjectRef> when the right-hand side is switched to the other person\'s same data', async () => {
    const user = userEvent.setup();
    const { onChange } = renderRow(baseCondition());

    const modeSelect = screen.getByDisplayValue('a value') as HTMLSelectElement;
    await user.selectOptions(modeSelect, 'ref');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ operand: 'ref:gender' })
    );
  });

  it('renders a text input with a datalist of gender suggestions for a gender field', () => {
    renderRow(baseCondition());

    const input = screen.getByDisplayValue('woman') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('list')).toBeTruthy();

    const datalist = document.getElementById(input.getAttribute('list')!);
    expect(datalist).not.toBeNull();
    const options = Array.from(datalist!.querySelectorAll('option')).map((o) => o.getAttribute('value'));
    expect(options).toEqual(genderSuggestions);
  });

  it('narrows the operator list to the boolean operators for a BOOLEAN custom field', () => {
    renderRow(
      baseCondition({
        source: 'CUSTOM_FIELD',
        subjectRef: 'tpl-2', // "Is vegetarian", type BOOLEAN
        operator: 'IS_TRUE',
        operand: null,
      })
    );

    const operatorSelect = screen.getByRole('combobox', { name: 'Comparison' }) as HTMLSelectElement;
    const optionValues = Array.from(operatorSelect.options).map((o) => o.value);

    expect(optionValues).toContain('IS_TRUE');
    expect(optionValues).toContain('IS_FALSE');
    expect(optionValues).not.toContain('CONTAINS');
    expect(optionValues).not.toContain('GT');
  });

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderRow(baseCondition());

    await user.click(screen.getByRole('button', { name: 'Remove this condition' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
