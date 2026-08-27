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

describe('ConditionRow', () => {
  it('renders the segments in the order supplied by the locale template', () => {
    renderRow(baseCondition());

    // segmentOrder in en.json is "prefix,subject,data,operator,operand"
    expect(screen.getByText('if')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /the described person|the other person/i })).toBeInTheDocument();

    const prefixIndex = Array.from(document.body.querySelectorAll('*')).findIndex(
      (el) => el.textContent === 'if' && el.children.length === 0
    );
    expect(prefixIndex).toBeGreaterThanOrEqual(0);

    // subject select renders before the data select in the DOM, per the
    // default locale order (prefix, subject, data, operator, operand).
    const subjectSelect = screen.getByDisplayValue('the described person');
    const dataSelect = screen.getByDisplayValue('gender');
    const position = subjectSelect.compareDocumentPosition(dataSelect);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('calls onRemove when the remove button is clicked', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderRow(baseCondition());

    await user.click(screen.getByRole('button', { name: 'Remove this condition' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
