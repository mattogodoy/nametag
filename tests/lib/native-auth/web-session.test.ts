import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  blacklistToken: vi.fn(),
  deleted: [] as string[],
  names: [] as string[],
  set: [] as { name: string; value: string; options: Record<string, unknown> }[],
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => mocks.names.map((name) => ({ name, value: 'v' })),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      mocks.deleted.push(name);
      mocks.set.push({ name, value, options });
    },
  }),
}));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('@/lib/token-blacklist', () => ({ blacklistToken: mocks.blacklistToken }));
vi.mock('@/lib/env', () => ({ env: { NEXTAUTH_SECRET: 's'.repeat(32), NEXTAUTH_URL: 'https://nametag.example' } }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { endWebSession } from '@/lib/native-auth/web-session';

describe('endWebSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleted = [];
    mocks.set = [];
    mocks.names = ['authjs.session-token', 'authjs.session-token.0', 'other'];
  });

  it('blacklists the JWT and deletes exactly the session cookies', async () => {
    mocks.getToken.mockResolvedValue({ jti: 'j1', exp: 2000000000 });
    await endWebSession(new Request('https://nametag.example/x'));
    expect(mocks.blacklistToken).toHaveBeenCalledWith('j1', new Date(2000000000 * 1000));
    expect(mocks.deleted).toEqual(['authjs.session-token', 'authjs.session-token.0']);
  });

  it('still deletes the cookies when blacklisting fails', async () => {
    mocks.getToken.mockResolvedValue({ jti: 'j1', exp: 2000000000 });
    mocks.blacklistToken.mockRejectedValue(new Error('redis down'));
    await endWebSession(new Request('https://nametag.example/x'));
    expect(mocks.deleted).toHaveLength(2);
  });

  it('derives secureCookie from NEXTAUTH_URL', async () => {
    mocks.getToken.mockResolvedValue(null);
    await endWebSession(new Request('https://nametag.example/x'));
    expect(mocks.getToken).toHaveBeenCalledWith(expect.objectContaining({ secureCookie: true }));
    expect(mocks.blacklistToken).not.toHaveBeenCalled();
  });

  it('expires each session cookie with attributes that match how it was set', async () => {
    mocks.names = ['__Secure-authjs.session-token', '__Secure-authjs.session-token.0', 'authjs.session-token', 'other'];
    mocks.getToken.mockResolvedValue(null);
    await endWebSession(new Request('https://nametag.example/x'));
    expect(mocks.set.map((c) => [c.name, c.value, c.options.secure, c.options.path, c.options.maxAge])).toEqual([
      ['__Secure-authjs.session-token', '', true, '/', 0],
      ['__Secure-authjs.session-token.0', '', true, '/', 0],
      ['authjs.session-token', '', false, '/', 0],
    ]);
  });
});
