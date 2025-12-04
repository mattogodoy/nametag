import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

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
