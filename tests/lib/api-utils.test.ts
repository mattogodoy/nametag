import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseRequestBody,
  RequestTooLargeError,
  InvalidJsonError,
  apiResponse,
  handleApiError,
  getClientIp,
  MAX_REQUEST_SIZE,
} from '@/lib/api-utils';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock child logger for createModuleLogger (hoisted so it's available in vi.mock factory)
const mockHttpLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createModuleLogger: vi.fn(() => mockHttpLog),
}));

describe('api-utils', () => {
  describe('parseRequestBody', () => {
    it('should parse valid JSON body', async () => {
      const body = { name: 'John', age: 30 };
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
        },
      });

      const result = await parseRequestBody(request);
      expect(result).toEqual(body);
    });

    it('should reject body exceeding size limit', async () => {
      const largeBody = { data: 'x'.repeat(MAX_REQUEST_SIZE + 1000) };
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(largeBody),
        headers: {
          'content-type': 'application/json',
          'content-length': String(JSON.stringify(largeBody).length),
        },
      });

      await expect(parseRequestBody(request)).rejects.toThrow(RequestTooLargeError);
    });

    it('should reject invalid JSON', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: 'not valid json {{{',
        headers: {
          'content-type': 'application/json',
        },
      });

      await expect(parseRequestBody(request)).rejects.toThrow(InvalidJsonError);
    });

    it('should use custom size limit', async () => {
      const body = { data: 'x'.repeat(600) };
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
        },
      });

      await expect(parseRequestBody(request, 500)).rejects.toThrow(RequestTooLargeError);
    });

    it('should check content-length header first', async () => {
      const request = new Request('http://localhost/api/test', {
        method: 'POST',
        body: 'small body',
        headers: {
          'content-type': 'application/json',
          'content-length': String(MAX_REQUEST_SIZE + 1000),
        },
      });

      await expect(parseRequestBody(request)).rejects.toThrow(RequestTooLargeError);
    });
  });

  describe('apiResponse', () => {
    describe('ok', () => {
      it('should return 200 with data', async () => {
        const response = apiResponse.ok({ users: [] });
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({ users: [] });
      });

      it('should accept custom status', async () => {
        const response = apiResponse.ok({ data: 'test' }, 201);
        expect(response.status).toBe(201);
      });
    });

    describe('created', () => {
      it('should return 201 with data', async () => {
        const response = apiResponse.created({ person: { id: '1' } });
        expect(response.status).toBe(201);

        const body = await response.json();
        expect(body).toEqual({ person: { id: '1' } });
      });
    });

    describe('message', () => {
      it('should return message with 200', async () => {
        const response = apiResponse.message('Success!');
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({ message: 'Success!' });
      });

      it('should accept custom status', async () => {
        const response = apiResponse.message('Created', 201);
        expect(response.status).toBe(201);
      });
    });

    describe('success', () => {
      it('should return success: true', async () => {
        const response = apiResponse.success();
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body).toEqual({ success: true });
      });
    });

    describe('error', () => {
      it('should return 400 with error message', async () => {
        const response = apiResponse.error('Invalid input');
        expect(response.status).toBe(400);

        const body = await response.json();
        expect(body).toEqual({ error: 'Invalid input' });
      });

      it('should accept custom status', async () => {
        const response = apiResponse.error('Not found', 404);
        expect(response.status).toBe(404);
      });
    });

    describe('unauthorized', () => {
      it('should return 401', async () => {
        const response = apiResponse.unauthorized();
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body).toEqual({ error: 'Unauthorized' });
      });

      it('should accept custom message', async () => {
        const response = apiResponse.unauthorized('Session expired');
        const body = await response.json();
        expect(body).toEqual({ error: 'Session expired' });
      });
    });

    describe('forbidden', () => {
      it('should return 403', async () => {
        const response = apiResponse.forbidden();
        expect(response.status).toBe(403);

        const body = await response.json();
        expect(body).toEqual({ error: 'Forbidden' });
      });
    });

    describe('notFound', () => {
      it('should return 404', async () => {
        const response = apiResponse.notFound();
        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body).toEqual({ error: 'Not found' });
      });

      it('should accept custom message', async () => {
        const response = apiResponse.notFound('Person not found');
        const body = await response.json();
        expect(body).toEqual({ error: 'Person not found' });
      });
    });

    describe('payloadTooLarge', () => {
      it('should return 413', async () => {
        const response = apiResponse.payloadTooLarge();
        expect(response.status).toBe(413);

        const body = await response.json();
        expect(body).toEqual({ error: 'Request body too large' });
      });
    });

    describe('serverError', () => {
      it('should return 500', async () => {
        const response = apiResponse.serverError();
        expect(response.status).toBe(500);

        const body = await response.json();
        expect(body).toEqual({ error: 'Internal server error' });
      });

      it('should accept custom message', async () => {
        const response = apiResponse.serverError('Database error');
        const body = await response.json();
        expect(body).toEqual({ error: 'Database error' });
      });
    });
  });

  describe('handleApiError', () => {
    it('should handle RequestTooLargeError', async () => {
      const error = new RequestTooLargeError(1024);
      const response = handleApiError(error, 'test-context');

      expect(response.status).toBe(413);
    });

    it('should handle InvalidJsonError', async () => {
      const error = new InvalidJsonError();
      const response = handleApiError(error, 'test-context');

      expect(response.status).toBe(400);
    });

    it('should handle generic Error', async () => {
      const error = new Error('Something went wrong');
      const response = handleApiError(error, 'test-context');

      expect(response.status).toBe(500);
    });

    it('should handle non-Error objects', async () => {
      const response = handleApiError('string error', 'test-context');
      expect(response.status).toBe(500);
    });

    it('should hide error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';

      const error = new Error('Sensitive error details');
      const response = handleApiError(error, 'test-context');

      const body = await response.json();
      expect(body.error).toBe('Something went wrong');
      expect(body.error).not.toContain('Sensitive');

      (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    });

    it('should show error details in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as { NODE_ENV?: string }).NODE_ENV = 'development';

      const error = new Error('Detailed error message');
      const response = handleApiError(error, 'test-context');

      const body = await response.json();
      expect(body.error).toBe('Detailed error message');

      (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
    });
  });

  describe('getClientIp', () => {
    it('should get IP from x-forwarded-for header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('should get IP from x-real-ip header', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '192.168.1.2',
        },
      });

      expect(getClientIp(request)).toBe('192.168.1.2');
    });

    it('should prefer x-forwarded-for over x-real-ip', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.1',
          'x-real-ip': '192.168.1.2',
        },
      });

      expect(getClientIp(request)).toBe('192.168.1.1');
    });

    it('should return unknown when no IP headers', () => {
      const request = new Request('http://localhost/api/test');
      expect(getClientIp(request)).toBe('unknown');
    });
  });

  describe('withAuth', () => {
    beforeEach(() => {
      vi.resetModules();
      mockHttpLog.debug.mockClear();
      mockHttpLog.info.mockClear();
      mockHttpLog.warn.mockClear();
      mockHttpLog.error.mockClear();
    });

    it('should call handler with session when authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      };
      vi.mocked(auth).mockResolvedValue(mockSession as any);

      // Need to re-import withAuth after mocking auth
      const { withAuth: freshWithAuth, apiResponse: freshApiResponse } = await import('@/lib/api-utils');

      const handler = vi.fn().mockResolvedValue(freshApiResponse.ok({ data: 'test' }));
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(handler).toHaveBeenCalledWith(request, mockSession, undefined);
      expect(response.status).toBe(200);
    });

    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null as never);

      const { withAuth: freshWithAuth } = await import('@/lib/api-utils');

      const handler = vi.fn();
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should return 401 when session has no user id', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({ user: { email: 'test@example.com' } } as any);

      const { withAuth: freshWithAuth } = await import('@/lib/api-utils');

      const handler = vi.fn();
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/test');
      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('should pass context to handler', async () => {
      const { auth } = await import('@/lib/auth');
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      };
      vi.mocked(auth).mockResolvedValue(mockSession as any);

      const { withAuth: freshWithAuth, apiResponse: freshApiResponse } = await import('@/lib/api-utils');

      const handler = vi.fn().mockResolvedValue(freshApiResponse.ok({ data: 'test' }));
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/test');
      const context = { params: Promise.resolve({ id: 'person-123' }) };
      await wrappedHandler(request, context);

      expect(handler).toHaveBeenCalledWith(request, mockSession, context);
    });

    it('should log request with withLogging', async () => {
      const { auth } = await import('@/lib/auth');
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
      };
      vi.mocked(auth).mockResolvedValue(mockSession as any);

      const { withAuth: freshWithAuth, apiResponse: freshApiResponse } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockResolvedValue(freshApiResponse.ok({ data: 'test' }));
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/people');
      await wrappedHandler(request);

      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/people',
          status: 200,
        }),
        expect.stringContaining('GET /api/people 200')
      );
    });

    it('should log 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null as never);

      const { withAuth: freshWithAuth } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn();
      const wrappedHandler = freshWithAuth(handler);

      const request = new Request('http://localhost/api/people');
      await wrappedHandler(request);

      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/people',
          status: 401,
        }),
        expect.stringContaining('GET /api/people 401')
      );
    });
  });

  describe('withLogging', () => {
    beforeEach(() => {
      vi.resetModules();
      mockHttpLog.debug.mockClear();
      mockHttpLog.info.mockClear();
      mockHttpLog.warn.mockClear();
      mockHttpLog.error.mockClear();
    });

    it('should log method, path, status, and duration', async () => {
      const { withLogging } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/people', { method: 'GET' });
      const response = await wrapped(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalledWith(request, undefined);
      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/people',
          status: 200,
        }),
        expect.stringContaining('GET /api/people 200')
      );
    });

    it('should log error status when handler returns error', async () => {
      const { withLogging, apiResponse: freshApiResponse } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockResolvedValue(freshApiResponse.notFound('Not found'));
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/people/123', { method: 'GET' });
      await wrapped(request);

      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/people/123',
          status: 404,
        }),
        expect.stringContaining('GET /api/people/123 404')
      );
    });

    it('should log 500 and re-throw when handler throws', async () => {
      const { withLogging } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/test', { method: 'POST' });
      await expect(wrapped(request)).rejects.toThrow('boom');

      expect(httpLog.error).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/api/test',
          status: 500,
        }),
        expect.stringContaining('POST /api/test 500')
      );
    });

    it('should pass context through to handler', async () => {
      const { withLogging } = await import('@/lib/api-utils');

      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/people/123', { method: 'GET' });
      const context = { params: Promise.resolve({ id: '123' }) };
      await wrapped(request, context);

      expect(handler).toHaveBeenCalledWith(request, context);
    });

    it('should include durationMs in log', async () => {
      const { withLogging } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/test', { method: 'GET' });
      await wrapped(request);

      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
        expect.any(String)
      );
    });

    it('should include IP in log', async () => {
      const { withLogging } = await import('@/lib/api-utils');
      const { createModuleLogger } = await import('@/lib/logger');
      const httpLog = createModuleLogger('http');

      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withLogging(handler);

      const request = new Request('http://localhost/api/test', {
        method: 'GET',
        headers: { 'x-forwarded-for': '1.2.3.4' },
      });
      await wrapped(request);

      expect(httpLog.info).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '1.2.3.4' }),
        expect.any(String)
      );
    });
  });

  describe('MAX_REQUEST_SIZE', () => {
    it('should be 1MB', () => {
      expect(MAX_REQUEST_SIZE).toBe(1 * 1024 * 1024);
    });
  });
});
