import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sendEmail: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

// Mock auth
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Mock email
vi.mock('../../lib/email', () => ({
  sendEmail: mocks.sendEmail,
  emailTemplates: {
    accountVerification: vi.fn(() => ({
      subject: 'Verify',
      html: '<p>Verify</p>',
      text: 'Verify',
    })),
  },
}));

// Import after mocking
import { PUT as updateProfile } from '../../app/api/user/profile/route';
import { PUT as updateTheme } from '../../app/api/user/theme/route';
import { PUT as updateDateFormat } from '../../app/api/user/date-format/route';

describe('User Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile without email change', async () => {
      const updatedUser = {
        id: 'user-123',
        name: 'Updated Name',
        surname: 'Smith',
        email: 'test@example.com',
      };

      mocks.userFindUnique.mockResolvedValueOnce(null); // Check email not taken
      mocks.userFindUnique.mockResolvedValueOnce({ email: 'test@example.com' }); // Current user
      mocks.userUpdate.mockResolvedValue(updatedUser);

      const request = new Request('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          surname: 'Smith',
          email: 'test@example.com',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateProfile(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user).toEqual(updatedUser);
      expect(body.emailChanged).toBe(false);
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('should send verification email when email changes', async () => {
      mocks.userFindUnique.mockResolvedValueOnce(null); // Email not taken
      mocks.userFindUnique.mockResolvedValueOnce({ email: 'old@example.com' }); // Current user
      mocks.userUpdate.mockResolvedValue({ id: 'user-123' });
      mocks.sendEmail.mockResolvedValue({ success: true });

      const request = new Request('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Test',
          email: 'new@example.com',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateProfile(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.emailChanged).toBe(true);
      expect(mocks.sendEmail).toHaveBeenCalled();
      expect(mocks.userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: false,
          }),
        })
      );
    });

    it('should reject if email already taken by another user', async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: 'other-user',
        email: 'taken@example.com',
      });

      const request = new Request('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Test',
          email: 'taken@example.com',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateProfile(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already in use');
    });

    it('should require name field', async () => {
      const request = new Request('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateProfile(request);

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const request = new Request('http://localhost/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Test',
          email: 'not-an-email',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateProfile(request);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/user/theme', () => {
    it('should update theme to DARK', async () => {
      const updatedUser = { id: 'user-123', theme: 'DARK' };
      mocks.userUpdate.mockResolvedValue(updatedUser);

      const request = new Request('http://localhost/api/user/theme', {
        method: 'PUT',
        body: JSON.stringify({ theme: 'DARK' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateTheme(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user.theme).toBe('DARK');
    });

    it('should update theme to LIGHT', async () => {
      const updatedUser = { id: 'user-123', theme: 'LIGHT' };
      mocks.userUpdate.mockResolvedValue(updatedUser);

      const request = new Request('http://localhost/api/user/theme', {
        method: 'PUT',
        body: JSON.stringify({ theme: 'LIGHT' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateTheme(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user.theme).toBe('LIGHT');
    });

    it('should reject invalid theme value', async () => {
      const request = new Request('http://localhost/api/user/theme', {
        method: 'PUT',
        body: JSON.stringify({ theme: 'invalid' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateTheme(request);

      expect(response.status).toBe(400);
    });

    it('should reject lowercase theme values', async () => {
      const request = new Request('http://localhost/api/user/theme', {
        method: 'PUT',
        body: JSON.stringify({ theme: 'dark' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateTheme(request);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/user/date-format', () => {
    it('should update date format to DMY', async () => {
      const updatedUser = { id: 'user-123', dateFormat: 'DMY' };
      mocks.userUpdate.mockResolvedValue(updatedUser);

      const request = new Request('http://localhost/api/user/date-format', {
        method: 'PUT',
        body: JSON.stringify({ dateFormat: 'DMY' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateDateFormat(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.user.dateFormat).toBe('DMY');
    });

    it('should update date format to MDY', async () => {
      mocks.userUpdate.mockResolvedValue({ id: 'user-123', dateFormat: 'MDY' });

      const request = new Request('http://localhost/api/user/date-format', {
        method: 'PUT',
        body: JSON.stringify({ dateFormat: 'MDY' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateDateFormat(request);

      expect(response.status).toBe(200);
    });

    it('should update date format to YMD', async () => {
      mocks.userUpdate.mockResolvedValue({ id: 'user-123', dateFormat: 'YMD' });

      const request = new Request('http://localhost/api/user/date-format', {
        method: 'PUT',
        body: JSON.stringify({ dateFormat: 'YMD' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateDateFormat(request);

      expect(response.status).toBe(200);
    });

    it('should reject invalid date format value', async () => {
      const request = new Request('http://localhost/api/user/date-format', {
        method: 'PUT',
        body: JSON.stringify({ dateFormat: 'invalid-format' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await updateDateFormat(request);

      expect(response.status).toBe(400);
    });
  });
});
