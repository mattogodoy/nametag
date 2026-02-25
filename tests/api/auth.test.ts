import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  userCount: vi.fn(),
  sendEmail: vi.fn(),
  checkRateLimitAsync: vi.fn(), // For rate-limit-redis (async)
  checkRateLimitSync: vi.fn(),  // For rate-limit (sync)
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
  isFeatureEnabled: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      update: mocks.userUpdate,
      count: mocks.userCount,
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

// Mock rate limit - must match the actual import paths
// register uses rate-limit-redis (async)
vi.mock('../../lib/rate-limit-redis', () => ({
  checkRateLimit: mocks.checkRateLimitAsync,
  resetRateLimit: vi.fn(),
}));

// forgot-password uses rate-limit (sync)
vi.mock('../../lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimitSync,
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
  securityLogger: {
    rateLimitExceeded: vi.fn(),
    suspiciousActivity: vi.fn(),
    authenticationFailure: vi.fn(),
    authenticationSuccess: vi.fn(),
  },
  createModuleLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock billing
vi.mock('../../lib/billing', () => ({
  createFreeSubscription: vi.fn(() => Promise.resolve({ id: 'sub-1', tier: 'FREE' })),
}));

// Mock relationship types
vi.mock('../../lib/relationship-types', () => ({
  createPreloadedRelationshipTypes: vi.fn(() => Promise.resolve()),
}));

// Mock features
vi.mock('../../lib/features', () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
  isSaasMode: vi.fn(() => mocks.isFeatureEnabled('emailVerification')),
}));

// Import after mocking
import { POST as register } from '../../app/api/auth/register/route';
import { POST as forgotPassword } from '../../app/api/auth/forgot-password/route';

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Async rate limit (for register)
    mocks.checkRateLimitAsync.mockResolvedValue(null);
    // Sync rate limit (for forgot-password)
    mocks.checkRateLimitSync.mockReturnValue(null);
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.bcryptHash.mockResolvedValue('hashed-password');
    // Default to SaaS mode (email verification enabled) for backwards compatibility
    mocks.isFeatureEnabled.mockReturnValue(true);
    // Reset environment variable
    delete process.env.DISABLE_REGISTRATION;
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
      mocks.checkRateLimitAsync.mockResolvedValueOnce(
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

    describe('Self-Hosted Mode (email verification disabled)', () => {
      beforeEach(() => {
        // Disable email verification for self-hosted mode
        mocks.isFeatureEnabled.mockReturnValue(false);
      });

      it('should auto-verify users in self-hosted mode', async () => {
        const newUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true,
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
        expect(body.message).toContain('can now log in');
        expect(body.message).not.toContain('verify');
        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              emailVerified: true,
              emailVerifyToken: null,
            }),
          })
        );
      });

      it('should not send verification email in self-hosted mode', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        await register(request);

        expect(mocks.sendEmail).not.toHaveBeenCalled();
      });

      it('should not generate verification token in self-hosted mode', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        await register(request);

        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              emailVerifyToken: null,
              emailVerifyExpires: null,
            }),
          })
        );
      });
    });

    describe('SaaS Mode (email verification enabled)', () => {
      beforeEach(() => {
        // Enable email verification for SaaS mode
        mocks.isFeatureEnabled.mockReturnValue(true);
      });

      it('should require email verification in SaaS mode', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        expect(response.status).toBe(201);
        expect(body.message).toContain('verify');
        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              emailVerified: false,
            }),
          })
        );
      });

      it('should send verification email in SaaS mode', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        await register(request);

        expect(mocks.sendEmail).toHaveBeenCalled();
      });

      it('should generate verification token in SaaS mode', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        await register(request);

        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              emailVerifyToken: expect.any(String),
              emailVerifyExpires: expect.any(Date),
            }),
          })
        );
      });
    });

    describe('DISABLE_REGISTRATION Feature', () => {
      it('should allow registration when DISABLE_REGISTRATION is not set', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        expect(response.status).toBe(201);
        expect(mocks.userCount).not.toHaveBeenCalled();
      });

      it('should allow registration when DISABLE_REGISTRATION is false', async () => {
        process.env.DISABLE_REGISTRATION = 'false';
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        expect(response.status).toBe(201);
        expect(mocks.userCount).not.toHaveBeenCalled();
      });

      it('should allow first user when DISABLE_REGISTRATION is true and no users exist', async () => {
        process.env.DISABLE_REGISTRATION = 'true';
        mocks.userCount.mockResolvedValue(0);
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
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

        expect(response.status).toBe(201);
        expect(mocks.userCount).toHaveBeenCalled();
        expect(body.user.email).toBe('test@example.com');
      });

      it('should block registration when DISABLE_REGISTRATION is true and users exist', async () => {
        process.env.DISABLE_REGISTRATION = 'true';
        mocks.userCount.mockResolvedValue(1);

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

        expect(response.status).toBe(403);
        expect(body.error).toBe('Registration is currently disabled');
        expect(mocks.userCreate).not.toHaveBeenCalled();
        expect(mocks.userFindUnique).not.toHaveBeenCalled();
      });

      it('should block registration when DISABLE_REGISTRATION is true and multiple users exist', async () => {
        process.env.DISABLE_REGISTRATION = 'true';
        mocks.userCount.mockResolvedValue(5);

        const request = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'second.user@example.com',
            password: 'ValidPassword123!',
            name: 'Second User',
          }),
          headers: { 'content-type': 'application/json' },
        });

        const response = await register(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe('Registration is currently disabled');
        expect(mocks.userCreate).not.toHaveBeenCalled();
      });

      it('should check user count before rate limiting when DISABLE_REGISTRATION is true', async () => {
        process.env.DISABLE_REGISTRATION = 'true';
        mocks.userCount.mockResolvedValue(1);

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

        expect(response.status).toBe(403);
        // Should block before validation, so rate limit should still be called
        expect(mocks.checkRateLimitAsync).toHaveBeenCalled();
      });
    });

    describe('Email Case Sensitivity', () => {
      it('should normalize email to lowercase during registration', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        });

        const request = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'Bob@Test.COM',
            password: 'ValidPassword123!',
            name: 'Test User',
          }),
          headers: { 'content-type': 'application/json' },
        });

        await register(request);

        // Check that email was normalized before lookup
        expect(mocks.userFindUnique).toHaveBeenCalledWith({
          where: { email: 'bob@test.com' },
        });

        // Check that email was normalized before storage
        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'bob@test.com',
            }),
          })
        );
      });

      it('should prevent duplicate registration with different email case', async () => {
        // Simulate existing user with lowercase email
        mocks.userFindUnique.mockResolvedValue({
          id: 'existing-user',
          email: 'test@example.com',
        });

        const request = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'Test@Example.COM',
            password: 'ValidPassword123!',
            name: 'Test User',
          }),
          headers: { 'content-type': 'application/json' },
        });

        const response = await register(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('already exists');
        expect(mocks.userFindUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('should handle all uppercase email', async () => {
        mocks.userFindUnique.mockResolvedValue(null);
        mocks.userCreate.mockResolvedValue({
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
        });

        const request = new Request('http://localhost/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email: 'USER@EXAMPLE.COM',
            password: 'ValidPassword123!',
            name: 'Test User',
          }),
          headers: { 'content-type': 'application/json' },
        });

        await register(request);

        // Should normalize to lowercase
        expect(mocks.userFindUnique).toHaveBeenCalledWith({
          where: { email: 'user@example.com' },
        });
        expect(mocks.userCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              email: 'user@example.com',
            }),
          })
        );
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should respect rate limiting', async () => {
      // Override the mock just for this test
      mocks.checkRateLimitSync.mockReturnValueOnce(
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

    describe('Email Case Sensitivity', () => {
      it('should normalize email to lowercase when looking up user', async () => {
        mocks.userFindUnique.mockResolvedValue({
          id: 'user-123',
          passwordResetSentAt: null,
        });
        mocks.userUpdate.mockResolvedValue({});

        const request = new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: 'Test@Example.COM' }),
          headers: { 'content-type': 'application/json' },
        });

        await forgotPassword(request);

        // Check that email was normalized before lookup
        expect(mocks.userFindUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
          select: {
            id: true,
            passwordResetSentAt: true,
          },
        });
      });

      it('should send reset email to normalized address', async () => {
        mocks.userFindUnique.mockResolvedValue({
          id: 'user-123',
          passwordResetSentAt: null,
        });
        mocks.userUpdate.mockResolvedValue({});

        const request = new Request('http://localhost/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: 'Admin@Company.COM' }),
          headers: { 'content-type': 'application/json' },
        });

        await forgotPassword(request);

        expect(mocks.sendEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: 'admin@company.com',
          })
        );
      });
    });
  });
});
