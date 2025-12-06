import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('logger functions', () => {
    it('should log debug messages', async () => {
      process.env.LOG_LEVEL = 'debug';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.debug('Debug message');
      expect(consoleSpy.log).toHaveBeenCalled();
      expect(consoleSpy.log.mock.calls[0][0]).toContain('DEBUG');
      expect(consoleSpy.log.mock.calls[0][0]).toContain('Debug message');
    });

    it('should log info messages', async () => {
      process.env.LOG_LEVEL = 'info';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.info('Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
      expect(consoleSpy.log.mock.calls[0][0]).toContain('INFO');
    });

    it('should log warn messages', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('WARN');
    });

    it('should log error messages', async () => {
      process.env.LOG_LEVEL = 'error';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.error.mock.calls[0][0]).toContain('ERROR');
    });

    it('should include context in log output', async () => {
      process.env.LOG_LEVEL = 'info';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.info('Message with context', { userId: '123', action: 'test' });
      expect(consoleSpy.log.mock.calls[0][0]).toContain('userId');
      expect(consoleSpy.log.mock.calls[0][0]).toContain('123');
    });

    it('should include error details in error logs', async () => {
      process.env.LOG_LEVEL = 'error';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      const error = new Error('Test error');
      logger.error('Error occurred', {}, error);
      expect(consoleSpy.error.mock.calls[0][0]).toContain('Test error');
    });

    it('should respect log level - not log debug when level is info', async () => {
      process.env.LOG_LEVEL = 'info';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.debug('Debug message');
      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it('should respect log level - log error when level is warn', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('securityLogger', () => {
    it('should log rate limit exceeded', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login');
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('RATE_LIMIT_EXCEEDED');
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('192.168.1.1');
    });

    it('should log auth failure', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.authFailure('192.168.1.1', 'Invalid credentials');
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('AUTH_FAILURE');
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('Invalid credentials');
    });

    it('should log suspicious activity', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.suspiciousActivity('192.168.1.1', 'Multiple failed logins');
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('SUSPICIOUS_ACTIVITY');
    });

    it('should include additional context', async () => {
      process.env.LOG_LEVEL = 'warn';
      vi.resetModules();
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login', { attempts: 10 });
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('attempts');
    });
  });

  describe('production logging', () => {
    it('should output JSON in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'info';
      vi.resetModules();
      const { logger } = await import('@/lib/logger');

      logger.info('Production message', { data: 'test' });

      const output = consoleSpy.log.mock.calls[0][0];
      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.message).toBe('Production message');
      expect(parsed.level).toBe('info');
      expect(parsed.context.data).toBe('test');
    });
  });
});
