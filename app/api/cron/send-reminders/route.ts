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
import { parseCalendarDate, YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';
import { getTranslationsForLocale, type SupportedLocale } from '@/lib/i18n-utils';
import { getDateDisplayTitle } from '@/lib/important-date-types';
import {
  shouldSendImportantDateReminder,
  shouldSendContactReminder,
  shouldSendLeadReminder,
} from '@/lib/reminders/due-dates';
import { resolveLeadDays } from '@/lib/reminders/lead-days';
import { getNextOccurrence, getDaysUntil, getUpcomingEvents } from '@/lib/upcoming-events';
import { isDigestDueToday, selectDigestEvents } from '@/lib/reminders/digest';
import { isSaasMode } from '@/lib/features';

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
                defaultReminderLeadDays: true,
              },
            },
          },
        },
      },
    });

    interface PendingReminder {
      email: SendBatchEmailItem;
      type: 'important_date' | 'important_date_lead' | 'contact' | 'weekly_digest';
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

      const leadDays = resolveLeadDays(
        importantDate.reminderLeadDays,
        importantDate.person.user.defaultReminderLeadDays
      );

      if (leadDays > 0) {
        const nextOccurrence =
          importantDate.reminderType === 'ONCE'
            ? parseCalendarDate(importantDate.date)
            : getNextOccurrence(
                parseCalendarDate(importantDate.date),
                today,
                importantDate.reminderInterval || 1,
                importantDate.reminderIntervalUnit || 'YEARS',
                importantDate.lastReminderSent
              );

        // Guard against promising an email the day-of path will never send.
        // getNextOccurrence() and shouldSendImportantDateReminder() answer
        // "when does this recur" independently and can disagree (multi-year
        // intervals, a recurring date stored in the future, Feb 29 rolling to
        // Mar 1 in a non-leap year). Simulating the day-of predicate with
        // `today` set to the computed occurrence tells us whether the day-of
        // email would actually fire then. Real `lastReminderSent` is passed
        // through unchanged: that is the reminder history the day-of path
        // would see when it eventually reaches that date.
        const dayOfWouldFireOnOccurrence = shouldSendImportantDateReminder(
          {
            date: importantDate.date,
            reminderType: importantDate.reminderType,
            reminderInterval: importantDate.reminderInterval,
            reminderIntervalUnit: importantDate.reminderIntervalUnit,
            lastReminderSent: importantDate.lastReminderSent,
          },
          nextOccurrence
        );

        const leadDue =
          dayOfWouldFireOnOccurrence &&
          shouldSendLeadReminder({
            nextOccurrence,
            today,
            leadDays,
            lastLeadReminderSent: importantDate.lastLeadReminderSent,
          });

        if (leadDue) {
          const { person } = importantDate;
          const userLanguage = (person.user.language as SupportedLocale) || 'en';
          const personName = formatGraphName(
            person,
            person.user.nameOrder,
            person.user.nameDisplayFormat
          );
          const formattedDate = formatDateForEmail(
            nextOccurrence,
            person.user.dateFormat,
            userLanguage
          );
          const daysUntil = getDaysUntil(nextOccurrence, today);

          const unsubscribeToken = await createUnsubscribeToken({
            userId: person.userId,
            reminderType: 'IMPORTANT_DATE',
            entityId: importantDate.id,
          });

          const tDates = await getTranslationsForLocale(
            userLanguage,
            'people.form.importantDates'
          );
          const dateTitle = getDateDisplayTitle(importantDate, tDates);
          const template = await emailTemplates.importantDateLeadReminder(
            personName,
            dateTitle,
            formattedDate,
            daysUntil,
            `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`,
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
            type: 'important_date_lead',
            entityId: importantDate.id,
            logMeta: { personName, dateTitle, daysUntil: String(daysUntil) },
          });
        }
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

    // Weekly digest pass. Runs inside the same daily job so self-hosters do
    // not need to add a cron line. The weekday is per-user; the hour is
    // whatever the instance's cron is scheduled for.
    //
    // The outer try/catch here only guards genuine setup failure (mainly the
    // candidate query itself): a problem here must not take down the
    // day-of, lead, and contact reminders collected above, which still need
    // to reach sendEmailBatch below. Once we have a list of digest users,
    // each user is handled in its own inner try/catch, so one bad record
    // (a malformed row, one failing getUpcomingEvents/token/template call)
    // costs exactly that one user's digest, not everyone queued after them.
    try {
      const digestCandidates = await prisma.user.findMany({
        where: { weeklyDigestEnabled: true },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          language: true,
          dateFormat: true,
          weeklyDigestEnabled: true,
          weeklyDigestWeekday: true,
          lastWeeklyDigestSent: true,
        },
      });

      const digestUsers = digestCandidates.filter(
        (user) =>
          isDigestDueToday(user, today) &&
          (!isSaasMode() || user.emailVerified)
      );

      const DIGEST_BATCH_SIZE = 50;

      for (let i = 0; i < digestUsers.length; i += DIGEST_BATCH_SIZE) {
        const batch = digestUsers.slice(i, i + DIGEST_BATCH_SIZE);

        for (const user of batch) {
          try {
            const upcoming = await getUpcomingEvents(user.id);
            const { events, overflowCount } = selectDigestEvents(upcoming);

            // A quiet week sends nothing. An email that says "no events" every
            // week trains people to ignore the ones that matter.
            if (events.length === 0) continue;

            const userLanguage = (user.language as SupportedLocale) || 'en';
            const tEvents = await getTranslationsForLocale(userLanguage, 'dashboard');

            const rows = events.map((event) => ({
              personName: event.personName,
              eventTitle: event.title ?? tEvents(event.titleKey ?? 'timeToCatchUp'),
              formattedDate: formatDateForEmail(event.date, user.dateFormat, userLanguage),
              daysUntil: event.daysUntil,
            }));

            const unsubscribeToken = await createUnsubscribeToken({
              userId: user.id,
              reminderType: 'WEEKLY_DIGEST',
              entityId: user.id,
            });

            const template = await emailTemplates.weeklyDigest(
              rows,
              overflowCount,
              `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`,
              userLanguage
            );

            pendingReminders.push({
              email: {
                to: user.email,
                subject: template.subject,
                html: template.html,
                text: template.text,
                from: 'reminders',
              },
              type: 'weekly_digest',
              entityId: user.id,
              logMeta: { userEmail: user.email, eventCount: String(rows.length) },
            });
          } catch (userDigestError) {
            log.error(
              {
                userId: user.id,
                errorMessage:
                  userDigestError instanceof Error ? userDigestError.message : 'Unknown error',
              },
              'Weekly digest failed for user, skipping'
            );
            continue;
          }
        }

        if (i + DIGEST_BATCH_SIZE < digestUsers.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (digestError) {
      log.error(
        { errorMessage: digestError instanceof Error ? digestError.message : 'Unknown error' },
        'Weekly digest pass failed'
      );
    }

    // Send all reminders as a batch
    let sentCount = 0;
    let errorCount = 0;
    let digestsSent = 0;

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
          } else if (reminder.type === 'important_date_lead') {
            await prisma.importantDate.update({
              where: { id: reminder.entityId },
              data: { lastLeadReminderSent: new Date() },
            });
            log.info({ ...reminder.logMeta }, 'Lead reminder sent');
          } else if (reminder.type === 'weekly_digest') {
            await prisma.user.update({
              where: { id: reminder.entityId },
              data: { lastWeeklyDigestSent: new Date() },
            });
            log.info({ ...reminder.logMeta }, 'Weekly digest sent');
            digestsSent++;
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
      digestsSent,
    }, 'Reminders processed');

    // Log cron job completion
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'completed',
          duration,
          message: `Sent ${sentCount} reminders (${digestsSent} digests), ${errorCount} errors`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      processedImportantDates: importantDates.length,
      processedContactReminders: peopleWithContactReminders.length,
      digestsSent,
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
  // Stored values are UTC midnight on the calendar day they encode; reading
  // them with local accessors would report the previous day west of UTC.
  const d = parseCalendarDate(date);
  const localeCode = locale === 'en' ? 'en-US' : locale;
  const month = d.toLocaleDateString(localeCode, { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();

  // Year-unknown dates carry the sentinel year; show only month and day.
  if (year <= YEAR_UNKNOWN_SENTINEL) {
    switch (dateFormat) {
      case 'DMY':
        return `${day} ${month}`;
      case 'MDY':
      case 'YMD':
      default:
        return `${month} ${day}`;
    }
  }

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
