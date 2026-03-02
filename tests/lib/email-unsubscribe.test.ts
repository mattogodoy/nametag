import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the env module before importing email
const mockEnv = {
  RESEND_API_KEY: 'test-resend-api-key',
  EMAIL_DOMAIN: 'test.example.com',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: undefined,
};

vi.mock('../../lib/env', () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
  getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
}));

// Mock Resend properly as a class
const mockSend = vi.fn();
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
      batch = {
        send: vi.fn(),
      };
    },
  };
});

describe('Email Templates - Unsubscribe Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
  });

  describe('importantDateReminder template', () => {
    it('should include unsubscribe link in HTML', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      expect(template.html).toContain('https://nametag.one/unsubscribe?token=abc123');
      expect(template.html).toContain('Disable this reminder');
    });

    it('should include unsubscribe link in plain text', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      expect(template.text).toContain('https://nametag.one/unsubscribe?token=abc123');
      expect(template.text).toContain('Disable this reminder');
    });

    it('should use correct locale for unsubscribe text (EN)', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      expect(template.html).toContain('Disable this reminder');
      expect(template.text).toContain('Disable this reminder');
    });

    it('should use correct locale for unsubscribe text (ES)', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'Juan Pérez',
        'Cumpleaños',
        '15 de enero de 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'es-ES'
      );

      expect(template.html).toContain('Desactivar este recordatorio');
      expect(template.text).toContain('Desactivar este recordatorio');
    });

    it('should escape HTML in unsubscribe URL', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc<script>alert("xss")</script>',
        'en'
      );

      // Should escape the script tags
      expect(template.html).not.toContain('<script>');
      expect(template.html).toContain('&lt;script&gt;');
    });

    it('should include unsubscribe footer in correct position', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      // Unsubscribe should appear after the main content
      const htmlContent = template.html;
      const dashboardButtonIndex = htmlContent.indexOf('Open Nametag');
      const unsubscribeIndex = htmlContent.indexOf('Disable this reminder');

      expect(unsubscribeIndex).toBeGreaterThan(dashboardButtonIndex);
    });
  });

  describe('contactReminder template', () => {
    it('should include unsubscribe link in HTML', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        'December 1, 2024',
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz789',
        'en'
      );

      expect(template.html).toContain('https://nametag.one/unsubscribe?token=xyz789');
      expect(template.html).toContain('Disable this reminder');
    });

    it('should include unsubscribe link in plain text', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        'December 1, 2024',
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz789',
        'en'
      );

      expect(template.text).toContain('https://nametag.one/unsubscribe?token=xyz789');
      expect(template.text).toContain('Disable this reminder');
    });

    it('should use correct locale for unsubscribe text (EN)', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        null,
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz789',
        'en'
      );

      expect(template.html).toContain('Disable this reminder');
      expect(template.text).toContain('Disable this reminder');
    });

    it('should use correct locale for unsubscribe text (ES)', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'María García',
        '1 de diciembre de 2024',
        '3 meses',
        'https://nametag.one/unsubscribe?token=xyz789',
        'es-ES'
      );

      expect(template.html).toContain('Desactivar este recordatorio');
      expect(template.text).toContain('Desactivar este recordatorio');
    });

    it('should escape HTML in unsubscribe URL', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        null,
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz<img src=x onerror=alert(1)>',
        'en'
      );

      // Should escape the HTML injection (check that the tag is escaped, preventing execution)
      expect(template.html).not.toContain('src=x onerror=alert(1)>');  // Tag not closed, so can't execute
      expect(template.html).toContain('&lt;img');  // Opening tag is escaped
      expect(template.html).toContain('&gt;');  // Closing tag is escaped
    });

    it('should include unsubscribe footer in correct position', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        'December 1, 2024',
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz789',
        'en'
      );

      // Unsubscribe should appear after the main content
      const htmlContent = template.html;
      const dashboardButtonIndex = htmlContent.indexOf('Open Nametag');
      const unsubscribeIndex = htmlContent.indexOf('Disable this reminder');

      expect(unsubscribeIndex).toBeGreaterThan(dashboardButtonIndex);
    });

    it('should handle null lastContactDate with unsubscribe link', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.contactReminder(
        'Jane Smith',
        null,
        '3 months',
        'https://nametag.one/unsubscribe?token=xyz789',
        'en'
      );

      expect(template.html).toContain('https://nametag.one/unsubscribe?token=xyz789');
      expect(template.html).toContain('Disable this reminder');
    });
  });

  describe('Unsubscribe footer styling', () => {
    it('should render unsubscribe footer with correct styling', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      // Check for table structure
      expect(template.html).toContain('<table role="presentation"');
      // Check for border-top styling (separator)
      expect(template.html).toMatch(/border-top.*1px solid/);
      // Check for text-decoration: underline
      expect(template.html).toMatch(/text-decoration:\s*underline/);
    });

    it('should include provided URL in footer', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const customUrl = 'https://custom.domain/unsubscribe?token=custom123';
      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        customUrl,
        'en'
      );

      expect(template.html).toContain(customUrl);
    });

    it('should use translation key for text', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const templateEN = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      const templateES = await emailTemplates.importantDateReminder(
        'Juan Pérez',
        'Cumpleaños',
        '15 de enero de 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'es-ES'
      );

      // English should have English text
      expect(templateEN.html).toContain('Disable this reminder');
      expect(templateEN.html).not.toContain('Desactivar');

      // Spanish should have Spanish text
      expect(templateES.html).toContain('Desactivar este recordatorio');
      expect(templateES.html).not.toContain('Disable this reminder');
    });
  });

  describe('Email structure integrity', () => {
    it('should maintain email template structure with unsubscribe link', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      // Should still have the main heading
      expect(template.html).toContain('Upcoming Event Reminder');
      // Should still have the main content
      expect(template.html).toContain("John Doe");
      expect(template.html).toContain('Birthday');
      // Should still have the button
      expect(template.html).toContain('Open Nametag');
      // And now also the unsubscribe link
      expect(template.html).toContain('Disable this reminder');
    });

    it('should maintain subject line unchanged', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      expect(template.subject).toBe("Reminder: John Doe's Birthday is coming up");
    });

    it('should include DOCTYPE and proper HTML structure', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        'https://nametag.one/unsubscribe?token=abc123',
        'en'
      );

      expect(template.html).toContain('<!DOCTYPE html>');
      expect(template.html).toContain('<html');
      expect(template.html).toContain('</html>');
    });
  });

  describe('XSS Protection', () => {
    it('should escape special characters in unsubscribe URL', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const maliciousUrl = 'https://nametag.one/unsubscribe?token="><script>alert("XSS")</script>';
      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        maliciousUrl,
        'en'
      );

      // Should not contain unescaped script tags
      expect(template.html).not.toContain('<script>');
      // Should contain escaped versions
      expect(template.html).toContain('&lt;script&gt;');
    });

    it('should handle URLs with ampersands correctly', async () => {
      const { emailTemplates } = await import('../../lib/email');

      const urlWithAmpersands = 'https://nametag.one/unsubscribe?token=abc&user=123&confirm=true';
      const template = await emailTemplates.importantDateReminder(
        'John Doe',
        'Birthday',
        'January 15, 2024',
        urlWithAmpersands,
        'en'
      );

      // URL should be properly escaped in HTML
      expect(template.html).toContain('&amp;');
    });
  });
});
