import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { registerSchema, validateRequest } from '@/lib/validations';

const TOKEN_EXPIRY_HOURS = 24;

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = validateRequest(registerSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { email, password, name, surname, nickname } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verifyToken = generateVerificationToken();
    const verifyExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create user with verification token
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        surname: surname || null,
        nickname: nickname || null,
        emailVerified: false,
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        emailVerifySentAt: new Date(),
      },
    });

    // Send verification email
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

    return NextResponse.json(
      {
        message: 'Account created. Please check your email to verify your account.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
