import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import LabelVariantList from '../../components/relationship-labels/LabelVariantList';
import type { LabelVariant } from '../../lib/relationship-labels/types';
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

const genderSuggestions = ['woman', 'man'];

function condition(overrides: Partial<LabelVariant['conditions'][number]> = {}) {
  return {
    subject: 'DESCRIBED' as const,
    source: 'PERSON_FIELD' as const,
    subjectRef: 'gender',
    operator: 'IS' as const,
    operand: 'lit:woman',
    ...overrides,
  };
}

/**
 * Renders LabelVariantList as a genuinely controlled component: onChange
 * updates local state and is also recorded by a spy, so tests can assert both
 * "what was emitted" and see the component re-render with the new value, the
 * way its real parent (the relationship type form) would drive it.
 */
function renderList(initial: LabelVariant[], typeLabel = 'sibling') {
  const onChange = vi.fn();

  function Stateful() {
    const [variants, setVariants] = useState(initial);
    return (
      <LabelVariantList
        variants={variants}
        typeLabel={typeLabel}
        groups={groups}
        templates={templates}
        genderSuggestions={genderSuggestions}
        onChange={(next) => {
          onChange(next);
          setVariants(next);
        }}
      />
    );
  }

  render(
    <Wrapper>
      <Stateful />
    </Wrapper>
  );

  return { onChange };
}

describe('LabelVariantList', () => {
  it('renders one row per variant plus a fallback row', () => {
    renderList([
      { label: 'frère', conditions: [condition()] },
      { label: 'soeur', conditions: [condition({ operand: 'lit:woman' })] },
    ]);

    expect(screen.getByDisplayValue('frère')).toBeInTheDocument();
    expect(screen.getByDisplayValue('soeur')).toBeInTheDocument();
    // Fallback row: empty value, placeholder is the type's own label.
    expect(screen.getByPlaceholderText('sibling')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sibling')).toHaveValue('');
  });

  it('has no remove button and no order buttons on the fallback row', () => {
    renderList([{ label: 'frère', conditions: [condition()] }]);

    // Exactly one real variant means exactly one set of row controls.
    expect(screen.getAllByRole('button', { name: /Remove this variant/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Move up/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Move down/ })).toHaveLength(1);
  });

  it('shows the type label as placeholder on the synthetic fallback, and typing into it appends a variant with an empty condition list', async () => {
    const user = userEvent.setup();
    const { onChange } = renderList([{ label: 'frère', conditions: [condition()] }]);

    const fallbackInput = screen.getByPlaceholderText('sibling');
    await user.type(fallbackInput, 'sibling');

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as LabelVariant[];
    expect(lastCall).toHaveLength(2);
    expect(lastCall[1]).toEqual({ label: 'sibling', conditions: [] });
  });

  it('swaps the first two variants when move up is clicked on the second one', async () => {
    const user = userEvent.setup();
    const { onChange } = renderList([
      { label: 'frère', conditions: [condition()] },
      { label: 'soeur', conditions: [condition()] },
      { label: 'sibling', conditions: [] },
    ]);

    const moveUpButtons = screen.getAllByRole('button', { name: /Move up/ });
    await user.click(moveUpButtons[1]);

    expect(onChange).toHaveBeenCalledWith([
      { label: 'soeur', conditions: [condition()] },
      { label: 'frère', conditions: [condition()] },
      { label: 'sibling', conditions: [] },
    ]);
  });

  it('disables move up on the first variant and move down on the last non-fallback variant', () => {
    renderList([
      { label: 'frère', conditions: [condition()] },
      { label: 'soeur', conditions: [condition()] },
      { label: 'sibling', conditions: [] },
    ]);

    const moveUpButtons = screen.getAllByRole('button', { name: /Move up/ });
    const moveDownButtons = screen.getAllByRole('button', { name: /Move down/ });

    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  it('emits the array without the removed variant when its remove button is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderList([
      { label: 'frère', conditions: [condition()] },
      { label: 'soeur', conditions: [condition()] },
      { label: 'sibling', conditions: [] },
    ]);

    const removeButtons = screen.getAllByRole('button', { name: /Remove this variant/ });
    await user.click(removeButtons[0]);

    expect(onChange).toHaveBeenCalledWith([
      { label: 'soeur', conditions: [condition()] },
      { label: 'sibling', conditions: [] },
    ]);
  });

  it('renders warnings from findLabelWarnings as translated notices attached to the right variant', () => {
    renderList([
      { label: 'frère', conditions: [] },
      { label: 'soeur', conditions: [condition()] },
    ]);

    // The first variant has no conditions, so it is the (explicit) fallback,
    // and the second variant comes after it: UNREACHABLE_AFTER_FALLBACK.
    expect(
      screen.getByText('This variant comes after the fallback and will never be reached.')
    ).toBeInTheDocument();
  });

  it('generates one variant per option of a SELECT template, prefilled with the option names, inserted before the fallback', async () => {
    const user = userEvent.setup();
    const { onChange } = renderList([{ label: 'sibling', conditions: [] }]);

    const fieldSelect = screen.getByRole('combobox', { name: 'Generate from a field' });
    await user.selectOptions(fieldSelect, 'tpl-1');
    await user.click(screen.getByRole('button', { name: 'Create the variants' }));

    expect(onChange).toHaveBeenCalledWith([
      {
        label: 'Red',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'CUSTOM_FIELD',
            subjectRef: 'tpl-1',
            operator: 'IS',
            operand: 'lit:Red',
          },
        ],
      },
      {
        label: 'Blue',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'CUSTOM_FIELD',
            subjectRef: 'tpl-1',
            operator: 'IS',
            operand: 'lit:Blue',
          },
        ],
      },
      { label: 'sibling', conditions: [] },
    ]);
  });
});
