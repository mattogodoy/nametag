import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Account, Profile, User } from 'next-auth';

const mocks = vi.hoisted(() => ({ record: vi.fn(), findUnique: vi.fn() }));

vi.mock('@/lib/native-auth/browser-cookie', () => ({ recordNativeAuthFailure: mocks.record }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: vi.fn(), create: vi.fn() } },
}));
vi.mock('@/lib/billing', () => ({ createFreeSubscription: vi.fn() }));
vi.mock('@/lib/relationship-types', () => ({ createPreloadedRelationshipTypes: vi.fn() }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { handleOAuthSignIn } from '@/lib/auth';

const makeUser = (): User => ({ id: 'tmp', email: 'a@b.c', name: 'A', surname: null, nickname: null, photo: null });
const oidcAccount = (): Account => ({ provider: 'oidc', providerAccountId: 'p1', type: 'oidc' });
const profile = (verified: boolean): Profile => ({ email_verified: verified });

describe('handleOAuthSignIn records native failure reasons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records email_not_verified before rejecting an unverified OIDC email', async () => {
    await expect(handleOAuthSignIn(makeUser(), oidcAccount(), profile(false))).rejects.toThrow(
      'OIDC_EMAIL_NOT_VERIFIED'
    );
    expect(mocks.record).toHaveBeenCalledWith('email_not_verified');
  });

  it('records account_linked_elsewhere before rejecting a provider mismatch', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', provider: 'google', providerAccountId: 'g1' });
    await expect(handleOAuthSignIn(makeUser(), oidcAccount(), profile(true))).rejects.toThrow(
      'ACCOUNT_LINKED_TO_DIFFERENT_PROVIDER'
    );
    expect(mocks.record).toHaveBeenCalledWith('account_linked_elsewhere');
  });

  it('records nothing on success', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', provider: 'oidc', providerAccountId: 'p1' });
    await handleOAuthSignIn(makeUser(), oidcAccount(), profile(true));
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
