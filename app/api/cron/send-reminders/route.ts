import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { formatFullName } from '@/lib/nameUtils';
import { env, getAppUrl } from '@/lib/env';
import { handleApiError } from '@/lib/api-utils';
import { logger, securityLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/api-utils';
import { createUnsubscribeToken } from '@/lib/unsubscribe-tokens';
import { parseAsLocalDate } from '@/lib/date-format';

// This endpoint should be called by a cron job
export async function GET(request: Request) {
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    // Verify the cron secret
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
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
      },
      include: {
        person: {
          include: {
            user: {
              select: {
                email: true,
                dateFormat: true,
                language: true,
              },
            },
          },
        },
      },
    });

    let sentCount = 0;
    let errorCount = 0;

    // Process important date reminders
    for (const importantDate of importantDates) {
      const shouldSend = await shouldSendImportantDateReminder(importantDate, today);

      if (shouldSend) {
        const { person } = importantDate;
        const userEmail = person.user.email;
        const userLanguage = (person.user.language as 'en' | 'es-ES') || 'en';
        const personName = formatFullName(person);
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

        const template = await emailTemplates.importantDateReminder(
          personName,
          importantDate.title,
          formattedDate,
          unsubscribeUrl,
          userLanguage
        );

        const result = await sendEmail({
          to: userEmail,
          subject: template.subject,
          html: template.html,
          text: template.text,
          from: 'reminders',
        });

        if (result.success) {
          // Update lastReminderSent
          await prisma.importantDate.update({
            where: { id: importantDate.id },
            data: { lastReminderSent: new Date() },
          });
          sentCount++;
          console.log(
            `Sent reminder for ${personName}'s ${importantDate.title} to ${userEmail}`
          );
        } else {
          errorCount++;
          console.error(
            `Failed to send reminder for ${personName}'s ${importantDate.title}: ${result.error}`
          );
        }
      }
    }

    // Process contact reminders
    const peopleWithContactReminders = await prisma.person.findMany({
      where: {
        contactReminderEnabled: true,
      },
      include: {
        user: {
          select: {
            email: true,
            dateFormat: true,
            language: true,
          },
        },
      },
    });

    for (const person of peopleWithContactReminders) {
      const shouldSend = shouldSendContactReminder(person, today);

      if (shouldSend) {
        const userLanguage = (person.user.language as 'en' | 'es-ES') || 'en';
        const personName = formatFullName(person);
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

        const result = await sendEmail({
          to: person.user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          from: 'reminders',
        });

        if (result.success) {
          // Update lastContactReminderSent
          await prisma.person.update({
            where: { id: person.id },
            data: { lastContactReminderSent: new Date() },
          });
          sentCount++;
          console.log(
            `Sent contact reminder for ${personName} to ${person.user.email}`
          );
        } else {
          errorCount++;
          console.error(
            `Failed to send contact reminder for ${personName}: ${result.error}`
          );
        }
      }
    }

    logger.info('Reminders processed', {
      sent: sentCount,
      errors: errorCount,
      processedImportantDates: importantDates.length,
      processedContactReminders: peopleWithContactReminders.length,
    });

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
}

async function shouldSendImportantDateReminder(
  importantDate: {
    date: Date;
    reminderType: string | null;
    reminderInterval: number | null;
    reminderIntervalUnit: string | null;
    lastReminderSent: Date | null;
  },
  today: Date
): Promise<boolean> {
  const eventDate = parseAsLocalDate(importantDate.date);

  if (importantDate.reminderType === 'ONCE') {
    // For one-time reminders, send on the exact date if not already sent
    const eventDay = new Date(eventDate);
    eventDay.setHours(0, 0, 0, 0);

    if (eventDay.getTime() !== today.getTime()) {
      return false;
    }

    // Check if already sent today
    if (importantDate.lastReminderSent) {
      const lastSent = new Date(importantDate.lastReminderSent);
      lastSent.setHours(0, 0, 0, 0);
      if (lastSent.getTime() === today.getTime()) {
        return false;
      }
    }

    return true;
  }

  if (importantDate.reminderType === 'RECURRING') {
    // For recurring reminders, check based on the interval from the event date
    const interval = importantDate.reminderInterval || 1;
    const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';

    // Normalize the event date
    const eventDateNormalized = new Date(eventDate);
    eventDateNormalized.setHours(0, 0, 0, 0);

    // Don't send reminders before the event date
    if (today.getTime() < eventDateNormalized.getTime()) {
      return false;
    }

    // Special handling for YEARS to avoid leap year drift
    if (intervalUnit === 'YEARS') {
      const eventDay = eventDateNormalized.getDate();
      const eventMonth = eventDateNormalized.getMonth();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth();

      // Check if today is the anniversary (same month and day)
      if (todayDay !== eventDay || todayMonth !== eventMonth) {
        return false;
      }

      // If we've sent before, check if enough years have passed
      if (importantDate.lastReminderSent) {
        const lastSent = new Date(importantDate.lastReminderSent);
        const lastSentYear = lastSent.getFullYear();
        const todayYear = today.getFullYear();
        const yearsSinceLastSent = todayYear - lastSentYear;

        return yearsSinceLastSent >= interval;
      }

      // Never sent before - it's the anniversary, so send
      return true;
    }

    // For other intervals (DAYS, WEEKS, MONTHS), use millisecond calculations
    const intervalMs = getIntervalMs(interval, intervalUnit);

    // If we've sent before, check if enough time has passed
    if (importantDate.lastReminderSent) {
      const lastSent = new Date(importantDate.lastReminderSent);
      lastSent.setHours(0, 0, 0, 0);

      const timeSinceLastSent = today.getTime() - lastSent.getTime();

      // Not enough time has passed since last reminder
      if (timeSinceLastSent < intervalMs) {
        return false;
      }

      // Calculate the next scheduled reminder date from last sent
      const intervalsPassed = Math.floor(timeSinceLastSent / intervalMs);
      const nextReminderDate = new Date(lastSent.getTime() + (intervalsPassed * intervalMs));
      nextReminderDate.setHours(0, 0, 0, 0);

      return nextReminderDate.getTime() === today.getTime();
    }

    // Never sent before - check if we should send based on event date
    const timeSinceEvent = today.getTime() - eventDateNormalized.getTime();

    // Calculate which occurrence this is
    const intervalsPassed = Math.floor(timeSinceEvent / intervalMs);
    const nextReminderDate = new Date(eventDateNormalized.getTime() + (intervalsPassed * intervalMs));
    nextReminderDate.setHours(0, 0, 0, 0);

    return nextReminderDate.getTime() === today.getTime();
  }

  return false;
}

function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (unit) {
    case 'DAYS':
      return interval * msPerDay;
    case 'WEEKS':
      return interval * 7 * msPerDay;
    case 'MONTHS':
      return interval * 30 * msPerDay; // Approximate
    case 'YEARS':
      return interval * 365 * msPerDay; // Approximate
    default:
      return 365 * msPerDay;
  }
}

function shouldSendContactReminder(
  person: {
    lastContact: Date | null;
    contactReminderInterval: number | null;
    contactReminderIntervalUnit: string | null;
    lastContactReminderSent: Date | null;
  },
  today: Date
): boolean {
  const interval = person.contactReminderInterval || 1;
  const unit = person.contactReminderIntervalUnit || 'MONTHS';
  const intervalMs = getIntervalMs(interval, unit);

  // Calculate when the reminder should be sent
  // If no lastContact, use lastContactReminderSent or send immediately
  const referenceDate = person.lastContact || person.lastContactReminderSent;

  if (!referenceDate) {
    // No reference date - don't send (need at least one contact first)
    return false;
  }

  const timeSinceReference = today.getTime() - new Date(referenceDate).getTime();

  // Check if enough time has passed since last contact
  if (timeSinceReference < intervalMs) {
    return false;
  }

  // Check if we've already sent a reminder recently
  if (person.lastContactReminderSent) {
    const timeSinceLastReminder =
      today.getTime() - new Date(person.lastContactReminderSent).getTime();

    // Don't send if we sent a reminder within the interval period
    if (timeSinceLastReminder < intervalMs * 0.9) {
      return false;
    }
  }

  return true;
}

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
  locale: 'en' | 'es-ES' = 'en'
): string {
  const d = new Date(date);
  const localeCode = locale === 'es-ES' ? 'es-ES' : 'en-US';
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
