import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userFindUnique: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));

import { getUserDisplayPreferences, DISPLAY_PREFERENCE_DEFAULTS } from '@/lib/user-preferences';

describe('getUserDisplayPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the stored preferences', async () => {
    mocks.userFindUnique.mockResolvedValue({
      theme: 'LIGHT',
      dateFormat: 'DMY',
      nameOrder: 'EASTERN',
      nameDisplayFormat: 'SHORT',
      graphMode: 'bubbles',
      language: 'es-ES',
    });

    const prefs = await getUserDisplayPreferences('user-1');

    expect(prefs).toEqual({
      theme: 'LIGHT',
      dateFormat: 'DMY',
      nameOrder: 'EASTERN',
      nameDisplayFormat: 'SHORT',
      graphMode: 'bubbles',
      language: 'es-ES',
    });
  });

  it('falls back to defaults for a missing user', async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    expect(await getUserDisplayPreferences('nobody')).toEqual(
      DISPLAY_PREFERENCE_DEFAULTS
    );
  });

  it('falls back to defaults for null columns', async () => {
    mocks.userFindUnique.mockResolvedValue({
      theme: null,
      dateFormat: null,
      nameOrder: null,
      nameDisplayFormat: null,
      graphMode: null,
      language: null,
    });

    expect(await getUserDisplayPreferences('user-1')).toEqual(
      DISPLAY_PREFERENCE_DEFAULTS
    );
  });

  it('normalizes an unrecognized graphMode to individuals', async () => {
    // graphMode is a free-form String column, so an unexpected value is
    // possible and must not reach the graph component.
    mocks.userFindUnique.mockResolvedValue({ graphMode: 'wobbles' });

    const prefs = await getUserDisplayPreferences('user-1');

    expect(prefs.graphMode).toBe('individuals');
  });

  it('keeps bubbles when that is what is stored', async () => {
    mocks.userFindUnique.mockResolvedValue({ graphMode: 'bubbles' });

    expect((await getUserDisplayPreferences('user-1')).graphMode).toBe('bubbles');
  });

  it('reads the row once, by id', async () => {
    mocks.userFindUnique.mockResolvedValue({});

    await getUserDisplayPreferences('user-1');

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindUnique.mock.calls[0][0].where).toEqual({ id: 'user-1' });
  });

  it('has defaults matching the Prisma schema defaults', () => {
    // If a schema default changes, these must change with it, otherwise a
    // freshly created user renders differently from what the database says.
    expect(DISPLAY_PREFERENCE_DEFAULTS).toEqual({
      theme: 'DARK',
      dateFormat: 'MDY',
      nameOrder: 'WESTERN',
      nameDisplayFormat: 'FULL',
      graphMode: 'individuals',
      language: 'en',
    });
  });
});
