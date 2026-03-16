import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import { formatFullName } from './nameUtils';
import { getTranslationsForLocale } from './i18n-utils';
import { getDateDisplayTitle } from './important-date-types';
import { getUserLocale } from './locale';

const TOKEN_EXPIRY_DAYS = 90;

export type ReminderEntityType = 'IMPORTANT_DATE' | 'CONTACT';

interface CreateTokenParams {
  userId: string;
  reminderType: ReminderEntityType;
  entityId: string;
}

/**
 * Generate a cryptographically secure unsubscribe token
 */
export async function createUnsubscribeToken({
  userId,
  reminderType,
  entityId,
}: CreateTokenParams): Promise<string> {
  // Check if token already exists for this specific reminder
  const existingToken = await prisma.unsubscribeToken.findFirst({
    where: {
      userId,
      reminderType,
      entityId,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  // Reuse existing valid token to avoid token proliferation
  if (existingToken) {
    return existingToken.token;
  }

  // Generate secure random token (64 hex characters)
  const token = randomBytes(32).toString('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  // Create new token
  const newToken = await prisma.unsubscribeToken.create({
    data: {
      token,
      userId,
      reminderType,
      entityId,
      expiresAt,
    },
  });

  return newToken.token;
}

interface ConsumeTokenSuccess {
  success: true;
  user: {
    id: string;
    email: string;
    language: string | null;
  };
  reminderType: ReminderEntityType;
  entityId: string;
}

interface ConsumeTokenError {
  success: false;
  error: 'INVALID_TOKEN' | 'ALREADY_USED' | 'EXPIRED';
}

type ConsumeTokenResult = ConsumeTokenSuccess | ConsumeTokenError;

/**
 * Validate and consume an unsubscribe token
 */
export async function consumeUnsubscribeToken(
  token: string
): Promise<ConsumeTokenResult> {
  const unsubToken = await prisma.unsubscribeToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          language: true,
        },
      },
    },
  });

  if (!unsubToken) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  if (unsubToken.used) {
    return { success: false, error: 'ALREADY_USED' };
  }

  if (unsubToken.expiresAt < new Date()) {
    return { success: false, error: 'EXPIRED' };
  }

  // Mark token as used
  await prisma.unsubscribeToken.update({
    where: { id: unsubToken.id },
    data: {
      used: true,
      usedAt: new Date(),
    },
  });

  // Disable the specific reminder
  if (unsubToken.reminderType === 'IMPORTANT_DATE') {
    await prisma.importantDate.update({
      where: { id: unsubToken.entityId },
      data: { reminderEnabled: false },
    });
  } else if (unsubToken.reminderType === 'CONTACT') {
    await prisma.person.update({
      where: { id: unsubToken.entityId },
      data: { contactReminderEnabled: false },
    });
  }

  return {
    success: true,
    user: unsubToken.user,
    reminderType: unsubToken.reminderType,
    entityId: unsubToken.entityId,
  };
}

interface UnsubscribeDetails {
  reminderType: ReminderEntityType;
  entityName: string;
  used: boolean;
  expired: boolean;
}

/**
 * Get entity details for display
 */
export async function getUnsubscribeDetails(
  token: string
): Promise<UnsubscribeDetails | null> {
  const unsubToken = await prisma.unsubscribeToken.findUnique({
    where: { token },
  });

  if (!unsubToken) {
    return null;
  }

  // Fetch user's nameOrder preference
  const user = await prisma.user.findUnique({
    where: { id: unsubToken.userId },
    select: { nameOrder: true },
  });
  const nameOrder = user?.nameOrder;

  let entityName = '';

  if (unsubToken.reminderType === 'IMPORTANT_DATE') {
    const importantDate = await prisma.importantDate.findFirst({
      where: { id: unsubToken.entityId, deletedAt: null },
      include: {
        person: {
          select: {
            name: true,
            surname: true,
            middleName: true,
            secondLastName: true,
            nickname: true,
          },
        },
      },
    });

    if (importantDate) {
      const personName = formatFullName(importantDate.person, nameOrder);
      const userLocale = await getUserLocale(unsubToken.userId);
      const tDates = await getTranslationsForLocale(userLocale, 'people.form.importantDates');
      entityName = `${personName}'s ${getDateDisplayTitle(importantDate, tDates)}`;
    }
  } else if (unsubToken.reminderType === 'CONTACT') {
    const person = await prisma.person.findFirst({
      where: { id: unsubToken.entityId, deletedAt: null },
      select: {
        name: true,
        surname: true,
        middleName: true,
        secondLastName: true,
        nickname: true,
      },
    });

    if (person) {
      entityName = formatFullName(person, nameOrder);
    }
  }

  return {
    reminderType: unsubToken.reminderType,
    entityName,
    used: unsubToken.used,
    expired: unsubToken.expiresAt < new Date(),
  };
}
