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
});
