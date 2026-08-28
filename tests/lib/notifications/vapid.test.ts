import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    VAPID_PUBLIC_KEY: undefined as string | undefined,
    VAPID_PRIVATE_KEY: undefined as string | undefined,
    VAPID_SUBJECT: undefined as string | undefined,
  },
}));

vi.mock('../../../lib/env', () => ({ env: mocks.env, getAppUrl: () => 'https://app.test' }));

import { isPushConfigured, getVapidDetails } from '../../../lib/notifications/vapid';

describe('vapid configuration', () => {
  beforeEach(() => {
    mocks.env.VAPID_PUBLIC_KEY = undefined;
    mocks.env.VAPID_PRIVATE_KEY = undefined;
    mocks.env.VAPID_SUBJECT = undefined;
  });

  it('reports push as unconfigured when nothing is set', () => {
    expect(isPushConfigured()).toBe(false);
    expect(getVapidDetails()).toBeNull();
  });

  it('reports push as unconfigured when only some variables are set', () => {
    mocks.env.VAPID_PUBLIC_KEY = 'pub';

    expect(isPushConfigured()).toBe(false);
    expect(getVapidDetails()).toBeNull();
  });

  it('returns the details when all three are set', () => {
    mocks.env.VAPID_PUBLIC_KEY = 'pub';
    mocks.env.VAPID_PRIVATE_KEY = 'priv';
    mocks.env.VAPID_SUBJECT = 'mailto:admin@example.com';

    expect(isPushConfigured()).toBe(true);
    expect(getVapidDetails()).toEqual({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:admin@example.com',
    });
  });
});
