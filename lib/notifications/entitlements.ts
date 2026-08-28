import { isSaasMode } from '@/lib/features';
import { getUserSubscription } from '@/lib/billing/subscription';
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
