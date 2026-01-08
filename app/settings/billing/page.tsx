import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSubscriptionWithStatus } from '@/lib/billing';
import { TIER_INFO } from '@/lib/billing/constants';
import { isSaasMode } from '@/lib/features';
import UsageMeter from '@/components/billing/UsageMeter';
import PricingTable from '@/components/billing/PricingTable';
import ApplyPromoForm from '@/components/billing/ApplyPromoForm';
import PaymentHistoryTable from '@/components/billing/PaymentHistoryTable';
import BillingActions from '@/components/billing/BillingActions';
import BillingToast from '@/components/billing/BillingToast';

export default async function BillingSettingsPage() {
  // Billing is only available in SaaS mode
  if (!isSaasMode()) {
    redirect('/settings/profile');
  }

  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const subscriptionData = await getSubscriptionWithStatus(session.user.id);
  const tier = subscriptionData.subscription?.tier ?? 'FREE';
  const tierInfo = TIER_INFO[tier];
  const isComplimentary = subscriptionData.subscription?.isComplimentary ?? false;

  // Get payment history
  const payments = subscriptionData.subscription
    ? await prisma.paymentHistory.findMany({
        where: { subscriptionId: subscriptionData.subscription.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })
    : [];

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <BillingToast />
      </Suspense>

      {/* Current Plan */}
      <div className="bg-surface shadow rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Current Plan
            </h2>
            <p className="text-muted mt-1">
              Manage your subscription and billing
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                tier === 'PRO'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                  : tier === 'PERSONAL'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-surface-elevated text-muted'
              }`}
            >
              {tierInfo.name}
            </span>
          </div>
        </div>

        {/* Plan details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted">Plan</p>
            <p className="text-lg font-medium text-foreground">
              {tierInfo.name}
              {subscriptionData.subscription?.billingFrequency && (
                <span className="text-sm text-muted ml-2">
                  ({subscriptionData.subscription.billingFrequency.toLowerCase()})
                </span>
              )}
            </p>
          </div>
          {subscriptionData.subscription?.currentPeriodEnd && (
            <div>
              <p className="text-sm text-muted">
                {subscriptionData.subscription.cancelAtPeriodEnd
                  ? 'Access until'
                  : 'Next billing date'}
              </p>
              <p className="text-lg font-medium text-foreground">
                {formatDate(subscriptionData.subscription.currentPeriodEnd)}
              </p>
            </div>
          )}
        </div>

        {/* Complimentary access message */}
        {isComplimentary && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              <span className="font-medium text-purple-800 dark:text-purple-400">
                Complimentary PRO Access
              </span>
            </div>
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
              You have been granted free unlimited access to all PRO features. No payment required.
            </p>
          </div>
        )}

        {/* Promotion info */}
        {!isComplimentary && subscriptionData.subscription?.promotion && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span className="font-medium text-green-800 dark:text-green-400">
                {subscriptionData.subscription.promotion.promotion.description}
              </span>
              <span className="text-green-600 dark:text-green-400">
                ({subscriptionData.subscription.promotion.promotion.discountPercent}% off)
              </span>
            </div>
            {subscriptionData.promotionExpiry && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Expires {formatDate(subscriptionData.promotionExpiry)}
              </p>
            )}
          </div>
        )}

        {!isComplimentary && (
          <BillingActions
            tier={tier}
            hasStripeSubscription={!!subscriptionData.subscription?.stripeSubscriptionId}
            cancelAtPeriodEnd={subscriptionData.subscription?.cancelAtPeriodEnd ?? false}
          />
        )}
      </div>

      {/* Usage */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          Usage
        </h2>
        <div className="space-y-4">
          <UsageMeter
            label="People"
            current={subscriptionData.limits.people.current}
            limit={subscriptionData.limits.people.limit}
            isUnlimited={subscriptionData.limits.people.isUnlimited}
          />
          <UsageMeter
            label="Groups"
            current={subscriptionData.limits.groups.current}
            limit={subscriptionData.limits.groups.limit}
            isUnlimited={subscriptionData.limits.groups.isUnlimited}
          />
          <UsageMeter
            label="Reminders"
            current={subscriptionData.limits.reminders.current}
            limit={subscriptionData.limits.reminders.limit}
            isUnlimited={subscriptionData.limits.reminders.isUnlimited}
          />
        </div>
      </div>

      {/* Apply Promotion */}
      {!isComplimentary && !subscriptionData.subscription?.promotion && (
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Have a Promotion Code?
          </h2>
          <ApplyPromoForm hasActivePromo={!!subscriptionData.subscription?.promotion} />
        </div>
      )}

      {/* Upgrade/Downgrade */}
      {!isComplimentary && (
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-6">
            Available Plans
          </h2>
          <PricingTable
            currentTier={tier}
            currentFrequency={subscriptionData.subscription?.billingFrequency ?? null}
          />
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="bg-surface shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Payment History
          </h2>
          <PaymentHistoryTable
            payments={payments.map((p) => ({
              ...p,
              paidAt: p.paidAt?.toISOString() ?? null,
              createdAt: p.createdAt.toISOString(),
            }))}
          />
        </div>
      )}
    </div>
  );
}
