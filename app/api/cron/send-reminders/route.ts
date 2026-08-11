import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmailBatch, emailTemplates } from '@/lib/email';
import type { SendBatchEmailItem } from '@/lib/email';
import { formatGraphName } from '@/lib/nameUtils';
import { env, getAppUrl } from '@/lib/env';
import { handleApiError, getClientIp, withLogging } from '@/lib/api-utils';
import { hasValidBearerSecret } from '@/lib/shared-secret';
import { createModuleLogger, securityLogger } from '@/lib/logger';
import { createUnsubscribeToken } from '@/lib/unsubscribe-tokens';
import { getTranslationsForLocale, type SupportedLocale } from '@/lib/i18n-utils';
import { getDateDisplayTitle } from '@/lib/important-date-types';
import {
  shouldSendImportantDateReminder,
  shouldSendContactReminder,
} from '@/lib/reminders/due-dates';

const log = createModuleLogger('cron');

// This endpoint should be called by a cron job
export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    // Verify the cron secret
    if (!hasValidBearerSecret(request, env.CRON_SECRET)) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'send-reminders',
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Log cron job start
    const cronLog = await prisma.cronJobLog.create({
      data: {
        jobName: 'send-reminders',
        status: 'started',
      },
    });
    cronLogId = cronLog.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all important dates with reminders enabled
    const importantDates = await prisma.importantDate.findMany({
      where: {
        reminderEnabled: true,
        deletedAt: null,
        person: {
          deletedAt: null,
        },
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            surname: true,
            middleName: true,
            secondLastName: true,
            nickname: true,
            displayNameOverride: true,
            userId: true,
            user: {
              select: {
                email: true,
                dateFormat: true,
                language: true,
                nameOrder: true,
                nameDisplayFormat: true,
              },
            },
          },
        },
      },
    });

    interface PendingReminder {
      email: SendBatchEmailItem;
      type: 'important_date' | 'contact';
      entityId: string;
      logMeta: Record<string, string>;
    }

    const pendingReminders: PendingReminder[] = [];

    // Collect important date reminders
    for (const importantDate of importantDates) {
      const shouldSend = shouldSendImportantDateReminder(importantDate, today);

      if (shouldSend) {
        const { person } = importantDate;
        const userEmail = person.user.email;
        const userLanguage = (person.user.language as SupportedLocale) || 'en';
        const personName = formatGraphName(person, person.user.nameOrder, person.user.nameDisplayFormat);
        const formattedDate = formatDateForEmail(
          importantDate.date,
          person.user.dateFormat,
          userLanguage
        );

        // Generate unsubscribe token
        const unsubscribeToken = await createUnsubscribeToken({
          userId: person.userId,
          reminderType: 'IMPORTANT_DATE',
          entityId: importantDate.id,
        });

        const unsubscribeUrl = `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`;

        const tDates = await getTranslationsForLocale(userLanguage, 'people.form.importantDates');
        const dateTitle = getDateDisplayTitle(importantDate, tDates);
        const template = await emailTemplates.importantDateReminder(
          personName,
          dateTitle,
          formattedDate,
          unsubscribeUrl,
          userLanguage
        );

        pendingReminders.push({
          email: {
            to: userEmail,
            subject: template.subject,
            html: template.html,
            text: template.text,
            from: 'reminders',
          },
          type: 'important_date',
          entityId: importantDate.id,
          logMeta: { personName, dateTitle, userEmail },
        });
      }
    }

    // Process contact reminders
    const peopleWithContactReminders = await prisma.person.findMany({
      where: {
        contactReminderEnabled: true,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            email: true,
            dateFormat: true,
            language: true,
            nameOrder: true,
            nameDisplayFormat: true,
          },
        },
      },
    });

    // Collect contact reminders
    for (const person of peopleWithContactReminders) {
      const shouldSend = shouldSendContactReminder(person, today);

      if (shouldSend) {
        const userLanguage = (person.user.language as SupportedLocale) || 'en';
        const personName = formatGraphName(person, person.user.nameOrder, person.user.nameDisplayFormat);
        const lastContactFormatted = person.lastContact
          ? formatDateForEmail(person.lastContact, person.user.dateFormat, userLanguage)
          : null;
        const intervalText = formatInterval(
          person.contactReminderInterval || 1,
          person.contactReminderIntervalUnit || 'MONTHS'
        );

        // Generate unsubscribe token
        const unsubscribeToken = await createUnsubscribeToken({
          userId: person.userId,
          reminderType: 'CONTACT',
          entityId: person.id,
        });

        const unsubscribeUrl = `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`;

        const template = await emailTemplates.contactReminder(
          personName,
          lastContactFormatted,
          intervalText,
          unsubscribeUrl,
          userLanguage
        );

        pendingReminders.push({
          email: {
            to: person.user.email,
            subject: template.subject,
            html: template.html,
            text: template.text,
            from: 'reminders',
          },
          type: 'contact',
          entityId: person.id,
          logMeta: { personName, userEmail: person.user.email },
        });
      }
    }

    // Send all reminders as a batch
    let sentCount = 0;
    let errorCount = 0;

    if (pendingReminders.length > 0) {
      const batchResult = await sendEmailBatch(pendingReminders.map(r => r.email));

      for (let i = 0; i < pendingReminders.length; i++) {
        const reminder = pendingReminders[i];
        const result = batchResult.results[i];

        if (result.success) {
          if (reminder.type === 'important_date') {
            await prisma.importantDate.update({
              where: { id: reminder.entityId },
              data: { lastReminderSent: new Date() },
            });
            log.info({ ...reminder.logMeta }, 'Reminder sent');
          } else {
            await prisma.person.update({
              where: { id: reminder.entityId },
              data: { lastContactReminderSent: new Date() },
            });
            log.info({ ...reminder.logMeta }, 'Contact reminder sent');
          }
          sentCount++;
        } else {
          errorCount++;
          log.error({ ...reminder.logMeta, errorMessage: result.error }, `Failed to send ${reminder.type} reminder`);
        }
      }
    }

    log.info({
      sent: sentCount,
      errors: errorCount,
      processedImportantDates: importantDates.length,
      processedContactReminders: peopleWithContactReminders.length,
    }, 'Reminders processed');

    // Log cron job completion
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'completed',
          duration,
          message: `Sent ${sentCount} reminders, ${errorCount} errors`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      processedImportantDates: importantDates.length,
      processedContactReminders: peopleWithContactReminders.length,
    });
  } catch (error) {
    // Log cron job failure
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'failed',
          duration,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
    return handleApiError(error, 'cron-send-reminders');
  }
});

function formatInterval(interval: number, unit: string): string {
  const unitLower = unit.toLowerCase();
  if (interval === 1) {
    // Remove trailing 's' for singular
    return `${interval} ${unitLower.slice(0, -1)}`;
  }
  return `${interval} ${unitLower}`;
}

function formatDateForEmail(
  date: Date,
  dateFormat: string | null,
  locale: string = 'en'
): string {
  const d = new Date(date);
  const localeCode = locale === 'en' ? 'en-US' : locale;
  const month = d.toLocaleDateString(localeCode, { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();

  switch (dateFormat) {
    case 'DMY':
      return `${day} ${month} ${year}`;
    case 'YMD':
      return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'MDY':
    default:
      return `${month} ${day}, ${year}`;
  }
}
