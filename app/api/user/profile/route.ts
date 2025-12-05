import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';

const TOKEN_EXPIRY_HOURS = 24;

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, surname, nickname, email } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 400 }
      );
    }

    // Check if email is being changed
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    const emailChanged = currentUser?.email !== email;

    if (emailChanged) {
      // Generate new verification token
      const verifyToken = generateVerificationToken();
      const verifyExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Update user with new email and require verification
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name,
          surname: surname || null,
          nickname: nickname || null,
          email,
          emailVerified: false,
          emailVerifyToken: verifyToken,
          emailVerifyExpires: verifyExpires,
          emailVerifySentAt: new Date(),
        },
      });

      // Send verification email to new address
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const verificationUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
      const { subject, html, text } = emailTemplates.accountVerification(verificationUrl);

      await sendEmail({
        to: email,
        subject,
        html,
        text,
        from: 'accounts',
      });

      return NextResponse.json({ emailChanged: true });
    }

    // Email not changed - just update profile
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        surname: surname || null,
        nickname: nickname || null,
        email,
      },
    });

    return NextResponse.json({ user, emailChanged: false });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
