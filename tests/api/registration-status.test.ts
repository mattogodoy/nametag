import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  userCount: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      count: mocks.userCount,
    },
  },
}));

// Mock api-utils (withLogging is a passthrough so it doesn't affect test behavior)
vi.mock('../../lib/api-utils', () => ({
  handleApiError: vi.fn((error: Error) => {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }),
  withLogging: vi.fn((fn: Function) => fn),
}));

// Import after mocking
import { GET as registrationStatus } from '../../app/api/auth/registration-status/route';

describe('Registration Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.DISABLE_REGISTRATION;
  });

  describe('GET /api/auth/registration-status', () => {
    it('should return enabled when DISABLE_REGISTRATION is not set', async () => {
      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.enabled).toBe(true);
      expect(body.message).toBeUndefined();
      expect(mocks.userCount).not.toHaveBeenCalled();
    });

    it('should return enabled when DISABLE_REGISTRATION is false', async () => {
      process.env.DISABLE_REGISTRATION = 'false';

      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.enabled).toBe(true);
      expect(body.message).toBeUndefined();
      expect(mocks.userCount).not.toHaveBeenCalled();
    });

    it('should return enabled when DISABLE_REGISTRATION is true but no users exist', async () => {
      process.env.DISABLE_REGISTRATION = 'true';
      mocks.userCount.mockResolvedValue(0);

      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.enabled).toBe(true);
      expect(body.message).toBeUndefined();
      expect(mocks.userCount).toHaveBeenCalled();
    });

    it('should return disabled when DISABLE_REGISTRATION is true and users exist', async () => {
      process.env.DISABLE_REGISTRATION = 'true';
      mocks.userCount.mockResolvedValue(1);

      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.enabled).toBe(false);
      expect(body.message).toBe('Registration is currently disabled');
      expect(mocks.userCount).toHaveBeenCalled();
    });

    it('should return disabled when DISABLE_REGISTRATION is true and multiple users exist', async () => {
      process.env.DISABLE_REGISTRATION = 'true';
      mocks.userCount.mockResolvedValue(5);

      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.enabled).toBe(false);
      expect(body.message).toBe('Registration is currently disabled');
      expect(mocks.userCount).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      process.env.DISABLE_REGISTRATION = 'true';
      mocks.userCount.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost/api/auth/registration-status');
      const response = await registrationStatus(request);

      expect(response.status).toBe(500);
    });
  });
});
