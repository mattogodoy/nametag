import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSupportedLocale, setLocaleCookie } from '@/lib/locale';

/**
 * PUT /api/user/language
 * Update user's language preference
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { language } = body;

    // Validate language
    if (!language || !isSupportedLocale(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Supported languages: en, es-ES, ja-JP' },
        { status: 400 }
      );
    }

    // Update user's language preference in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { language },
    });

    // Set cookie for immediate effect
    await setLocaleCookie(language);

    return NextResponse.json({
      success: true,
      language,
    });
  } catch (error) {
    console.error('Error updating language:', error);
    return NextResponse.json(
      { error: 'Failed to update language' },
      { status: 500 }
    );
  }
}
