import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAppUrl: vi.fn(),
}));

vi.mock('@/lib/env', () => ({
  getAppUrl: mocks.getAppUrl,
}));

import { validateOrigin } from '@/lib/csrf';

describe('CSRF Origin Validation', () => {
  beforeEach(() => {
    mocks.getAppUrl.mockReturnValue('https://nametag.one');
  });

  it('should allow requests with matching origin', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { origin: 'https://nametag.one' },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should reject requests with mismatched origin', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { origin: 'https://evil.com' },
    });
    expect(validateOrigin(request)).toBe(false);
  });

  it('should allow GET requests without origin check', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'GET',
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow HEAD requests without origin check', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'HEAD',
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow OPTIONS requests without origin check', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'OPTIONS',
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow requests without origin header (same-origin or non-browser)', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should fall back to referer if origin not present', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { referer: 'https://evil.com/attack-page' },
    });
    expect(validateOrigin(request)).toBe(false);
  });

  it('should allow referer from same origin', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { referer: 'https://nametag.one/people/123' },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should reject invalid referer URL', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: { referer: 'not-a-valid-url' },
    });
    expect(validateOrigin(request)).toBe(false);
  });

  it('should prefer origin over referer when both present', () => {
    const request = new Request('https://nametag.one/api/people', {
      method: 'POST',
      headers: {
        origin: 'https://nametag.one',
        referer: 'https://evil.com/attack',
      },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow origin matching the Host header even if NEXTAUTH_URL differs', () => {
    // User accesses via http://hades:3003 but NEXTAUTH_URL is https://nametag.one
    const request = new Request('http://hades:3003/api/people', {
      method: 'PUT',
      headers: {
        origin: 'http://hades:3003',
        host: 'hades:3003',
      },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should allow referer matching the Host header even if NEXTAUTH_URL differs', () => {
    const request = new Request('http://hades:3003/api/people', {
      method: 'PUT',
      headers: {
        referer: 'http://hades:3003/people/123/edit',
        host: 'hades:3003',
      },
    });
    expect(validateOrigin(request)).toBe(true);
  });

  it('should reject origin that matches neither NEXTAUTH_URL nor Host', () => {
    const request = new Request('http://hades:3003/api/people', {
      method: 'POST',
      headers: {
        origin: 'https://evil.com',
        host: 'hades:3003',
      },
    });
    expect(validateOrigin(request)).toBe(false);
  });

  it('should respect x-forwarded-proto when building Host origin', () => {
    const request = new Request('http://hades:3003/api/people', {
      method: 'PUT',
      headers: {
        origin: 'https://hades:3003',
        host: 'hades:3003',
        'x-forwarded-proto': 'https',
      },
    });
    expect(validateOrigin(request)).toBe(true);
  });
});
