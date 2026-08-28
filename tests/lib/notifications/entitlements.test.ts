import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ isSaasMode: vi.fn(), getUserSubscription: vi.fn() }));

vi.mock('../../../lib/features', () => ({ isSaasMode: mocks.isSaasMode }));
vi.mock('../../../lib/billing/subscription', () => ({
  getUserSubscription: mocks.getUserSubscription,
}));

import { canUseWebhooks } from '../../../lib/notifications/entitlements';

describe('canUseWebhooks', () => {
  beforeEach(() => {
    mocks.isSaasMode.mockReset();
    mocks.getUserSubscription.mockReset();
  });

  it('allows every self-hosted user without touching billing', async () => {
    mocks.isSaasMode.mockReturnValue(false);

    expect(await canUseWebhooks('user-1')).toBe(true);
    expect(mocks.getUserSubscription).not.toHaveBeenCalled();
  });

  it('allows a PRO subscriber in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    mocks.getUserSubscription.mockResolvedValue({ tier: 'PRO' });

    expect(await canUseWebhooks('user-1')).toBe(true);
  });

  it('refuses FREE and PERSONAL in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);

    mocks.getUserSubscription.mockResolvedValue({ tier: 'FREE' });
    expect(await canUseWebhooks('user-1')).toBe(false);

    mocks.getUserSubscription.mockResolvedValue({ tier: 'PERSONAL' });
    expect(await canUseWebhooks('user-1')).toBe(false);
  });

  it('refuses when there is no subscription record', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    mocks.getUserSubscription.mockResolvedValue(null);

    expect(await canUseWebhooks('user-1')).toBe(false);
  });

  it('fails closed when the billing lookup throws', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    mocks.getUserSubscription.mockRejectedValue(new Error('db down'));

    expect(await canUseWebhooks('user-1')).toBe(false);
  });
});
