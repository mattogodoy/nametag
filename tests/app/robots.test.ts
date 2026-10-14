import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSaasMode: vi.fn(),
}));

vi.mock('../../lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

import robots from '../../app/robots';

describe('robots.txt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks every path on self-hosted instances', () => {
    mocks.isSaasMode.mockReturnValue(false);

    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' });
  });

  it('only allows the sign-in and sign-up pages in SaaS mode', () => {
    mocks.isSaasMode.mockReturnValue(true);

    expect(robots().rules).toEqual({
      userAgent: '*',
      allow: ['/login', '/register'],
      disallow: '/',
    });
  });
});
