import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
  formatGraphName: vi.fn(),
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
    // dispatch.ts reads emailRemindersEnabled through this. An empty result
    // means every user defaults to email-enabled, so behaviour here is
    // unchanged.
    user: { findMany: vi.fn().mockResolvedValue([]) },
    // dispatch.ts also reads configured ntfy endpoints through this. An empty
    // result means no endpoints, so behaviour here is unchanged.
    notificationEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
    cronJobLog: {
      create: mocks.cronJobLogCreate,
      update: mocks.cronJobLogUpdate,
    },
  },
}));

// Mock email. dispatch.ts imports isEmailConfigured from this module, and
// renderEmail may reach for emailTemplates.importantDateLeadReminder or
// emailTemplates.weeklyDigest depending on the fixture, so both are supplied
// here even though this file's fixtures only exercise the important-date and
// contact templates today.
vi.mock('../../lib/email', () => ({
  sendEmailBatch: mocks.sendEmailBatch,
  isEmailConfigured: () => true,
  emailTemplates: {
    importantDateReminder: mocks.importantDateReminderTemplate,
    contactReminder: mocks.contactReminderTemplate,
    importantDateLeadReminder: vi.fn(() => ({
      subject: 'lead reminder',
      html: '<p>lead reminder</p>',
      text: 'lead reminder',
    })),
    weeklyDigest: vi.fn(() => ({
      subject: 'weekly digest',
      html: '<p>weekly digest</p>',
      text: 'weekly digest',
    })),
  },
}));

// Mock unsubscribe-tokens
vi.mock('../../lib/unsubscribe-tokens', () => ({
  createUnsubscribeToken: mocks.createUnsubscribeToken,
}));

// Mock nameUtils
vi.mock('../../lib/nameUtils', () => ({
  formatGraphName: mocks.formatGraphName,
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
// Nametag stores calendar dates as UTC midnight on the day they encode, never
// local midnight. Fixtures have to match, otherwise they stand in for a row
// production never writes and the reminder logic gets exercised against the
// wrong calendar day.
import {
  TIMEZONES,
  setProcessTimezone,
  restoreTimezoneAfterEach,
  storedCalendarDate as asStoredCalendarDate,
  storedYearUnknownDate,
} from '../helpers/timezone';

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
    mocks.formatGraphName.mockReturnValue('John Doe');
  });

  describe('Important date reminders', () => {
    it('should generate unsubscribe token when sending important date reminder', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const importantDate = {
        id: 'date-1',
        title: 'Birthday',
        date: asStoredCalendarDate(today),
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
        date: asStoredCalendarDate(today),
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
        date: asStoredCalendarDate(today),
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
        date: asStoredCalendarDate(today),
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
        date: asStoredCalendarDate(today),
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
          date: asStoredCalendarDate(today),
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
          date: asStoredCalendarDate(today),
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

  /**
   * Year-unknown dates are stored under year 1604, which predates standard time
   * zones, so JavaScript falls back to Local Mean Time and puts almost every
   * zone west of UTC. Reading the stored day with local accessors moved it back
   * a day, which meant birthday reminders went out the day before.
   */
  describe('year-unknown birthdays across timezones', () => {
    restoreTimezoneAfterEach();

    function yearUnknownDateOn(day: Date) {
      return {
        id: 'date-1',
        title: 'Birthday',
        date: storedYearUnknownDate(day),
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: { email: 'john@example.com', dateFormat: 'MDY', language: 'en' },
        },
      };
    }

    async function runCron() {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });
      await GET(
        new Request('http://localhost/api/cron/send-reminders', {
          headers: { authorization: 'Bearer test-cron-secret' },
        })
      );
    }

    it.each(TIMEZONES)('sends on the birthday itself in %s', async (tz) => {
      setProcessTimezone(tz);
      mocks.importantDateFindMany.mockResolvedValue([yearUnknownDateOn(new Date())]);

      await runCron();

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledTimes(1);
    });

    it.each(TIMEZONES)('stays quiet the day before in %s', async (tz) => {
      setProcessTimezone(tz);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      mocks.importantDateFindMany.mockResolvedValue([yearUnknownDateOn(tomorrow)]);

      await runCron();

      expect(mocks.createUnsubscribeToken).not.toHaveBeenCalled();
    });
  });

  /**
   * A February 29 birthday (year 1604 is a leap year, so the sentinel form is
   * valid) has no matching calendar day in non-leap years. The dashboard rolls
   * it to March 1, and the cron must agree instead of skipping the year.
   */
  describe('February 29 birthdays', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function feb29Birthday() {
      return {
        id: 'date-1',
        title: 'Birthday',
        date: new Date(Date.UTC(1604, 1, 29)),
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: { email: 'john@example.com', dateFormat: 'MDY', language: 'en' },
        },
      };
    }

    async function runCronOn(localDate: Date) {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(localDate);
      mocks.importantDateFindMany.mockResolvedValue([feb29Birthday()]);
      mocks.personFindMany.mockResolvedValue([]);
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });
      await GET(
        new Request('http://localhost/api/cron/send-reminders', {
          headers: { authorization: 'Bearer test-cron-secret' },
        })
      );
    }

    it('fires on March 1 in non-leap years, matching the dashboard', async () => {
      await runCronOn(new Date(2026, 2, 1, 9, 0, 0));

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledTimes(1);
    });

    it('stays quiet on February 28 in non-leap years', async () => {
      await runCronOn(new Date(2026, 1, 28, 9, 0, 0));

      expect(mocks.createUnsubscribeToken).not.toHaveBeenCalled();
    });

    it('fires on February 29 in leap years', async () => {
      await runCronOn(new Date(2028, 1, 29, 9, 0, 0));

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledTimes(1);
    });

    it('stays quiet on March 1 in leap years', async () => {
      await runCronOn(new Date(2028, 2, 1, 9, 0, 0));

      expect(mocks.createUnsubscribeToken).not.toHaveBeenCalled();
    });
  });

  /**
   * The date printed inside the email body has to match the stored calendar
   * day too. Reading the stored UTC-midnight value with local accessors put
   * the previous day into the email in the same timezones where the send-day
   * check used to misfire, and year-unknown dates leaked the 1604 sentinel
   * year into the text.
   */
  describe('email body dates across timezones', () => {
    restoreTimezoneAfterEach();

    function importantDateFixture(date: Date, overrides: Record<string, unknown> = {}) {
      return {
        id: 'date-1',
        title: 'Birthday',
        date,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
        lastReminderSent: null,
        person: {
          userId: 'user-1',
          name: 'John',
          surname: 'Doe',
          middleName: null,
          secondLastName: null,
          nickname: null,
          user: { email: 'john@example.com', dateFormat: 'MDY', language: 'en' },
        },
        ...overrides,
      };
    }

    async function runCron() {
      mocks.createUnsubscribeToken.mockResolvedValue('token-abc123');
      mocks.importantDateReminderTemplate.mockResolvedValue({
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        text: 'Reminder',
      });
      mocks.contactReminderTemplate.mockResolvedValue({
        subject: 'Contact Reminder',
        html: '<p>Contact Reminder</p>',
        text: 'Contact Reminder',
      });
      await GET(
        new Request('http://localhost/api/cron/send-reminders', {
          headers: { authorization: 'Bearer test-cron-secret' },
        })
      );
    }

    function contactPersonFixture(lastContactDay: Date) {
      return {
        id: 'person-1',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact: asStoredCalendarDate(lastContactDay),
        contactReminderInterval: 30,
        contactReminderIntervalUnit: 'DAYS',
        lastContactReminderSent: null,
        user: { email: 'jane@example.com', dateFormat: 'MDY', language: 'en' },
      };
    }

    it.each(TIMEZONES)('prints the stored day without the sentinel year in %s', async (tz) => {
      setProcessTimezone(tz);
      const today = new Date();
      const stored = storedYearUnknownDate(today);
      mocks.importantDateFindMany.mockResolvedValue([importantDateFixture(stored)]);
      mocks.personFindMany.mockResolvedValue([]);

      await runCron();

      const expected = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getDate()}`;
      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        'Birthday',
        expected,
        expect.any(String),
        'en'
      );
    });

    it.each(TIMEZONES)('prints known-year dates on the stored day with their year in %s', async (tz) => {
      setProcessTimezone(tz);
      const today = new Date();
      const stored = new Date(Date.UTC(1990, today.getMonth(), today.getDate()));
      mocks.importantDateFindMany.mockResolvedValue([importantDateFixture(stored)]);
      mocks.personFindMany.mockResolvedValue([]);

      await runCron();

      const expected = `${today.toLocaleDateString('en-US', { month: 'long' })} ${today.getDate()}, 1990`;
      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        'Birthday',
        expected,
        expect.any(String),
        'en'
      );
    });

    it.each(TIMEZONES)('prints the recorded last-contact day in %s', async (tz) => {
      setProcessTimezone(tz);
      const lastContactDay = new Date();
      lastContactDay.setMonth(lastContactDay.getMonth() - 4);
      const person = {
        id: 'person-1',
        userId: 'user-1',
        name: 'Jane',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact: asStoredCalendarDate(lastContactDay),
        contactReminderInterval: 3,
        contactReminderIntervalUnit: 'MONTHS',
        lastContactReminderSent: null,
        user: { email: 'jane@example.com', dateFormat: 'MDY', language: 'en' },
      };
      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([person]);

      await runCron();

      const expected = `${lastContactDay.toLocaleDateString('en-US', { month: 'long' })} ${lastContactDay.getDate()}, ${lastContactDay.getFullYear()}`;
      expect(mocks.contactReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        expected,
        expect.any(String),
        expect.any(String),
        'en'
      );
    });

    it('lays out year-unknown dates as day-first for DMY users', async () => {
      setProcessTimezone('Europe/Madrid');
      const today = new Date();
      const stored = storedYearUnknownDate(today);
      const fixture = importantDateFixture(stored);
      fixture.person.user.dateFormat = 'DMY';
      mocks.importantDateFindMany.mockResolvedValue([fixture]);
      mocks.personFindMany.mockResolvedValue([]);

      await runCron();

      const expected = `${today.getDate()} ${today.toLocaleDateString('en-US', { month: 'long' })}`;
      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        'Birthday',
        expected,
        expect.any(String),
        'en'
      );
    });

    it.each(TIMEZONES)('sends the catch-up reminder on the day the interval elapses in %s', async (tz) => {
      setProcessTimezone(tz);
      const lastContactDay = new Date();
      lastContactDay.setDate(lastContactDay.getDate() - 30);
      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([contactPersonFixture(lastContactDay)]);

      await runCron();

      expect(mocks.createUnsubscribeToken).toHaveBeenCalledTimes(1);
    });

    it.each(TIMEZONES)('stays quiet the day before the interval elapses in %s', async (tz) => {
      setProcessTimezone(tz);
      const lastContactDay = new Date();
      lastContactDay.setDate(lastContactDay.getDate() - 29);
      mocks.importantDateFindMany.mockResolvedValue([]);
      mocks.personFindMany.mockResolvedValue([contactPersonFixture(lastContactDay)]);

      await runCron();

      expect(mocks.createUnsubscribeToken).not.toHaveBeenCalled();
    });

    it('localizes the month name for year-unknown dates', async () => {
      setProcessTimezone('Europe/Madrid');
      const today = new Date();
      const stored = storedYearUnknownDate(today);
      const fixture = importantDateFixture(stored);
      fixture.person.user.dateFormat = 'DMY';
      fixture.person.user.language = 'es-ES';
      mocks.importantDateFindMany.mockResolvedValue([fixture]);
      mocks.personFindMany.mockResolvedValue([]);

      await runCron();

      const expected = `${today.getDate()} ${today.toLocaleDateString('es-ES', { month: 'long' })}`;
      expect(mocks.importantDateReminderTemplate).toHaveBeenCalledWith(
        'John Doe',
        expect.any(String),
        expected,
        expect.any(String),
        'es-ES'
      );
    });
  });
});
