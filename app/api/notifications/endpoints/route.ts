import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { encryptSecret } from '@/lib/crypto/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { BlockedUrlError, outboundPolicy, resolveTarget } from '@/lib/net/url-validation';
import { parseNtfyUrl } from '@/lib/notifications/channels/ntfy';
import { MAX_ENDPOINTS_PER_USER } from '@/lib/notifications/endpoint-health';
import { createNtfyEndpointSchema } from '@/lib/validations';

/**
 * Columns safe to return.
 *
 * `secret` is deliberately absent. It is write-only from the client's point of
 * view: it goes in encrypted at create time and is never read back out.
 */
const PUBLIC_FIELDS = {
  id: true,
  type: true,
  label: true,
  url: true,
  enabled: true,
  consecutiveFailures: true,
  lastSuccessAt: true,
  lastFailureAt: true,
  lastFailureCode: true,
  autoDisabledAt: true,
  createdAt: true,
} as const;

export const GET = withAuth(async (_request, session) => {
  try {
    const endpoints = await prisma.notificationEndpoint.findMany({
      where: { userId: session.user.id },
      select: PUBLIC_FIELDS,
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ endpoints });
  } catch (error) {
    return handleApiError(error, 'notification-endpoints-list');
  }
});

export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'notificationEndpointCreate', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const parsed = createNtfyEndpointSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid endpoint', code: 'invalid' }, { status: 400 });
    }

    const { label, url, token } = parsed.data;

    // A URL with no topic would produce a request ntfy silently ignores, so
    // reject it here rather than letting it fail on every reminder forever.
    if (!parseNtfyUrl(url)) {
      return NextResponse.json(
        {
          error: 'Enter a full ntfy topic URL, for example https://ntfy.sh/my-topic',
          code: 'invalid',
        },
        { status: 400 }
      );
    }

    // Cap before the DNS work below. Checked first so a user already at the
    // limit gets an immediate 409 rather than paying for a resolution on
    // every request against a cap that was always going to reject them.
    const existing = await prisma.notificationEndpoint.count({
      where: { userId: session.user.id },
    });
    if (existing >= MAX_ENDPOINTS_PER_USER) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_ENDPOINTS_PER_USER} endpoints` },
        { status: 409 }
      );
    }

    // Validate now as well as at send time. Save-time validation gives the
    // user an immediate error instead of a silently dead endpoint; send-time
    // validation is what actually protects us, because a hostname can be
    // re-pointed after it is saved.
    //
    // The `code` here matters as much as the message: `policy` (a disallowed
    // protocol, port, or private address) is permanent, the user must change
    // the URL, while `dns` (the hostname did not resolve) can be a transient
    // resolver hiccup. Losing that distinction here would put the create
    // screen exactly where the test-send screen was before it was fixed: a
    // self-hoster with a correct URL and a blipping resolver being told to go
    // change it.
    try {
      await resolveTarget(url, outboundPolicy());
    } catch (error) {
      const code = error instanceof BlockedUrlError ? error.reason : 'invalid';
      return NextResponse.json({ error: 'That URL cannot be used', code }, { status: 400 });
    }

    const endpoint = await prisma.notificationEndpoint.create({
      data: {
        userId: session.user.id,
        type: 'NTFY',
        label,
        url,
        secret: token ? encryptSecret(token) : null,
      },
      select: PUBLIC_FIELDS,
    });

    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-create');
  }
});
