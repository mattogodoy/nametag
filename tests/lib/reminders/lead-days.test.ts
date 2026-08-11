import { describe, it, expect } from 'vitest';
import { resolveLeadDays } from '@/lib/reminders/lead-days';

describe('resolveLeadDays', () => {
  it('inherits the user default when the date has no override', () => {
    expect(resolveLeadDays(null, 7)).toBe(7);
  });

  it('inherits the user default when the date value is undefined', () => {
    expect(resolveLeadDays(undefined, 30)).toBe(30);
  });

  it('uses the per-date override when one is set', () => {
    expect(resolveLeadDays(14, 7)).toBe(14);
  });

  // This is the reason the module exists. Writing `dateLeadDays || default`
  // would fall through to 7 here, silently sending a reminder a week early
  // for a date the user explicitly set to day-of only.
  it('treats an explicit 0 override as day-of only, not as absent', () => {
    expect(resolveLeadDays(0, 7)).toBe(0);
  });

  it('falls back to 0 when neither the date nor the user has a value', () => {
    expect(resolveLeadDays(null, null)).toBe(0);
  });
});
