import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptSecret } from '@/lib/crypto/secrets';
import { canUseWebhooks } from '@/lib/notifications/entitlements';
import { generateWebhookSecret } from '@/lib/notifications/signature';
import {
  CredentialsInUrlError,
  MESSAGE_BY_REJECTION,
  checkEndpointUrl,
  normalizeEndpointUrl,
} from '@/lib/notifications/endpoint-url';
import { updateEndpointSchema } from '@/lib/validations';

export const PUT = withAuth(async (request, session, context) => {
  try {
    const parsed = updateEndpointSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;
    const { label, enabled, url, token, rotateSecret } = parsed.data;

    // Changing the URL means a fresh DNS resolution and, for ntfy, an
    // outbound health probe, so it draws on the same per-user outbound
    // ceiling a test send does rather than being an unmetered way to reach
    // it. Sharing that one budget, rather than giving edits a private
    // allowance, is the point: both are user-triggered outbound requests and
    // it is the total that needs bounding.
    if (url !== undefined) {
      const rateLimitResponse = checkRateLimit(
        request,
        'notificationEndpointTestPerUser',
        session.user.id
      );
      if (rateLimitResponse) return rateLimitResponse;
    }

    // The endpoint's own row is needed for anything beyond label/enabled:
    // `type` decides how a URL is normalised and whether a token or a signing
    // secret is the right credential, and it is never taken from the request.
    // Scoped by userId so this cannot read another account's row.
    const existing = await prisma.notificationEndpoint.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, type: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // A token belongs to ntfy and a signing secret to a webhook. Applying
    // either to the wrong type would write a credential the driver for that
    // type would then misuse: sendNtfy puts the stored secret straight into
    // an `Authorization: Bearer` header, sendWebhook uses it as an HMAC key.
    if (token !== undefined && existing.type !== 'NTFY') {
      return NextResponse.json(
        { error: 'Only an ntfy destination has an access token', code: 'invalid' },
        { status: 400 }
      );
    }

    if (rotateSecret && existing.type !== 'WEBHOOK') {
      return NextResponse.json(
        { error: 'Only a webhook has a signing secret', code: 'invalid' },
        { status: 400 }
      );
    }

    // Re-checked here, not only at creation, so a downgrade in SaaS mode
    // stops a user putting a webhook back into service with no cleanup job to
    // run.
    //
    // Scoped to the operations that would actually USE the capability:
    // re-enabling delivery, re-pointing the destination, or issuing a new
    // signing secret. Turning a webhook OFF and relabelling it are
    // deliberately allowed without entitlement. Gating those too meant a user
    // whose subscription had lapsed was shown a banner saying the destination
    // was no longer being delivered to, and then got a 403 when they tried to
    // switch it off, with deleting it outright as their only way out.
    const wantsToUseWebhook = enabled === true || url !== undefined || rotateSecret === true;

    if (
      existing.type === 'WEBHOOK' &&
      wantsToUseWebhook &&
      !(await canUseWebhooks(session.user.id))
    ) {
      return NextResponse.json(
        { error: 'Outgoing webhooks require a Pro subscription', code: 'forbidden' },
        { status: 403 }
      );
    }

    let normalizedUrl: string | undefined;

    if (url !== undefined) {
      let normalized;

      try {
        normalized = normalizeEndpointUrl(existing.type, url);
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

      // The identical checks creation runs, so an edit cannot reach a state
      // creation refuses to produce.
      const rejection = await checkEndpointUrl(normalized);
      if (rejection) {
        return NextResponse.json(
          { error: MESSAGE_BY_REJECTION[rejection.code], code: rejection.code },
          { status: 400 }
        );
      }

      normalizedUrl = normalized.url;
    }

    // Generated server-side and never accepted from the client, the same as at
    // creation: a user-chosen secret could be weak, shared across services, or
    // replayed.
    const newSecret = rotateSecret ? generateWebhookSecret() : null;

    const data: Prisma.NotificationEndpointUpdateManyMutationInput = {
      ...(label !== undefined ? { label } : {}),
      ...(normalizedUrl !== undefined ? { url: normalizedUrl } : {}),
      // `null` clears the token, `undefined` (omitted) leaves it alone. This
      // is the only way back from a NEXTAUTH_SECRET rotation, which makes
      // every stored secret undecryptable.
      ...(token !== undefined ? { secret: token === null ? null : encryptSecret(token) } : {}),
      ...(newSecret !== null ? { secret: encryptSecret(newSecret) } : {}),
      // Re-enabling clears the auto-disable state and the counter, so a user
      // who has fixed their receiver gets a clean slate rather than being
      // switched off again on the next single failure.
      ...(enabled !== undefined
        ? enabled
          ? { enabled: true, autoDisabledAt: null, consecutiveFailures: 0, lastFailureCode: null }
          : { enabled: false }
        : {}),
    };

    // A repaired destination should not stay tarred with the failure that
    // switched it off. Changing the URL or the credential is the user
    // asserting the previous reason no longer applies, so the health counters
    // reset with it. Without this, an endpoint auto-disabled at ten failures
    // would be edited, still show its old failure code, and still be off.
    if (normalizedUrl !== undefined || token !== undefined || newSecret !== null) {
      data.consecutiveFailures = 0;
      data.lastFailureCode = null;
      data.autoDisabledAt = null;
    }

    try {
      // updateMany scoped by userId, not update by id: a plain update would
      // let any signed-in user relabel or re-point another account's endpoint.
      const result = await prisma.notificationEndpoint.updateMany({
        where: { id, userId: session.user.id },
        data,
      });

      if (result.count === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (error) {
      // `@@unique([userId, url])` is what stops the same destination being
      // registered twice and multiplying every reminder into duplicates. An
      // edit can collide with an existing row just as a creation can.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { error: 'You have already added that destination', code: 'duplicate' },
          { status: 409 }
        );
      }
      throw error;
    }

    // The only time a rotated signing secret is ever returned, matching the
    // contract at creation: it is stored encrypted, nothing reads it back, so
    // a user who loses it has to rotate again.
    return NextResponse.json(newSecret ? { success: true, secret: newSecret } : { success: true });
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-update');
  }
});

export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Hard delete. A soft-deleted endpoint that a query forgot to filter would
    // keep firing at a URL the user believes they removed.
    const result = await prisma.notificationEndpoint.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-delete');
  }
});
