import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  sendEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
  },
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
    passwordReset: vi.fn(() => ({
      subject: 'Reset',
      html: '<p>Reset</p>',
      text: 'Reset',
    })),
  },
}));

// Mock rate limit
vi.mock('../../lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  resetRateLimit: vi.fn(),
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  hash: mocks.bcryptHash,
  compare: mocks.bcryptCompare,
  default: {
    hash: mocks.bcryptHash,
    compare: mocks.bcryptCompare,
  },
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import { POST as register } from '../../app/api/auth/register/route';
import { POST as forgotPassword } from '../../app/api/auth/forgot-password/route';

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue(null);
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.bcryptHash.mockResolvedValue('hashed-password');
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const newUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mocks.userFindUnique.mockResolvedValue(null);
      mocks.userCreate.mockResolvedValue(newUser);

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.message).toContain('verify');
      expect(body.user.email).toBe('test@example.com');
      expect(mocks.sendEmail).toHaveBeenCalled();
    });

    it('should reject if email already exists', async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com',
      });

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already exists');
    });

    it('should require email field', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);

      expect(response.status).toBe(400);
    });

    it('should require name field', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123!',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);

      expect(response.status).toBe(400);
    });

    it('should validate password strength', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);

      expect(response.status).toBe(400);
    });

    it('should hash the password before storing', async () => {
      mocks.userFindUnique.mockResolvedValue(null);
      mocks.userCreate.mockResolvedValue({ id: 'user-123', email: 'test@example.com', name: 'Test' });

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await register(request);

      expect(mocks.bcryptHash).toHaveBeenCalledWith('ValidPassword123!', 10);
      expect(mocks.userCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'hashed-password',
          }),
        })
      );
    });

    it('should respect rate limiting', async () => {
      mocks.checkRateLimit.mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many attempts' }), {
          status: 429,
        })
      );

      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await register(request);

      expect(response.status).toBe(429);
      expect(mocks.userCreate).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should send reset email for existing user', async () => {
      mocks.userFindUnique.mockResolvedValue({
        id: 'user-123',
        passwordResetSentAt: null,
      });
      mocks.userUpdate.mockResolvedValue({});

      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(mocks.sendEmail).toHaveBeenCalled();
      expect(body.message).toBeDefined();
    });

    it('should return same response for non-existent user (security)', async () => {
      mocks.userFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);
      const body = await response.json();

      // Should return 200 to not reveal if email exists
      expect(response.status).toBe(200);
      expect(body.message).toBeDefined();
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('should enforce cooldown period', async () => {
      const recentTime = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      mocks.userFindUnique.mockResolvedValue({
        id: 'user-123',
        passwordResetSentAt: recentTime,
      });

      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.retryAfter).toBeDefined();
      expect(mocks.sendEmail).not.toHaveBeenCalled();
    });

    it('should allow reset after cooldown expires', async () => {
      const oldTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      mocks.userFindUnique.mockResolvedValue({
        id: 'user-123',
        passwordResetSentAt: oldTime,
      });
      mocks.userUpdate.mockResolvedValue({});

      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);

      expect(response.status).toBe(200);
      expect(mocks.sendEmail).toHaveBeenCalled();
    });

    it('should require email field', async () => {
      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);

      expect(response.status).toBe(400);
    });

    it('should validate email format', async () => {
      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);

      expect(response.status).toBe(400);
    });

    it('should respect rate limiting', async () => {
      mocks.checkRateLimit.mockReturnValue(
        new Response(JSON.stringify({ error: 'Too many attempts' }), {
          status: 429,
        })
      );

      const request = new Request('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await forgotPassword(request);

      expect(response.status).toBe(429);
    });
  });
});
