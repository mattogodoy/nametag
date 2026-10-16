import { NextResponse } from 'next/server';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { getRegistrationStatus, type RegistrationDisabledReason } from '@/lib/server-info';

const MESSAGES: Record<RegistrationDisabledReason, string> = {
  passwordLoginDisabled: 'Password registration is disabled. Use the configured SSO provider.',
  registrationDisabled: 'Registration is currently disabled',
};

export const GET = withLogging(async function GET() {
  try {
    const status = await getRegistrationStatus();
    if (status.enabled) {
      return NextResponse.json({ enabled: true });
    }
    return NextResponse.json({ enabled: false, message: MESSAGES[status.reason] });
  } catch (error) {
    return handleApiError(error, 'registration-status');
  }
});
