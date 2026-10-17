import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import PhotoLightbox from '../../components/PhotoLightbox';
import enMessages from '../../locales/en.json';

function renderLightbox() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PhotoLightbox personId="person-1" name="Ada Lovelace" photo="photo.jpg">
        <span>avatar</span>
      </PhotoLightbox>
      <button type="button">Something behind</button>
    </NextIntlClientProvider>
  );
}

describe('PhotoLightbox', () => {
  afterEach(cleanup);

  it('moves focus into the dialog when it opens', () => {
    renderLightbox();
    const trigger = screen.getByRole('button', { name: 'View photo' });
    trigger.focus();

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the dialog', () => {
    renderLightbox();
    fireEvent.click(screen.getByRole('button', { name: 'View photo' }));
    const close = screen.getByRole('button', { name: 'Close' });

    // jsdom never moves focus on a synthetic Tab, so "focus did not move"
    // proves nothing. A false return means the trap called preventDefault,
    // which is what stops a real browser leaving the dialog.
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(close).toHaveFocus();
  });

  it('pulls focus back in when it has escaped to the page behind', () => {
    renderLightbox();
    fireEvent.click(screen.getByRole('button', { name: 'View photo' }));
    screen.getByRole('button', { name: 'Something behind', hidden: true }).focus();

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('returns focus to the avatar when it closes', () => {
    renderLightbox();
    const trigger = screen.getByRole('button', { name: 'View photo' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).not.toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
