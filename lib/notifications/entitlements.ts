import { isSaasMode } from '@/lib/features';
import { getUserSubscription } from '@/lib/billing/subscription';
import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('notifications:entitlements');

/**
 * Whether this user may send reminders to an arbitrary webhook URL.
 *
 * Self-hosted: always. The user is the operator, and outbound requests from
 * their own server to their own endpoints are not our risk to manage.
 *
 * SaaS: PRO only. A webhook makes nametag.one issue attacker-influenced
 * outbound requests, so requiring a paid subscription puts a credit card and a
 * bannable account behind the capability. Tier alone is enough: only
 * `customer.subscription.deleted` downgrades the tier to FREE. A `past_due`
 * subscription (from `customer.subscription.updated`) deliberately keeps its
 * tier through the dunning window, the same as every other limit gated on
 * tier, so a lapsed-but-not-yet-cancelled account still passes this check.
 *
 * Fails closed. A billing lookup that errors must not hand out the capability.
 */
export async function canUseWebhooks(userId: string): Promise<boolean> {
  if (!isSaasMode()) {
    return true;
  }

  try {
    const subscription = await getUserSubscription(userId);
    return subscription?.tier === 'PRO';
  } catch (error) {
    log.error(
      { userId, errorMessage: error instanceof Error ? error.message : 'Unknown error' },
      'Webhook entitlement check failed, denying'
    );
    return false;
  }
}

/**
 * Resolve webhook entitlement for many users in one query.
 *
 * `canUseWebhooks` issues one `subscription.findUnique` per user, which the
 * nightly run then repeats for every webhook owner. The sibling loaders in
 * dispatch.ts (`loadEmailPreferences`, `loadEndpoints`) are both already
 * batched, so this is a consistency fix as much as a performance one.
 *
 * Fails closed exactly as `canUseWebhooks` does: an error resolving the batch
 * denies every user in it rather than handing out the capability. A user with
 * no subscription row is absent from the result and therefore denied, which is
 * the same answer `subscription?.tier === 'PRO'` gives for a null row.
 */
export async function canUseWebhooksForUsers(
  userIds: readonly string[]
): Promise<Map<string, boolean>> {
  if (!isSaasMode()) {
    return new Map(userIds.map((userId) => [userId, true]));
  }

  if (userIds.length === 0) {
    return new Map();
  }

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: { in: [...userIds] } },
      select: { userId: true, tier: true },
    });

    const byUser = new Map(subscriptions.map((row) => [row.userId, row.tier === 'PRO']));
    return new Map(userIds.map((userId) => [userId, byUser.get(userId) ?? false]));
  } catch (error) {
    log.error(
      { count: userIds.length, errorMessage: error instanceof Error ? error.message : 'Unknown error' },
      'Batched webhook entitlement check failed, denying'
    );
    return new Map(userIds.map((userId) => [userId, false]));
  }
}
