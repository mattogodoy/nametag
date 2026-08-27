import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchAll } from '@/lib/notifications/dispatch';
import type { NotificationEnvelope, StampTarget } from '@/lib/notifications/types';
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
  getIntervalDays,
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

    const envelopes: NotificationEnvelope[] = [];

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

        envelopes.push({
          userId: person.userId,
          userEmail,
          locale: userLanguage,
          notification: {
            kind: 'important_date',
            personId: person.id,
            personName,
            dateTitle,
            formattedDate,
            dateType: importantDate.type,
          },
          unsubscribeUrl,
          deepLink: `${getAppUrl()}/people/${person.id}`,
          stamp: { model: 'importantDate', id: importantDate.id, field: 'lastReminderSent' },
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

        const intervalDays =
          importantDate.reminderType === 'RECURRING'
            ? getIntervalDays(
                importantDate.reminderInterval || 1,
                importantDate.reminderIntervalUnit || 'YEARS'
              )
            : null;

        const leadDue = shouldSendLeadReminder({
          nextOccurrence,
          today,
          leadDays,
          lastLeadReminderSent: importantDate.lastLeadReminderSent,
          intervalDays,
        });

        if (leadDue) {
          const { person } = importantDate;
          const userLanguage = (person.user.language as SupportedLocale) || 'en';
          const personName = formatGraphName(
            person,
            person.user.nameOrder,
            person.user.nameDisplayFormat
          );
          // nextOccurrence is local midnight, and for a recurring date it has
          // been projected into the year it next falls in, so the sentinel that
          // marks an unknown year is only still visible on the stored value.
          const formattedDate = formatCalendarDayForEmail(
            nextOccurrence,
            parseCalendarDate(importantDate.date).getFullYear() <= YEAR_UNKNOWN_SENTINEL,
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

          envelopes.push({
            userId: person.userId,
            userEmail: person.user.email,
            locale: userLanguage,
            notification: {
              kind: 'important_date_lead',
              personId: person.id,
              personName,
              dateTitle,
              formattedDate,
              daysUntil,
            },
            unsubscribeUrl: `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`,
            deepLink: `${getAppUrl()}/people/${person.id}`,
            stamp: { model: 'importantDate', id: importantDate.id, field: 'lastLeadReminderSent' },
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

        envelopes.push({
          userId: person.userId,
          userEmail: person.user.email,
          locale: userLanguage,
          notification: {
            kind: 'contact',
            personId: person.id,
            personName,
            lastContactFormatted,
            intervalText,
          },
          unsubscribeUrl,
          deepLink: `${getAppUrl()}/people/${person.id}`,
          stamp: { model: 'person', id: person.id, field: 'lastContactReminderSent' },
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
    // to reach dispatchAll below. Once we have a list of digest users,
    // each user is handled in its own inner try/catch, so one bad record
    // (a malformed row, one failing getUpcomingEvents/token call) costs
    // exactly that one user's digest, not everyone queued after them. A
    // template rendering failure is not caught here: it surfaces later, per
    // envelope, inside dispatchEmail's Promise.allSettled.
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
              // getUpcomingEvents builds every event.date locally, so this is
              // already a local calendar day rather than a stored UTC one.
              formattedDate: formatCalendarDayForEmail(
                event.date,
                event.isYearUnknown,
                user.dateFormat,
                userLanguage
              ),
              daysUntil: event.daysUntil,
            }));

            const unsubscribeToken = await createUnsubscribeToken({
              userId: user.id,
              reminderType: 'WEEKLY_DIGEST',
              entityId: user.id,
            });

            envelopes.push({
              userId: user.id,
              userEmail: user.email,
              locale: userLanguage,
              notification: {
                kind: 'weekly_digest',
                rows,
                overflowCount,
              },
              unsubscribeUrl: `${getAppUrl()}/unsubscribe?token=${unsubscribeToken}`,
              deepLink: `${getAppUrl()}/dashboard`,
              stamp: { model: 'user', id: user.id, field: 'lastWeeklyDigestSent' },
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
    let skippedCount = 0;
    let digestsSent = 0;

    if (envelopes.length > 0) {
      const results = await dispatchAll(envelopes);

      for (let i = 0; i < envelopes.length; i++) {
        const envelope = envelopes[i];
        const result = results[i];

        if (!result.shouldStamp) {
          // Nothing was delivered on any channel. Stamping here would burn the
          // send for good: the day-of reminder would be marked sent for that
          // occurrence, the digest for that week, and the advance notice for its
          // whole lead window, none of which are recoverable.
          if (result.failed > 0) {
            errorCount++;
            log.error({ ...envelope.logMeta, kind: envelope.notification.kind }, 'Failed to send reminder');
          } else {
            skippedCount++;
          }
          continue;
        }

        try {
          await stampSent(envelope.stamp);
          log.info({ ...envelope.logMeta, kind: envelope.notification.kind }, 'Reminder sent');

          // Inside the try, matching the pre-refactor behaviour: a digest whose
          // stamp write failed was never counted as a digest sent, even though it
          // still counted toward sentCount.
          if (envelope.notification.kind === 'weekly_digest') {
            digestsSent++;
          }
        } catch (stampError) {
          log.error(
            {
              ...envelope.logMeta,
              entityId: envelope.stamp.id,
              kind: envelope.notification.kind,
              errorMessage: stampError instanceof Error ? stampError.message : 'Unknown error',
            },
            'Failed to stamp reminder as sent (it was delivered, may duplicate on next run)'
          );
        }

        sentCount++;

        // A partial success still stamps, so surface the channels that failed.
        if (result.failed > 0) {
          log.warn(
            { ...envelope.logMeta, failedChannels: result.failed },
            'Reminder delivered on some channels but not all'
          );
        }
      }
    }

    log.info({
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
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
          message:
            `Sent ${sentCount} reminders (${digestsSent} digests), ${errorCount} errors` +
            (skippedCount > 0 ? `, ${skippedCount} skipped (email not configured)` : ''),
        },
      });
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
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

/**
 * Record that a notification was delivered.
 *
 * StampTarget is a discriminated union, so each branch narrows to a concrete
 * Prisma column and no cast is needed to satisfy the generated input types.
 */
async function stampSent(stamp: StampTarget): Promise<void> {
  const now = new Date();

  switch (stamp.model) {
    case 'importantDate': {
      const importantDateId = stamp.id;
      const field = stamp.field;

      switch (field) {
        case 'lastReminderSent':
          await prisma.importantDate.update({
            where: { id: importantDateId },
            data: { lastReminderSent: now },
          });
          return;
        case 'lastLeadReminderSent':
          await prisma.importantDate.update({
            where: { id: importantDateId },
            data: { lastLeadReminderSent: now },
          });
          return;
        default: {
          const unhandled: never = field;
          throw new Error(`Unhandled importantDate stamp field: ${JSON.stringify(unhandled)}`);
        }
      }
    }

    case 'person':
      await prisma.person.update({
        where: { id: stamp.id },
        data: { lastContactReminderSent: now },
      });
      return;

    case 'user':
      await prisma.user.update({
        where: { id: stamp.id },
        data: { lastWeeklyDigestSent: now },
      });
      return;

    default: {
      const unhandled: never = stamp;
      throw new Error(`Unhandled stamp target: ${JSON.stringify(unhandled)}`);
    }
  }
}

function formatInterval(interval: number, unit: string): string {
  const unitLower = unit.toLowerCase();
  if (interval === 1) {
    // Remove trailing 's' for singular
    return `${interval} ${unitLower.slice(0, -1)}`;
  }
  return `${interval} ${unitLower}`;
}

/**
 * Render a calendar day that is already anchored to local midnight.
 *
 * Kept separate from formatDateForEmail because the two take different kinds of
 * Date. Occurrences computed at runtime (a projected anniversary, a digest row)
 * are built with local accessors, so passing them through parseCalendarDate
 * would apply the UTC-to-local correction a second time and report the previous
 * day east of UTC.
 *
 * `yearUnknown` has to be supplied rather than inferred: projecting an
 * occurrence into the current year overwrites the sentinel that marks a date
 * whose year the user never entered.
 */
function formatCalendarDayForEmail(
  d: Date,
  yearUnknown: boolean,
  dateFormat: string | null,
  locale: string = 'en'
): string {
  const localeCode = locale === 'en' ? 'en-US' : locale;
  const month = d.toLocaleDateString(localeCode, { month: 'long' });
  const day = d.getDate();
  const year = d.getFullYear();

  if (yearUnknown) {
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

/** Render a value straight out of the database, which is UTC midnight. */
function formatDateForEmail(
  date: Date,
  dateFormat: string | null,
  locale: string = 'en'
): string {
  // Stored values are UTC midnight on the calendar day they encode; reading
  // them with local accessors would report the previous day west of UTC.
  const d = parseCalendarDate(date);
  return formatCalendarDayForEmail(
    d,
    d.getFullYear() <= YEAR_UNKNOWN_SENTINEL,
    dateFormat,
    locale
  );
}
