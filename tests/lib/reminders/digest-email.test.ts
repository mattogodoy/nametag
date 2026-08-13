import { describe, it, expect } from 'vitest';
import { emailTemplates } from '@/lib/email';

const rows = [
  { personName: 'Sarah Chen', eventTitle: 'Birthday', formattedDate: 'May 12, 2026', daysUntil: 1 },
  { personName: 'Tom Rivera', eventTitle: 'Anniversary', formattedDate: 'May 15, 2026', daysUntil: 4 },
];

describe('weeklyDigest template', () => {
  it('counts the events in the subject', async () => {
    const template = await emailTemplates.weeklyDigest(rows, 0, 'https://example.com/u?token=a', 'en');
    expect(template.subject).toContain('2');
  });

  it('uses singular copy for a single event', async () => {
    const template = await emailTemplates.weeklyDigest([rows[0]], 0, 'https://example.com/u?token=a', 'en');
    expect(template.subject.toLowerCase()).toContain('one event');
  });

  it('lists every person in the html', async () => {
    const template = await emailTemplates.weeklyDigest(rows, 0, 'https://example.com/u?token=a', 'en');
    expect(template.html).toContain('Sarah Chen');
    expect(template.html).toContain('Tom Rivera');
  });

  it('mentions the overflow count when events were truncated', async () => {
    const template = await emailTemplates.weeklyDigest(rows, 5, 'https://example.com/u?token=a', 'en');
    expect(template.html).toContain('5');
  });

  it('counts the subject as rows plus overflow, not rows alone', async () => {
    // rows is already capped at DIGEST_MAX_ROWS by selectDigestEvents. A user
    // with 30 events gets 25 rows and an overflowCount of 5: the subject must
    // say 30, matching the body's "And 5 more" line, not undercount at 25.
    const cappedRows = Array.from({ length: 25 }, (_, i) => ({
      ...rows[0],
      personName: `Person ${i}`,
    }));
    const template = await emailTemplates.weeklyDigest(
      cappedRows,
      5,
      'https://example.com/u?token=a',
      'en'
    );
    expect(template.subject).toContain('30');
    expect(template.subject).not.toContain('25');
  });

  it('omits the overflow line when nothing was truncated', async () => {
    const template = await emailTemplates.weeklyDigest(rows, 0, 'https://example.com/u?token=a', 'en');
    expect(template.html).not.toContain('And 0 more');
  });

  it('escapes html in person names', async () => {
    const hostile = [{ ...rows[0], personName: '<script>alert(1)</script>' }];
    const template = await emailTemplates.weeklyDigest(hostile, 0, 'https://example.com/u?token=a', 'en');
    expect(template.html).not.toContain('<script>');
  });

  it('includes the unsubscribe link', async () => {
    const url = 'https://example.com/u?token=a';
    const template = await emailTemplates.weeklyDigest(rows, 0, url, 'en');
    expect(template.html).toContain(url);
    expect(template.text).toContain(url);
  });

  describe('Russian numeral agreement', () => {
    it('uses "дня" for inDays at a count of 2', async () => {
      const twoDaysRow = [{ ...rows[0], daysUntil: 2 }];
      const template = await emailTemplates.weeklyDigest(twoDaysRow, 0, 'https://example.com/u?token=a', 'ru-RU');
      expect(template.html).toContain('2 дня');
      expect(template.html).not.toContain('2 дней');
      expect(template.text).toContain('2 дня');
      expect(template.text).not.toContain('2 дней');
    });

    it('uses "дней" for inDays at a count of 5', async () => {
      const fiveDaysRow = [{ ...rows[0], daysUntil: 5 }];
      const template = await emailTemplates.weeklyDigest(fiveDaysRow, 0, 'https://example.com/u?token=a', 'ru-RU');
      expect(template.html).toContain('5 дней');
      expect(template.text).toContain('5 дней');
    });

    it('uses "события" for a subject count of 3', async () => {
      const threeRows = [rows[0], rows[1], { ...rows[0], personName: 'Third Person' }];
      const template = await emailTemplates.weeklyDigest(threeRows, 0, 'https://example.com/u?token=a', 'ru-RU');
      expect(template.subject).toContain('3 события');
      expect(template.subject).not.toContain('3 событий');
    });

    it('uses "событий" for a subject count of 7', async () => {
      const sevenRows = Array.from({ length: 7 }, (_, i) => ({
        ...rows[0],
        personName: `Person ${i}`,
      }));
      const template = await emailTemplates.weeklyDigest(sevenRows, 0, 'https://example.com/u?token=a', 'ru-RU');
      expect(template.subject).toContain('7 событий');
    });
  });
});
