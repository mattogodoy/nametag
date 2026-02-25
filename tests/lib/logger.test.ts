import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pino at the module level
const mockChild = vi.fn();
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockFatal = vi.fn();

const mockChildDebug = vi.fn();
const mockChildInfo = vi.fn();
const mockChildWarn = vi.fn();
const mockChildError = vi.fn();
const mockChildFatal = vi.fn();
const mockChildChild = vi.fn();

const mockChildLogger = {
  debug: mockChildDebug,
  info: mockChildInfo,
  warn: mockChildWarn,
  error: mockChildError,
  fatal: mockChildFatal,
  child: mockChildChild,
};

mockChild.mockReturnValue(mockChildLogger);
mockChildChild.mockReturnValue({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  fatal: vi.fn(),
  child: vi.fn(),
});

const mockPinoFn = vi.fn(() => ({
  debug: mockDebug,
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
  fatal: mockFatal,
  child: mockChild,
}));

// Attach stdTimeFunctions to the mock
const mockPino = Object.assign(mockPinoFn, {
  stdTimeFunctions: {
    isoTime: () => `,"time":"${new Date().toISOString()}"`,
    epochTime: () => `,"time":${Date.now()}`,
    unixTime: () => `,"time":${Math.round(Date.now() / 1000)}`,
    nullTime: () => '',
  },
});

vi.mock('pino', () => ({
  default: mockPino,
}));

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the child mock to return the mockChildLogger
    mockChild.mockReturnValue(mockChildLogger);
  });

  describe('logger base instance', () => {
    it('should have debug method', async () => {
      vi.resetModules();
      // Re-apply mock after resetModules
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });

    it('should have info method', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have warn method', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have error method', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should call pino info with object and message', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');

      logger.info({ key: 'value' }, 'test message');
      expect(mockInfo).toHaveBeenCalledWith({ key: 'value' }, 'test message');
    });

    it('should call pino error with err and message', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { logger } = await import('@/lib/logger');

      const err = new Error('something broke');
      logger.error({ err }, 'error occurred');
      expect(mockError).toHaveBeenCalledWith({ err }, 'error occurred');
    });
  });

  describe('createModuleLogger', () => {
    it('should call logger.child with module context', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { createModuleLogger } = await import('@/lib/logger');

      createModuleLogger('carddav');
      expect(mockChild).toHaveBeenCalledWith({ module: 'carddav' });
    });

    it('should return the child logger', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { createModuleLogger } = await import('@/lib/logger');

      const childLogger = createModuleLogger('auth');
      expect(childLogger).toBe(mockChildLogger);
    });
  });

  describe('securityLogger', () => {
    it('should call warn with correct context for rateLimitExceeded', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login');
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'RATE_LIMIT_EXCEEDED', ip: '192.168.1.1', endpoint: '/api/auth/login' },
        'Rate limit exceeded'
      );
    });

    it('should call warn with correct context for authFailure', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.authFailure('10.0.0.1', 'Invalid credentials');
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'AUTH_FAILURE', ip: '10.0.0.1', reason: 'Invalid credentials' },
        'Authentication failure'
      );
    });

    it('should call warn with correct context for suspiciousActivity', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.suspiciousActivity('10.0.0.2', 'Multiple failed logins');
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'SUSPICIOUS_ACTIVITY', ip: '10.0.0.2', activity: 'Multiple failed logins' },
        'Suspicious activity detected'
      );
    });

    it('should pass additional context through for rateLimitExceeded', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.rateLimitExceeded('192.168.1.1', '/api/auth/login', { attempts: 10 });
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'RATE_LIMIT_EXCEEDED', ip: '192.168.1.1', endpoint: '/api/auth/login', attempts: 10 },
        'Rate limit exceeded'
      );
    });

    it('should pass additional context through for authFailure', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.authFailure('10.0.0.1', 'Invalid token', { userId: 'abc123' });
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'AUTH_FAILURE', ip: '10.0.0.1', reason: 'Invalid token', userId: 'abc123' },
        'Authentication failure'
      );
    });

    it('should pass additional context through for suspiciousActivity', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      const { securityLogger } = await import('@/lib/logger');

      securityLogger.suspiciousActivity('10.0.0.2', 'SQL injection attempt', { path: '/api/users' });
      expect(mockChildWarn).toHaveBeenCalledWith(
        { type: 'SUSPICIOUS_ACTIVITY', ip: '10.0.0.2', activity: 'SQL injection attempt', path: '/api/users' },
        'Suspicious activity detected'
      );
    });

    it('should use a child logger with module security', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      // The security logger is created during module initialization
      // by calling logger.child({ module: 'security' })
      expect(mockChild).toHaveBeenCalledWith({ module: 'security' });
    });
  });

  describe('pino configuration', () => {
    function getLastPinoOptions(): any {
      const calls = mockPino.mock.calls as any[];
      return calls[calls.length - 1]?.[0];
    }

    it('should default log level to info when LOG_LEVEL is not set', async () => {
      vi.resetModules();
      delete process.env.LOG_LEVEL;
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      expect(mockPino).toHaveBeenCalled();
      const options = getLastPinoOptions();
      expect(options.level).toBe('info');
    });

    it('should use LOG_LEVEL env var when set', async () => {
      vi.resetModules();
      process.env.LOG_LEVEL = 'debug';
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.level).toBe('debug');
      delete process.env.LOG_LEVEL;
    });

    it('should use ISO timestamp format', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.timestamp).toBe(mockPino.stdTimeFunctions.isoTime);
    });

    it('should configure pino-pretty transport in non-production', async () => {
      vi.resetModules();
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.transport).toEqual({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      });
      (process.env as any).NODE_ENV = originalNodeEnv;
    });

    it('should not configure transport in production', async () => {
      vi.resetModules();
      const originalNodeEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'production';
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.transport).toBeUndefined();
      (process.env as any).NODE_ENV = originalNodeEnv;
    });

    it('should have formatters with level formatter', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.formatters).toBeDefined();
      expect(options.formatters.level).toBeDefined();
    });

    it('should format level as label string', async () => {
      vi.resetModules();
      vi.doMock('pino', () => ({ default: mockPino }));
      await import('@/lib/logger');

      const options = getLastPinoOptions();
      expect(options.formatters.level('info')).toEqual({ level: 'info' });
      expect(options.formatters.level('error')).toEqual({ level: 'error' });
    });
  });
});
