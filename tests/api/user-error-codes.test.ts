import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  compare: vi.fn(),
  savePhoto: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update, delete: vi.fn() } },
}));
vi.mock('@/lib/session-invalidation', () => ({ invalidateUserSessions: vi.fn() }));
vi.mock('bcryptjs', () => ({ compare: mocks.compare, hash: vi.fn(async () => 'h') }));
vi.mock('@/lib/photo-storage', () => ({
  savePhotoFromBuffer: mocks.savePhoto,
  deletePersonPhotos: vi.fn(),
}));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), emailTemplates: {} }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) =>
        handler(req, { user: { id: 'u1' }, authMethod: 'session' }, { params: Promise.resolve({}) }),
  };
});
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { PUT as changePassword } from '@/app/api/user/password/route';
import { DELETE as deleteAccount } from '@/app/api/user/delete/route';
import { PUT as updateProfile } from '@/app/api/user/profile/route';
import { POST as uploadPhoto } from '@/app/api/user/photo/route';

const jsonReq = (method: string, body: unknown) =>
  new Request('http://localhost/api/user/x', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('user routes: error codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('password change for an OAuth account is oauth_account_no_password', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', password: null });
    const res = await changePassword(jsonReq('PUT', { currentPassword: 'x', newPassword: 'New1!passw' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Cannot change password for OAuth accounts',
      code: 'oauth_account_no_password',
    });
  });

  it('password change with the wrong current password is wrong_password', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    mocks.compare.mockResolvedValue(false);
    const res = await changePassword(jsonReq('PUT', { currentPassword: 'x', newPassword: 'New1!passw' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Current password is incorrect', code: 'wrong_password' });
  });

  it('delete without the DELETE text is invalid_confirmation', async () => {
    const res = await deleteAccount(jsonReq('DELETE', { confirmationText: 'nope' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Confirmation text must be "DELETE"',
      code: 'invalid_confirmation',
    });
  });

  it('delete without a password is password_required', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    const res = await deleteAccount(jsonReq('DELETE', { confirmationText: 'DELETE' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Password is required', code: 'password_required' });
  });

  it('delete with the wrong password is wrong_password', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', password: 'hash' });
    mocks.compare.mockResolvedValue(false);
    const res = await deleteAccount(jsonReq('DELETE', { confirmationText: 'DELETE', password: 'bad' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Password is incorrect', code: 'wrong_password' });
  });

  it('profile update with a taken email is email_in_use with 409', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'someone-else' });
    const res = await updateProfile(jsonReq('PUT', { name: 'A', email: 'taken@example.com' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Email already in use', code: 'email_in_use' });
  });

  it('photo upload with no file is photo_missing', async () => {
    const res = await uploadPhoto(
      new Request('http://localhost/api/user/photo', { method: 'POST', body: new FormData() })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No photo file provided', code: 'photo_missing' });
  });

  it('photo upload over the limit is photo_too_large with maxBytes and 413', async () => {
    const formData = new FormData();
    formData.append('photo', new Blob([new ArrayBuffer(51 * 1024 * 1024)], { type: 'image/jpeg' }));
    const res = await uploadPhoto(
      new Request('http://localhost/api/user/photo', { method: 'POST', body: formData })
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({
      error: 'Photo exceeds maximum size of 50MB',
      code: 'photo_too_large',
      params: { maxBytes: 50 * 1024 * 1024 },
    });
    expect(mocks.savePhoto).not.toHaveBeenCalled();
  });
});
