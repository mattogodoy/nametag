import { describe, it, expect } from 'vitest';
import { emailTemplates } from '@/lib/email';

describe('importantDateLeadReminder template', () => {
  it('states the day count in the subject', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      'May 12, 2026',
      7,
      'https://example.com/unsubscribe?token=abc',
      'en'
    );

    expect(template.subject).toContain('Sarah Chen');
    expect(template.subject).toContain('7');
  });

  it('says tomorrow instead of "in 1 days"', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      'May 12, 2026',
      1,
      'https://example.com/unsubscribe?token=abc',
      'en'
    );

    expect(template.subject).toContain('tomorrow');
    expect(template.subject).not.toContain('1 days');
  });

  it('includes the unsubscribe link in both html and text', async () => {
    const url = 'https://example.com/unsubscribe?token=abc';
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      'May 12, 2026',
      7,
      url,
      'en'
    );

    expect(template.html).toContain(url);
    expect(template.text).toContain(url);
  });

  it('escapes html in the person name', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      '<script>alert(1)</script>',
      'Birthday',
      'May 12, 2026',
      7,
      'https://example.com/unsubscribe?token=abc',
      'en'
    );

    expect(template.html).not.toContain('<script>');
  });

  it('uses the genitive singular "дня" for a count of 3 in Russian', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      '12 мая 2026',
      3,
      'https://example.com/unsubscribe?token=abc',
      'ru-RU'
    );

    expect(template.subject).toContain('3 дня');
    expect(template.subject).not.toContain('3 дней');
  });

  it('uses the genitive plural "дней" for a count of 7 in Russian', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      '12 мая 2026',
      7,
      'https://example.com/unsubscribe?token=abc',
      'ru-RU'
    );

    expect(template.subject).toContain('7 дней');
  });

  it('uses the tomorrow variant for a count of 1 in Russian', async () => {
    const template = await emailTemplates.importantDateLeadReminder(
      'Sarah Chen',
      'Birthday',
      '12 мая 2026',
      1,
      'https://example.com/unsubscribe?token=abc',
      'ru-RU'
    );

    expect(template.subject).toContain('завтра');
    expect(template.subject).not.toContain('1 дней');
    expect(template.subject).not.toContain('1 дня');
  });
});
