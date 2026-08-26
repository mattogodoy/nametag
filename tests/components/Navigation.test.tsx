import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import Navigation from '@/components/Navigation';
import { clearNameOrderCache } from '@/lib/user-name-order';
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
    // The name-order cache is module state, so it outlives a single test.
    clearNameOrderCache();
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

  describe('keyboard and focus', () => {
    /**
     * The drawer's own X carries the same label, so these have to pick the
     * header control specifically: it is the one outside the dialog.
     */
    function headerMenuToggle() {
      const found = screen
        .getAllByRole('button', { name: new RegExp(`^(${enMessages.nav.openMenu}|${enMessages.nav.closeMenu})$`) })
        .find((button) => !button.closest('[role="dialog"]'));
      if (!found) throw new Error('header menu toggle not found');
      return found;
    }

    it('closes the drawer from the header button, which stays reachable while it is open', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(headerMenuToggle());
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(headerMenuToggle());

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('reports the drawer state on the header button', async () => {
      const user = userEvent.setup();
      renderNav();

      expect(headerMenuToggle()).toHaveAttribute('aria-expanded', 'false');
      expect(headerMenuToggle()).toHaveAccessibleName(enMessages.nav.openMenu);

      await user.click(headerMenuToggle());

      expect(headerMenuToggle()).toHaveAttribute('aria-expanded', 'true');
      expect(headerMenuToggle()).toHaveAccessibleName(enMessages.nav.closeMenu);
    });

    it('collapses the search on escape even after focus has left the field', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.click(screen.getByRole('button', { name: enMessages.common.search }));
      searchInputs()[1].blur();
      await user.keyboard('{Escape}');

      expect(searchInputs()).toHaveLength(1);
    });

    it('returns focus to the search button when the field collapses', async () => {
      const user = userEvent.setup();
      renderNav();

      const searchButton = screen.getByRole('button', { name: enMessages.common.search });
      await user.click(searchButton);
      await user.click(screen.getByRole('button', { name: enMessages.common.cancel }));

      expect(document.activeElement).toBe(searchButton);
    });

    /**
     * jsdom performs no layout, so offsetParent is null for every element and
     * the shortcut always takes the narrow-screen branch here. The desktop
     * branch is not reachable in this environment.
     */
    it('opens the mobile search from the keyboard shortcut when the desktop field is off screen', async () => {
      const user = userEvent.setup();
      renderNav();

      await user.keyboard('{Meta>}k{/Meta}');

      expect(searchInputs()).toHaveLength(2);
    });
  });

  describe('name order lookup', () => {
    it('fetches the profile once no matter how often the search is opened', async () => {
      const user = userEvent.setup();
      renderNav();

      const profileCalls = () =>
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => url === '/api/user/profile').length;

      await waitFor(() => expect(profileCalls()).toBe(1));

      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: enMessages.common.search }));
        await user.click(screen.getByRole('button', { name: enMessages.common.cancel }));
      }

      expect(profileCalls()).toBe(1);
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
