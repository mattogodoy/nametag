import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ComboboxInput from '@/components/ui/ComboboxInput';

const OPTIONS = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'anniversary', label: 'Anniversary' },
];

describe('ComboboxInput', () => {
  it('does not fire onChange on outside mousedown when closed and untouched', () => {
    const onChange = vi.fn();
    render(
      <ComboboxInput
        options={OPTIONS}
        value={null}
        customText="Birthday"
        onChange={onChange}
      />
    );

    // Clicking elsewhere on the page (e.g. a sibling toggle) must not
    // re-commit the unchanged text: the resulting parent re-render swallows
    // the sibling's click.
    fireEvent.mouseDown(document.body);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not re-commit unchanged text on outside mousedown after opening the dropdown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboboxInput
        options={OPTIONS}
        value={null}
        customText="Birthday"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('combobox'));
    onChange.mockClear();

    fireEvent.mouseDown(document.body);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('still commits trimmed typed text on outside mousedown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboboxInput
        options={OPTIONS}
        value={null}
        customText=""
        onChange={onChange}
      />
    );

    await user.type(screen.getByRole('combobox'), 'Graduation ');
    onChange.mockClear();

    fireEvent.mouseDown(document.body);

    expect(onChange).toHaveBeenCalledWith(null, 'Graduation');
  });
});
