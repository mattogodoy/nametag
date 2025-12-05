import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { formatFullName } from '@/lib/nameUtils';

// This endpoint should be called by a cron job
// Protect it with a secret key
export async function GET(request: Request) {
  try {
    // Verify the cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
              },
            },
          },
        },
      },
    });

    let sentCount = 0;
    let errorCount = 0;

    for (const importantDate of importantDates) {
      const shouldSend = await shouldSendReminder(importantDate, today);

      if (shouldSend) {
        const { person } = importantDate;
        const userEmail = person.user.email;
        const personName = formatFullName(person);
        const formattedDate = formatDateForEmail(
          importantDate.date,
          person.user.dateFormat
        );

        const template = emailTemplates.importantDateReminder(
          personName,
          importantDate.title,
          formattedDate
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

    return NextResponse.json({
      success: true,
      sent: sentCount,
      errors: errorCount,
      processed: importantDates.length,
    });
  } catch (error) {
    console.error('Error processing reminders:', error);
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    );
  }
}

async function shouldSendReminder(
  importantDate: {
    date: Date;
    reminderType: string | null;
    reminderInterval: number | null;
    reminderIntervalUnit: string | null;
    lastReminderSent: Date | null;
  },
  today: Date
): Promise<boolean> {
  const eventDate = new Date(importantDate.date);

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
    // For recurring reminders, check if the anniversary falls on today
    // and if enough time has passed since last reminder

    // Get the next occurrence of this date
    const nextOccurrence = getNextOccurrence(eventDate, today);

    // Check if today matches the next occurrence
    const nextOccurrenceDay = new Date(nextOccurrence);
    nextOccurrenceDay.setHours(0, 0, 0, 0);

    if (nextOccurrenceDay.getTime() !== today.getTime()) {
      return false;
    }

    // Check if we've already sent a reminder for this occurrence
    if (importantDate.lastReminderSent) {
      const lastSent = new Date(importantDate.lastReminderSent);
      const intervalMs = getIntervalMs(
        importantDate.reminderInterval || 1,
        importantDate.reminderIntervalUnit || 'YEARS'
      );

      // Don't send if we sent a reminder within the interval period
      const timeSinceLastSent = today.getTime() - lastSent.getTime();
      if (timeSinceLastSent < intervalMs * 0.9) {
        // 0.9 to account for slight timing variations
        return false;
      }
    }

    return true;
  }

  return false;
}

function getNextOccurrence(eventDate: Date, today: Date): Date {
  // Get this year's occurrence
  const thisYearOccurrence = new Date(
    today.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );
  thisYearOccurrence.setHours(0, 0, 0, 0);

  const todayNormalized = new Date(today);
  todayNormalized.setHours(0, 0, 0, 0);

  // If this year's occurrence hasn't passed, return it
  if (thisYearOccurrence.getTime() >= todayNormalized.getTime()) {
    return thisYearOccurrence;
  }

  // Otherwise, return next year's occurrence
  return new Date(
    today.getFullYear() + 1,
    eventDate.getMonth(),
    eventDate.getDate()
  );
}

function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (unit) {
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

function formatDateForEmail(
  date: Date,
  dateFormat: string | null
): string {
  const d = new Date(date);
  const month = d.toLocaleDateString('en-US', { month: 'long' });
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
