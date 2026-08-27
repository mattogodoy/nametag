import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { emailRemindersSchema } from '@/lib/validations';

export const PUT = withAuth(async (request, session) => {
  try {
    const parsed = emailRemindersSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailRemindersEnabled: parsed.data.enabled },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'notification-email-toggle');
  }
});
