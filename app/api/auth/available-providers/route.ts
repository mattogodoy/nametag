import { NextResponse } from 'next/server';
import { isSaasMode, isFeatureEnabled } from '@/lib/features';
import { env } from '@/lib/env';
import { withLogging } from '@/lib/api-utils';

export const GET = withLogging(async function GET() {
  const oidcEnabled = isFeatureEnabled('oidc');

  const providers = {
    credentials: isFeatureEnabled('passwordLogin'),
    google: isSaasMode() && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    oidc: {
      enabled: oidcEnabled,
      name: env.OIDC_DISPLAY_NAME || 'SSO',
    },
  };

  return NextResponse.json({ providers });
});
