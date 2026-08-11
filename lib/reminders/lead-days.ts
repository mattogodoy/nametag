/**
 * Resolve how many days before an event its reminder should fire.
 *
 * A null or undefined per-date value means "inherit the user's default", so
 * changing the setting applies to every date that was never overridden.
 *
 * Uses `??` and not `||` on purpose: an explicit 0 means "day-of only for this
 * date" and must win over a non-zero user default.
 */
export function resolveLeadDays(
  dateLeadDays: number | null | undefined,
  userDefaultLeadDays: number | null | undefined
): number {
  return dateLeadDays ?? userDefaultLeadDays ?? 0;
}
