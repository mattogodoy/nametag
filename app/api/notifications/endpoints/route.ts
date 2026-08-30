import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { encryptSecret } from '@/lib/crypto/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { BlockedUrlError, outboundPolicy, resolveTarget } from '@/lib/net/url-validation';
import { parseNtfyUrl } from '@/lib/notifications/channels/ntfy';
import { probeNtfyHealth } from '@/lib/notifications/outbound';
import { lockUserRow } from '@/lib/db/user-lock';
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

/** Thrown by a normaliser when the URL carries a username or password. */
class CredentialsInUrlError extends Error {}

/** Thrown inside the create transaction when the per-user cap is already met. */
class EndpointCapReachedError extends Error {}

/**
 * Ceiling on the stored URL, in bytes.
 *
 * `createEndpointSchema` caps the URL at 500 characters, but Zod's `.max()`
 * counts UTF-16 code units while normalisation percent-encodes, which expands
 * a non-ASCII character to up to 9 bytes. `@@unique([userId, url])` is a btree
 * index, and Postgres refuses an index entry near 2704 bytes, so a 495
 * character URL of non-ASCII path could pass validation and then fail at the
 * index as a raw 500 rather than a clean 400. Checked on the NORMALISED value,
 * since that is what is actually stored and indexed. The same guard already
 * exists on `pushSubscribeSchema.endpoint` for the same reason.
 */
const MAX_URL_BYTES = 2000;

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
    throw new CredentialsInUrlError();
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
}

/**
 * Reject an ntfy topic URL that carries userinfo.
 *
 * `parseNtfyUrl` builds its base from `URL.origin`, which silently discards
 * `user:pw@`. That is the same failure normalizeWebhookUrl above refuses for
 * webhooks, and it bites identically here: the destination is stored and
 * rendered back without the credentials, then authenticates as nobody and
 * fails every single delivery with nothing to indicate that anything was
 * removed. ntfy's own auth belongs in the access-token field, not the URL.
 */
function assertNoNtfyCredentials(url: string): void {
  const parsed = new URL(url);
  if (parsed.username || parsed.password) {
    throw new CredentialsInUrlError();
  }
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
    let ntfyBase: string | null = null;

    try {
      if (type === 'NTFY') {
        assertNoNtfyCredentials(url);

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
        ntfyBase = parsedNtfy.base;
      } else {
        normalizedUrl = normalizeWebhookUrl(url);
      }
    } catch (error) {
      if (error instanceof CredentialsInUrlError) {
        return NextResponse.json(
          {
            error:
              'Remove the username and password from the URL. Nametag cannot store URL credentials.',
            code: 'credentials_in_url',
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Checked on the normalised value, which is what gets stored and indexed.
    // See MAX_URL_BYTES for why the schema's character cap is not enough.
    if (Buffer.byteLength(normalizedUrl, 'utf8') > MAX_URL_BYTES) {
      return NextResponse.json({ error: 'That URL is too long', code: 'invalid' }, { status: 400 });
    }

    // A cheap pre-check before the DNS work below, so a user already at the
    // limit gets an immediate 409 rather than paying for a resolution against
    // a cap that was always going to reject them. This is NOT the enforcement
    // point: it races, and the authoritative check is the one taken under a
    // row lock inside the transaction further down.
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

    // Confirm an ntfy server actually answers here before saving.
    //
    // Without this, a URL that merely *parses* like an ntfy topic is accepted,
    // and any host that returns 2xx for a POST to `/` is then recorded as a
    // successful delivery every night: the reminder is stamped as sent and
    // never retried, so the occurrence is silently and permanently lost. The
    // send path has its own guard now (`expectJsonResponse` in sendNtfy), but
    // catching it here is what turns an invisible nightly failure into an
    // error at the moment the user can still fix the URL.
    //
    // The probe returns a boolean and nothing else; see probeNtfyHealth for
    // why that keeps it from being a content oracle.
    if (ntfyBase !== null && !(await probeNtfyHealth(ntfyBase))) {
      return NextResponse.json(
        {
          error: 'No ntfy server answered at that address',
          code: 'not_ntfy',
        },
        { status: 400 }
      );
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
      // Count and insert under one exclusive lock on the owning user row.
      // The pre-check above races: two concurrent POSTs can each read a count
      // under the cap and both insert, leaving the user over it. Taking the
      // count inside the same transaction that does the insert, behind
      // lockUserRow, is what actually enforces MAX_ENDPOINTS_PER_USER.
      const endpoint = await prisma.$transaction(async (tx) => {
        await lockUserRow(tx, session.user.id);

        const current = await tx.notificationEndpoint.count({
          where: { userId: session.user.id },
        });

        if (current >= MAX_ENDPOINTS_PER_USER) {
          throw new EndpointCapReachedError();
        }

        return tx.notificationEndpoint.create({
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
      });

      // The only time the signing secret is ever returned. It is stored
      // encrypted and there is no endpoint that reads it back, so a user who
      // loses it must recreate the webhook.
      return NextResponse.json(
        webhookSecret ? { endpoint, secret: webhookSecret } : { endpoint },
        { status: 201 }
      );
    } catch (error) {
      // Lost the race for the last slot. The transaction already rolled back,
      // so nothing was created.
      if (error instanceof EndpointCapReachedError) {
        return NextResponse.json(
          { error: `You can have at most ${MAX_ENDPOINTS_PER_USER} endpoints` },
          { status: 409 }
        );
      }

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
