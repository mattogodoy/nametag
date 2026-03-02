import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  importantDateFindMany: vi.fn(),
  personFindMany: vi.fn(),
  importantDateUpdate: vi.fn(),
  personUpdate: vi.fn(),
  cronJobLogCreate: vi.fn(),
  cronJobLogUpdate: vi.fn(),
  sendEmailBatch: vi.fn(),
  importantDateReminderTemplate: vi.fn(),
  contactReminderTemplate: vi.fn(),
  createUnsubscribeToken: vi.fn(),
  formatFullName: vi.fn(),
  loggerInfo: vi.fn(),
  securityLoggerAuthFailure: vi.fn(),
}));

// Hoist mockEnv so it's available for vi.mock
const mockEnv = vi.hoisted(() => ({
  CRON_SECRET: 'test-cron-secret',
  NEXT_PUBLIC_APP_URL: 'https://nametag.test',
  NEXTAUTH_URL: 'https://nametag.test',
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    importantDate: {
      findMany: mocks.importantDateFindMany,
      update: mocks.importantDateUpdate,
    },
    person: {
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
    },
    cronJobLog: {
      create: mocks.cronJobLogCreate,
      update: mocks.cronJobLogUpdate,
    },
  },
}));

// Mock email
vi.mock('../../lib/email', () => ({
  sendEmailBatch: mocks.sendEmailBatch,
  emailTemplates: {
    importantDateReminder: mocks.importantDateReminderTemplate,
    contactReminder: mocks.contactReminderTemplate,
  },
}));

// Mock unsubscribe-tokens
vi.mock('../../lib/unsubscribe-tokens', () => ({
  createUnsubscribeToken: mocks.createUnsubscribeToken,
}));

// Mock nameUtils
vi.mock('../../lib/nameUtils', () => ({
  formatFullName: mocks.formatFullName,
}));

// Mock env
vi.mock('../../lib/env', () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
  getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
}));

// Mock logger
vi.mock('../../lib/logger', () => {
  const childLogger = {
    info: mocks.loggerInfo,
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  return {
    logger: {
      info: mocks.loggerInfo,
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => childLogger),
    },
    createModuleLogger: vi.fn(() => childLogger),
    securityLogger: {
      authFailure: mocks.securityLoggerAuthFailure,
      rateLimitExceeded: vi.fn(),
      suspiciousActivity: vi.fn(),
    },
  };
});

// Mock api-utils
vi.mock('../../lib/api-utils', () => ({
  handleApiError: vi.fn((error: Error) => {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }),
  getClientIp: vi.fn(() => '127.0.0.1'),
  withLogging: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// Import after mocking
import { GET } from '../../app/api/cron/send-reminders/route';

describe('Cron Job - Unsubscribe Token Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mocks.cronJobLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronJobLogUpdate.mockResolvedValue({});
    mocks.sendEmailBatch.mockImplementation((items: unknown[]) =>
      Promise.resolve({
        success: true,
        results: (items as unknown[]).map(() => ({ success: true, id: 'test-id' })),
      })
    );
    mocks.formatFullName.mockReturnValue('John Doe');
  });

  describe('Important date reminders', () => {
    it('should generate unsubscribe token when sending important date reminder', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'date-1',
        title: 'Birthday',
        date: new Date(today),
        reminderType: 'ONCE',
        reminderInterval: null,
        reminderIntervalUnit: null,
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: {
            email: 'john@example.com',
            dateFormat: 'MDY',
            language: 'en',
          },
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([importantDate]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledWith({
        userId: 'user-1',
        reminderType: 'IMPORTANT_DATE',
        entityId: 'date-1',
      });
    });

    it('should include unsubscribe URL in email template call', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'date-1',
        title: 'Birthday',
        date: new Date(today),
        reminderType: 'ONCE',
        reminderInterval: null,
        reminderIntervalUnit: null,
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: {
            email: 'john@example.com',
            dateFormat: 'MDY',
            language: 'en',
          },
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([importantDate]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        'Birthday',
        expect.any(String),
        'https://nametag.test/unsubscribe?token=token-abc123',
        'en'
      );
    });

    it('should pass correct reminderType (IMPORTANT_DATE)', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'date-1',
        title: 'Anniversary',
        date: new Date(today),
        reminderType: 'ONCE',
        reminderInterval: null,
        reminderIntervalUnit: null,
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'Jane',
          surname: 'Smith',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: {
            email: 'jane@example.com',
            dateFormat: 'MDY',
            language: 'en',
          },
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([importantDate]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-xyz789');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      const call = mocks.createUnsubscribeToken.mock.calls[0][0];
      expect(call.reminderType).toBe('IMPORTANT_DATE');
    });

    it('should pass correct entityId (importantDate.id)', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'important-date-123',
        title: 'Birthday',
        date: new Date(today),
        reminderType: 'ONCE',
        reminderInterval: null,
        reminderIntervalUnit: null,
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: {
            email: 'john@example.com',
            dateFormat: 'MDY',
            language: 'en',
          },
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([importantDate]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      const call = mocks.createUnsubscribeToken.mock.calls[0][0];
      expect(call.entityId).toBe('important-date-123');
    });

    it('should use user language for localized unsubscribe link', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'date-1',
        title: 'Cumpleaños',
        date: new Date(today),
        reminderType: 'ONCE',
        reminderInterval: null,
        reminderIntervalUnit: null,
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'María',
          surname: 'García',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: {
            email: 'maria@example.com',
            dateFormat: 'DMY',
            language: 'es-ES',
          },
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([importantDate]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Recordatorio',
        html: '<p>Recordatorio</p>',
        text: 'Recordatorio',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'es-ES'
      );
    });
  });

  describe('Contact reminders', () => {
    it('should generate unsubscribe token when sending contact reminder', async () => {
      const today = new Date();
      const lastContact = new Date(today);
      lastContact.setMonth(lastContact.getMonth() - 4); // 4 months ago

      const person = {
        id: 'person-1',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact,
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: {
          email: 'jane@example.com',
          dateFormat: 'MDY',
          language: 'en',
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-contact123');
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Contact Reminder',
        html: '<p>Contact Reminder</p>',
        text: 'Contact Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledWith({
        userId: 'user-1',
        reminderType: 'CONTACT',
        entityId: 'person-1',
      });
    });

    it('should include unsubscribe URL in email template call', async () => {
      const today = new Date();
      const lastContact = new Date(today);
      lastContact.setMonth(lastContact.getMonth() - 4);

      const person = {
        id: 'person-1',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact,
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: {
          email: 'jane@example.com',
          dateFormat: 'MDY',
          language: 'en',
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-contact123');
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Contact Reminder',
        html: '<p>Contact Reminder</p>',
        text: 'Contact Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.contactReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        expect.any(String),
        expect.any(String),
        'https://nametag.test/unsubscribe?token=token-contact123',
        'en'
      );
    });

    it('should pass correct reminderType (CONTACT)', async () => {
      const today = new Date();
      const lastContact = new Date(today);
      lastContact.setMonth(lastContact.getMonth() - 4);

      const person = {
        id: 'person-1',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact,
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: {
          email: 'jane@example.com',
          dateFormat: 'MDY',
          language: 'en',
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-contact123');
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Contact Reminder',
        html: '<p>Contact Reminder</p>',
        text: 'Contact Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      const call = mocks.createUnsubscribeToken.mock.calls[0][0];
      expect(call.reminderType).toBe('CONTACT');
    });

    it('should pass correct entityId (person.id)', async () => {
      const today = new Date();
      const lastContact = new Date(today);
      lastContact.setMonth(lastContact.getMonth() - 4);

      const person = {
        id: 'person-456',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact,
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: {
          email: 'jane@example.com',
          dateFormat: 'MDY',
          language: 'en',
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-contact123');
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Contact Reminder',
        html: '<p>Contact Reminder</p>',
        text: 'Contact Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      const call = mocks.createUnsubscribeToken.mock.calls[0][0];
      expect(call.entityId).toBe('person-456');
    });

    it('should use user language for localized unsubscribe link', async () => {
      const today = new Date();
      const lastContact = new Date(today);
      lastContact.setMonth(lastContact.getMonth() - 4);

      const person = {
        id: 'person-1',
        userId: 'user-1',
        name: 'Carlos',
        surname: 'Rodríguez',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact,
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: {
          email: 'carlos@example.com',
          dateFormat: 'DMY',
          language: 'es-ES',
        },
      };

      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-contact123');
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Recordatorio de Contacto',
        html: '<p>Recordatorio de Contacto</p>',
        text: 'Recordatorio de Contacto',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.contactReminderTemplate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'es-ES'
      );
    });
  });

  describe('Token generation for multiple reminders', () => {
    it('should generate separate tokens for each reminder', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDates = [
        {
          id: 'date-1',
          title: 'Birthday',
          date: new Date(today),
          reminderType: 'ONCE',
          reminderInterval: null,
          reminderIntervalUnit: null,
          lastReminderSent: null,
          person: {
            userId: 'user-1',
            name: 'John',
            surname: 'Doe',
            middleName: null,
            secondLastName: null,
            nickname: null,
            user: {
              email: 'john@example.com',
              dateFormat: 'MDY',
              language: 'en',
            },
          },
        },
        {
          id: 'date-2',
          title: 'Anniversary',
          date: new Date(today),
          reminderType: 'ONCE',
          reminderInterval: null,
          reminderIntervalUnit: null,
          lastReminderSent: null,
          person: {
            userId: 'user-1',
            name: 'Jane',
            surname: 'Smith',
            middleName: null,
            secondLastName: null,
            nickname: null,
            user: {
              email: 'jane@example.com',
              dateFormat: 'MDY',
              language: 'en',
            },
          },
        },
      ];

      mocks.importantDateFindMany.mockResolvedValue(importantDates);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken
        .mockResolvedValueOnce('token-1')
        .mockResolvedValueOnce('token-2');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });

      const request = new Request('http://localhost/api/cron/send-reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });

      await GET(request);

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledTimes(2);
      expect(mocks.createUnsubscribeToken).toHaveBeenNthCalledWith(1, {
        userId: 'user-1',
        reminderType: 'IMPORTANT_DATE',
        entityId: 'date-1',
      });
      expect(mocks.createUnsubscribeToken).toHaveBeenNthCalledWith(2, {
        userId: 'user-1',
        reminderType: 'IMPORTANT_DATE',
        entityId: 'date-2',
      });
    });
  });
});
