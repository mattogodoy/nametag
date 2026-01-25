/**
 * Test script to manually send a reminder email with unsubscribe link
 *
 * Usage:
 *   npx tsx scripts/test-reminder-email.ts
 */

import { prisma } from '../lib/prisma';
import { sendEmail, emailTemplates } from '../lib/email';
import { createUnsubscribeToken } from '../lib/unsubscribe-tokens';
import { formatFullName } from '../lib/nameUtils';
import { parseAsLocalDate } from '../lib/date-format';

async function testReminderEmail() {
  try {
    console.log('🔍 Finding a user with reminder data...\n');

    // Option 1: Test Important Date Reminder
    const importantDate = await prisma.importantDate.findFirst({
      where: {
        reminderEnabled: true,
      },
      include: {
        person: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                language: true,
                dateFormat: true,
              },
            },
          },
        },
      },
    });

    if (importantDate) {
      console.log('📅 Found Important Date Reminder:');
      console.log(`   Person: ${formatFullName(importantDate.person)}`);
      console.log(`   Event: ${importantDate.title}`);
      console.log(`   User Email: ${importantDate.person.user.email}`);
      console.log(`   Reminder Enabled: ${importantDate.reminderEnabled}\n`);

      // Generate unsubscribe token
      const unsubscribeToken = await createUnsubscribeToken({
        userId: importantDate.person.userId,
        reminderType: 'IMPORTANT_DATE',
        entityId: importantDate.id,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

      console.log(`🔗 Unsubscribe URL: ${unsubscribeUrl}\n`);

      // Format date
      const date = parseAsLocalDate(importantDate.date);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

      // Generate email template
      const template = await emailTemplates.importantDateReminder(
        formatFullName(importantDate.person),
        importantDate.title,
        formattedDate,
        unsubscribeUrl,
        (importantDate.person.user.language as 'en' | 'es-ES') || 'en'
      );

      console.log('📧 Sending test email...');
      const result = await sendEmail({
        to: importantDate.person.user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: 'reminders',
      });

      if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log(`   Email ID: ${result.id}`);
        console.log(`\n📬 Check your inbox at: ${importantDate.person.user.email}`);
        console.log(`🔗 Unsubscribe link: ${unsubscribeUrl}`);
      } else {
        console.error('❌ Failed to send email:', result.error);
      }

      return;
    }

    // Option 2: Test Contact Reminder
    const person = await prisma.person.findFirst({
      where: {
        contactReminderEnabled: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            language: true,
            dateFormat: true,
          },
        },
      },
    });

    if (person) {
      console.log('👤 Found Contact Reminder:');
      console.log(`   Person: ${formatFullName(person)}`);
      console.log(`   User Email: ${person.user.email}`);
      console.log(`   Reminder Enabled: ${person.contactReminderEnabled}\n`);

      // Generate unsubscribe token
      const unsubscribeToken = await createUnsubscribeToken({
        userId: person.userId,
        reminderType: 'CONTACT',
        entityId: person.id,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

      console.log(`🔗 Unsubscribe URL: ${unsubscribeUrl}\n`);

      // Format last contact date if exists
      const lastContactFormatted = person.lastContact
        ? new Date(person.lastContact).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : null;

      const interval = person.contactReminderInterval || 1;
      const unit = (person.contactReminderIntervalUnit || 'MONTHS').toLowerCase();
      const intervalText = interval === 1 ? `${interval} ${unit.slice(0, -1)}` : `${interval} ${unit}`;

      // Generate email template
      const template = await emailTemplates.contactReminder(
        formatFullName(person),
        lastContactFormatted,
        intervalText,
        unsubscribeUrl,
        (person.user.language as 'en' | 'es-ES') || 'en'
      );

      console.log('📧 Sending test email...');
      const result = await sendEmail({
        to: person.user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: 'reminders',
      });

      if (result.success) {
        console.log('✅ Email sent successfully!');
        console.log(`   Email ID: ${result.id}`);
        console.log(`\n📬 Check your inbox at: ${person.user.email}`);
        console.log(`🔗 Unsubscribe link: ${unsubscribeUrl}`);
      } else {
        console.error('❌ Failed to send email:', result.error);
      }

      return;
    }

    console.log('❌ No reminders found in the database.');
    console.log('\n💡 To test, you need to:');
    console.log('   1. Create a person in the app');
    console.log('   2. Add an important date with reminder enabled, OR');
    console.log('   3. Enable contact reminders for a person\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testReminderEmail().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
