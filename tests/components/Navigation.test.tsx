import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import Navigation from '@/components/Navigation';
import enMessages from '@/locales/en.json';

const handleSignOut = vi.fn();

vi.mock('@/app/actions/auth', () => ({
  handleSignOut: () => handleSignOut(),
}));

/**
 * NavigationSearch re-runs its search effect whenever the `search` callback
 * changes identity, so this stub has to be a single frozen object. Returning a
 * fresh one per render spins the component forever.
 */
const searchIndex = vi.hoisted(() => ({
  search: () => [],
  isReady: true,
  refreshIndex: () => {},
}));

vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => searchIndex,
}));

function renderNav() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <Navigation
        userEmail="matto@example.com"
        userName="Matto Godoy"
        userNickname="Matto"
        userPhoto={null}
        currentPath="/dashboard"
      />
    </NextIntlClientProvider>
  );
}

/**
 * The desktop search input is `hidden md:block`, so it stays in the DOM at every
 * width. jsdom applies no Tailwind CSS, so visibility assertions would pass no
 * matter what. Instead these tests count search inputs: exactly one means only
 * the desktop instance is mounted, two means the mobile one opened as well.
 */
function searchInputs() {
  return screen.getAllByPlaceholderText(enMessages.nav.search.placeholder);
}

describe('Navigation', () => {
  beforeEach(() => {
    handleSignOut.mockReset();
    // NavigationSearch reads the name-order preference on mount. Answering
    // without a nameOrder keeps it from setting state after the assertions.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: {} }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
  });

  describe('mobile search', () => {
    it('keeps the mobile search field collapsed until the search button is tapped', () => {
      renderNav();

      expect(searchInputs()).toHaveLength(1);
      expect(screen.queryByRole('button', { name: enMessages.common.cancel })).not.toBeInTheDocument();
    });

    it('expands a focused search field when the search button is tapped', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.common.search }));

      const inputs = searchInputs();
      expect(inputs).toHaveLength(2);
      expect(document.activeElement).toBe(inputs[1]);
    });

    it('collapses the search field again when cancel is tapped', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.common.search }));
      await user.click(screen.getByRole('button', { name: enMessages.common.cancel }));

      expect(searchInputs()).toHaveLength(1);
    });

    it('collapses the search field when escape is pressed', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.common.search }));
      await user.keyboard('{Escape}');

      expect(searchInputs()).toHaveLength(1);
    });

    it('collapses the search field when the menu is opened', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.common.search }));
      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));

      expect(searchInputs()).toHaveLength(1);
    });
  });

  describe('mobile menu', () => {
    it('no longer duplicates the search field inside the menu', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(searchInputs()).toHaveLength(1);
    });

    it('shows who is signed in at the top of the menu', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));

      expect(within(screen.getByRole('dialog')).getByText('Matto')).toBeInTheDocument();
    });

    it('offers the account actions that used to live in the user menu', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));
      const dialog = within(screen.getByRole('dialog'));

      expect(dialog.getByRole('link', { name: enMessages.nav.userMenu.settings })).toHaveAttribute('href', '/settings');
      expect(dialog.getByRole('link', { name: enMessages.nav.userMenu.documentation })).toBeInTheDocument();
      expect(dialog.getByRole('button', { name: enMessages.nav.userMenu.signOut })).toBeInTheDocument();
    });

    it('signs out from the menu', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: enMessages.nav.userMenu.signOut }));

      expect(handleSignOut).toHaveBeenCalledTimes(1);
    });

    it('closes the menu when a nav item is followed', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.nav.openMenu }));
      await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: enMessages.nav.groups }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('user menu', () => {
    /**
     * jsdom cannot evaluate the `md:` breakpoint, so the responsive contract is
     * asserted on the class that carries it. This still fails if the wrapper is
     * dropped and the avatar button returns to the mobile header.
     */
    it('restricts the avatar dropdown to desktop widths', () => {
      renderNav();

      const trigger = screen.getByRole('button', { name: /Matto/ });
      const wrapper = trigger.closest('div.hidden');

      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveClass('md:block');
    });
  });
});
