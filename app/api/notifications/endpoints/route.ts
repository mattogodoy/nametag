import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { encryptSecret } from '@/lib/crypto/secrets';
import { checkRateLimit } from '@/lib/rate-limit';
import { lockUserRow } from '@/lib/db/user-lock';
import {
  CredentialsInUrlError,
  MESSAGE_BY_REJECTION,
  checkEndpointUrl,
  normalizeEndpointUrl,
} from '@/lib/notifications/endpoint-url';
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

/** Thrown inside the create transaction when the per-user cap is already met. */
class EndpointCapReachedError extends Error {}

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

    let normalized;

    try {
      normalized = normalizeEndpointUrl(type, url);
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

    if (!normalized) {
      return NextResponse.json(
        {
          error: 'Enter a full ntfy topic URL, for example https://ntfy.sh/my-topic',
          code: 'invalid',
        },
        { status: 400 }
      );
    }

    const normalizedUrl = normalized.url;

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

    const rejection = await checkEndpointUrl(normalized);
    if (rejection) {
      return NextResponse.json(
        { error: MESSAGE_BY_REJECTION[rejection.code], code: rejection.code },
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
