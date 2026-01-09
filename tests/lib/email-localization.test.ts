import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailTemplates } from '@/lib/email';

describe('Email Localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Account Verification Email', () => {
    it('should generate English verification email', async () => {
      const url = 'https://example.com/verify?token=abc123';
      const { subject, html, text } = await emailTemplates.accountVerification(url, 'en');

      expect(subject.toLowerCase()).toContain('verify');
      expect(subject).toContain('Nametag');
      expect(html.toLowerCase()).toContain('verify');
      expect(html).toContain(url);
      expect(text.toLowerCase()).toContain('verify');
      expect(text).toContain(url);
    });

    it('should generate Spanish verification email', async () => {
      const url = 'https://example.com/verify?token=abc123';
      const { subject, html, text } = await emailTemplates.accountVerification(url, 'es-ES');

      expect(subject.toLowerCase()).toContain('verifica');
      expect(subject).toContain('Nametag');
      expect(html.toLowerCase()).toContain('verifica');
      expect(html).toContain(url);
      expect(text.toLowerCase()).toContain('verifica');
      expect(text).toContain(url);
    });
  });

  describe('Password Reset Email', () => {
    it('should generate English password reset email', async () => {
      const url = 'https://example.com/reset?token=abc123';
      const { subject, html, text } = await emailTemplates.passwordReset(url, 'en');

      expect(subject).toContain('Reset');
      expect(subject).toContain('password');
      expect(html).toContain('Reset');
      expect(html).toContain(url);
      expect(text).toContain(url);
    });

    it('should generate Spanish password reset email', async () => {
      const url = 'https://example.com/reset?token=abc123';
      const { subject, html, text } = await emailTemplates.passwordReset(url, 'es-ES');

      expect(subject).toContain('Restablece');
      expect(subject).toContain('contraseña');
      expect(html).toContain('Restablece');
      expect(html).toContain(url);
      expect(text).toContain(url);
    });
  });

  describe('Important Date Reminder Email', () => {
    it('should generate English important date reminder', async () => {
      const { subject, html, text } = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'en'
      );

      expect(subject).toContain('Reminder');
      expect(subject).toContain('John Doe');
      expect(html).toContain('John Doe');
      expect(html).toContain('Birthday');
      expect(html).toContain('January 15, 2024');
      expect(text).toContain('John Doe');
    });

    it('should generate Spanish important date reminder', async () => {
      const { subject, html, text } = await emailTemplates.importantDateReminder(
        'John Doe',
        'Cumpleaños',
        '15 de enero de 2024',
        'es-ES'
      );

      expect(subject).toContain('Recordatorio');
      expect(subject).toContain('John Doe');
      expect(html).toContain('John Doe');
      expect(html).toContain('Cumpleaños');
      expect(html).toContain('15 de enero de 2024');
      expect(text).toContain('John Doe');
    });
  });

  describe('Contact Reminder Email', () => {
    it('should generate English contact reminder', async () => {
      const { subject, html, text } = await emailTemplates.contactReminder(
        'Jane Smith',
        'December 1, 2023',
        '2 months',
        'en'
      );

      expect(subject.toLowerCase()).toContain('time to');
      expect(subject).toContain('Jane Smith');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('December 1, 2023');
      expect(html).toContain('2 months');
      expect(text).toContain('Jane Smith');
    });

    it('should generate Spanish contact reminder', async () => {
      const { subject, html, text } = await emailTemplates.contactReminder(
        'Jane Smith',
        '1 de diciembre de 2023',
        '2 meses',
        'es-ES'
      );

      expect(subject.toLowerCase()).toContain('hora de');
      expect(subject).toContain('Jane Smith');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('1 de diciembre de 2023');
      expect(html).toContain('2 meses');
      expect(text).toContain('Jane Smith');
    });
  });

  describe('Subscription Created Email', () => {
    it('should generate English subscription created email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionCreated(
        'Pro',
        '$9.99',
        'billed monthly',
        'en'
      );

      expect(subject.toLowerCase()).toContain('welcome');
      expect(html).toContain('Pro');
      expect(html).toContain('$9.99');
      expect(html).toContain('billed monthly');
      expect(text).toContain('Pro');
    });

    it('should generate Spanish subscription created email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionCreated(
        'Pro',
        '$9.99',
        'facturado mensualmente',
        'es-ES'
      );

      expect(subject.toLowerCase()).toContain('bienvenido');
      expect(html).toContain('Pro');
      expect(html).toContain('$9.99');
      expect(text).toContain('Pro');
    });
  });

  describe('Subscription Changed Email', () => {
    it('should generate English upgrade email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionChanged(
        'Personal',
        'Pro',
        '$9.99',
        'billed monthly',
        true,
        'en'
      );

      expect(subject).toContain('upgraded');
      expect(html).toContain('Personal');
      expect(html).toContain('Pro');
      expect(html).toContain('$9.99');
      expect(text).toContain('Pro');
    });

    it('should generate Spanish upgrade email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionChanged(
        'Personal',
        'Pro',
        '$9.99',
        'facturado mensualmente',
        true,
        'es-ES'
      );

      expect(
        subject.toLowerCase().includes('suscripción') || subject.toLowerCase().includes('mejorado')
      ).toBe(true);
      expect(html).toContain('Personal');
      expect(html).toContain('Pro');
      expect(html).toContain('$9.99');
      expect(text).toContain('Pro');
    });

    it('should generate English downgrade email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionChanged(
        'Pro',
        'Personal',
        '$4.99',
        'billed monthly',
        false,
        'en'
      );

      expect(subject).toContain('changed');
      expect(html).toContain('Pro');
      expect(html).toContain('Personal');
      expect(text).toContain('Personal');
    });
  });

  describe('Subscription Canceled Email', () => {
    it('should generate English cancellation email with access date', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionCanceled(
        'Pro',
        'January 31, 2024',
        false,
        'en'
      );

      expect(subject.toLowerCase()).toContain('cancel');
      expect(html).toContain('Pro');
      expect(html).toContain('January 31, 2024');
      expect(text).toContain('Pro');
    });

    it('should generate Spanish cancellation email', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionCanceled(
        'Pro',
        '31 de enero de 2024',
        false,
        'es-ES'
      );

      expect(subject.toLowerCase()).toContain('cancel');
      expect(html).toContain('Pro');
      expect(html).toContain('31 de enero de 2024');
      expect(text).toContain('Pro');
    });

    it('should handle immediate cancellation', async () => {
      const { subject, html, text } = await emailTemplates.subscriptionCanceled(
        'Pro',
        null,
        true,
        'en'
      );

      expect(subject.toLowerCase()).toContain('cancel');
      expect(html).toContain('Pro');
      expect(html.toLowerCase()).toContain('downgraded');
      expect(text).toContain('Pro');
    });
  });

});

