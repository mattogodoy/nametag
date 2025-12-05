import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVerificationSchema, validateRequest } from '@/lib/validations';
import { parseRequestBody } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(checkVerificationSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    if (!user) {
      // Don't reveal whether user exists
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: user.emailVerified });
  } catch (error) {
    console.error('Check verification error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
