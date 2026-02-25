import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';

export const GET = withLogging(async function GET() {
  try {
    // If registration is not disabled, always allow
    if (process.env.DISABLE_REGISTRATION !== 'true') {
      return NextResponse.json({ enabled: true });
    }

    // If registration is disabled, check if this would be the first user
    const userCount = await prisma.user.count();

    if (userCount === 0) {
      // First user can still register
      return NextResponse.json({ enabled: true });
    }

    // Registration is disabled and there are already users
    return NextResponse.json({
      enabled: false,
      message: 'Registration is currently disabled',
    });
  } catch (error) {
    return handleApiError(error, 'registration-status');
  }
});
