import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { encryptSecret } from '@/lib/crypto/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { BlockedUrlError, outboundPolicy, resolveTarget } from '@/lib/net/url-validation';
import { parseNtfyUrl } from '@/lib/notifications/channels/ntfy';
import { canUseWebhooks } from '@/lib/notifications/entitlements';
import { generateWebhookSecret } from '@/lib/notifications/signature';
import { MAX_ENDPOINTS_PER_USER } from '@/lib/notifications/endpoint-health';
import { createEndpointSchema } from '@/lib/validations';

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

/** Thrown by normalizeWebhookUrl when the URL carries a username or password. */
class WebhookCredentialsInUrlError extends Error {}

/**
 * Normalise a webhook URL before it is stored, so the per-user unique
 * constraint on (userId, url) actually catches the same destination typed
 * two different ways.
 *
 * Unlike an ntfy topic URL, a webhook URL's path and query string are part of
 * its identity and must be preserved, not discarded down to an origin. The
 * WHATWG URL parser already lowercases the scheme and host for http(s) URLs;
 * this rebuilds the string explicitly (dropping only the fragment) so the
 * exact shape being stored is visible here rather than implied.
 *
 * Userinfo (`https://user:pw@host/...`) is rejected rather than silently
 * dropped. Rebuilding from `parsed.host` already discards it, which used to
 * mean a URL containing credentials was stored, shown back to the user, and
 * sent to without the credentials ever reaching the receiver: a webhook that
 * needs basic auth in its URL would then fail every single delivery with no
 * indication that anything was ever removed. Better to refuse it up front.
 */
function normalizeWebhookUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.username || parsed.password) {
    throw new WebhookCredentialsInUrlError();
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
}

export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'notificationEndpointCreate', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const parsed = createEndpointSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid endpoint', code: 'invalid' }, { status: 400 });
    }

    const { type, label, url } = parsed.data;

    if (type === 'WEBHOOK' && !(await canUseWebhooks(session.user.id))) {
      return NextResponse.json(
        { error: 'Outgoing webhooks require a Pro subscription', code: 'forbidden' },
        { status: 403 }
      );
    }

    let normalizedUrl: string;

    if (type === 'NTFY') {
      // A URL with no topic would produce a request ntfy silently ignores, so
      // reject it here rather than letting it fail on every reminder forever.
      const parsedNtfy = parseNtfyUrl(url);
      if (!parsedNtfy) {
        return NextResponse.json(
          {
            error: 'Enter a full ntfy topic URL, for example https://ntfy.sh/my-topic',
            code: 'invalid',
          },
          { status: 400 }
        );
      }

      // parseNtfyUrl already lowercases the host (via URL.origin) and drops the
      // trailing slash, so its own output is what both the uniqueness check
      // and every future outbound request should see.
      normalizedUrl = `${parsedNtfy.base}${parsedNtfy.topic}`;
    } else {
      try {
        normalizedUrl = normalizeWebhookUrl(url);
      } catch (error) {
        if (error instanceof WebhookCredentialsInUrlError) {
          return NextResponse.json(
            {
              error:
                'Remove the username and password from the URL. Nametag cannot store URL credentials.',
              code: 'invalid',
            },
            { status: 400 }
          );
        }
        throw error;
      }
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
      await resolveTarget(normalizedUrl, outboundPolicy());
    } catch (error) {
      const code = error instanceof BlockedUrlError ? error.reason : 'invalid';
      return NextResponse.json({ error: 'That URL cannot be used', code }, { status: 400 });
    }

    // The signing secret is generated here, never accepted from the client. A
    // user-chosen secret could be weak, shared across services, or replayed.
    const webhookSecret = type === 'WEBHOOK' ? generateWebhookSecret() : null;
    // Narrowed on parsed.data.type, not the destructured `type` local: narrowing
    // a discriminated union only follows from a check on the object's own
    // discriminant property, not from a copy of it, so `parsed.data.token` would
    // not type-check under `type === 'NTFY'` alone.
    const ntfyToken = parsed.data.type === 'NTFY' ? parsed.data.token : undefined;

    try {
      const endpoint = await prisma.notificationEndpoint.create({
        data: {
          userId: session.user.id,
          type,
          label,
          url: normalizedUrl,
          secret: webhookSecret
            ? encryptSecret(webhookSecret)
            : ntfyToken
              ? encryptSecret(ntfyToken)
              : null,
        },
        select: PUBLIC_FIELDS,
      });

      // The only time the signing secret is ever returned. It is stored
      // encrypted and there is no endpoint that reads it back, so a user who
      // loses it must recreate the webhook.
      return NextResponse.json(
        webhookSecret ? { endpoint, secret: webhookSecret } : { endpoint },
        { status: 201 }
      );
    } catch (error) {
      // The count check above only guards the per-user cap; it says nothing
      // about the same URL already being registered. `@@unique([userId,
      // url])` is what actually prevents a topic being added five times and
      // multiplying every reminder into five identical publishes, and this
      // is where that constraint surfaces as a response instead of a 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already added that destination', code: 'duplicate' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-create');
  }
});
