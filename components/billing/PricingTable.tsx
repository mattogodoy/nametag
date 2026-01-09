'use client';

import { useState } from 'react';
import { SubscriptionTier, BillingFrequency } from '@prisma/client';
import { TIER_INFO } from '@/lib/billing/constants';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '../ui/Button';

interface PricingTableProps {
  currentTier: SubscriptionTier;
  currentFrequency: BillingFrequency | null;
}

export default function PricingTable({ currentTier, currentFrequency }: PricingTableProps) {
  const t = useTranslations('settings.billing.pricing');
  const [frequency, setFrequency] = useState<BillingFrequency>(currentFrequency || 'YEARLY');
  const [loading, setLoading] = useState<string | null>(null);

  const tiers: SubscriptionTier[] = ['FREE', 'PERSONAL', 'PRO'];

  const handleUpgrade = async (tier: Exclude<SubscriptionTier, 'FREE'>) => {
    setLoading(tier);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, frequency }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || t('checkoutError'));
      }
    } catch {
      toast.error(t('checkoutErrorGeneric'));
    } finally {
      setLoading(null);
    }
  };

  const getPrice = (tier: SubscriptionTier) => {
    const info = TIER_INFO[tier];
    if (frequency === 'MONTHLY') {
      return info.monthlyPrice;
    }
    return info.yearlyPrice;
  };

  const getMonthlyEquivalent = (tier: SubscriptionTier) => {
    const info = TIER_INFO[tier];
    if (frequency === 'YEARLY' && info.yearlyPrice) {
      return (info.yearlyPrice / 12).toFixed(2);
    }
    return info.monthlyPrice;
  };

  // Helper to get translated tier info
  const getTierTranslations = (tier: SubscriptionTier) => {
    const tierKey = tier.toLowerCase() as 'free' | 'personal' | 'pro';

    // Get features as array
    const features: string[] = [];
    const featuresObj = t.raw(`tiers.${tierKey}.features` as 'tiers.free.features') as Record<string, string>;
    Object.values(featuresObj).forEach(value => features.push(value));

    return {
      name: t(`tiers.${tierKey}.name` as 'tiers.free.name'),
      description: t(`tiers.${tierKey}.description` as 'tiers.free.description'),
      features,
    };
  };

  return (
    <div className="space-y-6">
      {/* Frequency Toggle */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <p className="text-sm font-medium text-muted mb-1">
            {t('frequencyTitle')}
          </p>
          <p className="text-xs text-muted">
            {t('frequencySubtitle')}
          </p>
        </div>
        <div className="inline-flex items-center bg-surface-elevated rounded-lg p-1.5 shadow-sm">
          <button
            onClick={() => setFrequency('MONTHLY')}
            className={`px-6 py-3 text-base font-semibold rounded-md transition-all ${
              frequency === 'MONTHLY'
                ? 'bg-surface text-foreground shadow-md scale-105'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t('monthly')}
          </button>
          <button
            onClick={() => setFrequency('YEARLY')}
            className={`px-6 py-3 text-base font-semibold rounded-md transition-all relative ${
              frequency === 'YEARLY'
                ? 'bg-surface text-foreground shadow-md scale-105'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
              {t('yearly')}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {t('save')}
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const tierTranslations = getTierTranslations(tier);
          const price = getPrice(tier);
          const isCurrent = tier === currentTier;
          const isUpgrade = tiers.indexOf(tier) > tiers.indexOf(currentTier);
          const isDowngrade = tiers.indexOf(tier) < tiers.indexOf(currentTier);

          return (
            <div
              key={tier}
              className={`relative bg-surface rounded-lg border-2 p-6 flex flex-col ${
                isCurrent
                  ? 'border-blue-500'
                  : tier === 'PERSONAL'
                  ? 'border-purple-500'
                  : 'border-border'
              }`}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  {t('currentPlan')}
                </span>
              )}
              {tier === 'PERSONAL' && !isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                  {t('mostPopular')}
                </span>
              )}

              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-foreground">{tierTranslations.name}</h3>
                <p className="text-sm text-muted mt-1">{tierTranslations.description}</p>
                <div className="mt-4">
                  {price === null ? (
                    <span className="text-3xl font-bold text-foreground">{t('free')}</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">
                        ${frequency === 'YEARLY' ? getMonthlyEquivalent(tier) : price}
                      </span>
                      <span className="text-muted">{t('perMonth')}</span>
                      {frequency === 'YEARLY' && (
                        <p className="text-sm text-muted mt-1">
                          ${price} {t('billedYearly')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-6 flex-grow">
                {tierTranslations.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-muted">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                {isCurrent ? (
                  <Button variant="secondary" fullWidth disabled>
                    {t('currentPlan')}
                  </Button>
                ) : tier === 'FREE' ? (
                  <Button variant="secondary" fullWidth disabled={isDowngrade}>
                    {isDowngrade ? t('downgradeMessage') : t('free')}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    onClick={() => handleUpgrade(tier as Exclude<SubscriptionTier, 'FREE'>)}
                    disabled={loading !== null}
                    className={
                      tier === 'PERSONAL'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-purple-600/50'
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg hover:shadow-yellow-600/50'
                    }
                  >
                    {loading === tier ? t('loading') : isUpgrade ? t('upgrade') : t('switchPlan')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
