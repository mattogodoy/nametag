import type { useTranslations } from 'next-intl';

/**
 * Preset advance-notice lead times, in days, offered by both the account
 * default selector (ReminderLeadTimeSelector) and the per-date override
 * (ImportantDatesManager). Kept as a plain readonly array, not a literal
 * tuple, so callers can check an arbitrary numeric value against it without
 * TypeScript narrowing the comparison to the preset literals.
 */
export const LEAD_DAY_OPTIONS: readonly number[] = [0, 1, 3, 7, 14, 30];

/**
 * Label for a lead time value, e.g. "3 days before". Takes the translator as
 * an argument on purpose, so this stays a pure function: the caller decides
 * which translator instance (and therefore which locale) applies, and this
 * module never needs to know about React or next-intl's runtime beyond the
 * type of the translator itself.
 *
 * Both consumers scope their translator to the `settings.notifications`
 * namespace so the wording (and the Russian plural forms) can never drift
 * between the two surfaces.
 */
export function getLeadTimeLabel(
  days: number,
  t: ReturnType<typeof useTranslations>
): string {
  if (days === 0) return t('leadTimeDayOf');
  if (days === 1) return t('leadTimeOneDay');
  return t('leadTimeDays', { days });
}

/**
 * The preset list plus, if `value` is not already one of the presets, that
 * value inserted in sorted order. Used so a select never renders blank for a
 * value the API accepts but the UI does not offer as a preset (validations.ts
 * allows 0-365; the presets are just the common shortcuts).
 */
export function getLeadTimeSelectOptions(value: number): readonly number[] {
  if (LEAD_DAY_OPTIONS.includes(value)) return LEAD_DAY_OPTIONS;
  return [...LEAD_DAY_OPTIONS, value].sort((a, b) => a - b);
}
