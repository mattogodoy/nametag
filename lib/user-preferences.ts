import { prisma } from '@/lib/prisma';
import type { Theme, DateFormat, NameOrder, NameDisplayFormat } from '@prisma/client';

/**
 * The user preferences that affect how content is rendered.
 *
 * Nine pages and three API routes each ran their own `user.findUnique` with a
 * slightly different `select` and then re-applied the same defaults by hand,
 * inconsistently: some used `||`, some `??`, and several cast through `as`.
 * This module owns the fetch, the defaults, and the types once.
 */

/** How the network graph renders. Stored as a free-form String column. */
export type GraphMode = 'individuals' | 'bubbles';

export interface DisplayPreferences {
  theme: Theme;
  dateFormat: DateFormat;
  nameOrder: NameOrder;
  nameDisplayFormat: NameDisplayFormat;
  graphMode: GraphMode;
  /** Locale code. Not narrowed to SupportedLocale: old rows may hold anything. */
  language: string;
}

/**
 * Applied when the column is null or the user row is missing. These mirror the
 * `@default` values in prisma/schema.prisma, so a user who has never touched
 * settings renders the same way the database would describe them.
 */
export const DISPLAY_PREFERENCE_DEFAULTS: DisplayPreferences = {
  theme: 'DARK',
  dateFormat: 'MDY',
  nameOrder: 'WESTERN',
  nameDisplayFormat: 'FULL',
  graphMode: 'individuals',
  language: 'en',
};

/** Narrow the free-form graphMode column to the two modes the UI renders. */
function toGraphMode(value: string | null | undefined): GraphMode {
  return value === 'bubbles' ? 'bubbles' : 'individuals';
}

/**
 * Load a user's display preferences, with defaults already applied.
 *
 * Reads one row by primary key, so callers should not try to avoid it by
 * selecting a narrower set of columns.
 */
export async function getUserDisplayPreferences(
  userId: string
): Promise<DisplayPreferences> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      theme: true,
      dateFormat: true,
      nameOrder: true,
      nameDisplayFormat: true,
      graphMode: true,
      language: true,
    },
  });

  return {
    theme: user?.theme ?? DISPLAY_PREFERENCE_DEFAULTS.theme,
    dateFormat: user?.dateFormat ?? DISPLAY_PREFERENCE_DEFAULTS.dateFormat,
    nameOrder: user?.nameOrder ?? DISPLAY_PREFERENCE_DEFAULTS.nameOrder,
    nameDisplayFormat:
      user?.nameDisplayFormat ?? DISPLAY_PREFERENCE_DEFAULTS.nameDisplayFormat,
    graphMode: toGraphMode(user?.graphMode),
    language: user?.language ?? DISPLAY_PREFERENCE_DEFAULTS.language,
  };
}
