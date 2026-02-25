import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  consumeUnsubscribeToken: vi.fn(),
  loggerInfo: vi.fn(),
}));

// Mock unsubscribe-tokens
vi.mock('../../lib/unsubscribe-tokens', () => ({
  consumeUnsubscribeToken: mocks.consumeUnsubscribeToken,
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock api-utils
vi.mock('../../lib/api-utils', () => ({
  handleApiError: vi.fn((_error: Error) => {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }),
  withLogging: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

// Import after mocking
import { POST } from '../../app/api/unsubscribe/route';

describe('POST /api/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful unsubscribe scenarios', () => {
    it('should unsubscribe from important date reminder successfully', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          language: 'en',
        },
        reminderType: 'IMPORTANT_DATE',
        entityId: 'date-1',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reminderType).toBe('IMPORTANT_DATE');
    });

    it('should unsubscribe from contact reminder successfully', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          language: 'en',
        },
        reminderType: 'CONTACT',
        entityId: 'person-1',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reminderType).toBe('CONTACT');
    });

    it('should return 200 status with success response', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          language: 'en',
        },
        reminderType: 'IMPORTANT_DATE',
        entityId: 'date-1',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should log the unsubscribe event', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: true,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          language: 'en',
        },
        reminderType: 'CONTACT',
        entityId: 'person-456',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      });

      await POST(request);

      expect(mocks.loggerInfo).toHaveBeenCalledWith({
        userId: 'user-123',
        reminderType: 'CONTACT',
        entityId: 'person-456',
      }, 'Reminder unsubscribed via email');
    });
  });

  describe('Error scenarios', () => {
    it('should return 400 for missing token', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('MISSING_TOKEN');
    });

    it('should return 400 for invalid token', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: false,
        error: 'INVALID_TOKEN',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_TOKEN');
    });

    it('should return 400 for already used token', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: false,
        error: 'ALREADY_USED',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'used-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('ALREADY_USED');
    });

    it('should return 400 for expired token', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: false,
        error: 'EXPIRED',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'expired-token' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('EXPIRED');
    });

    it('should return appropriate error codes', async () => {
      const errorCodes = ['INVALID_TOKEN', 'ALREADY_USED', 'EXPIRED'];

      for (const errorCode of errorCodes) {
        mocks.consumeUnsubscribeToken.mockResolvedValue({
          success: false,
          error: errorCode,
        });

        const request = new Request('http://localhost/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'test-token' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe(errorCode);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle non-string token gracefully', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 123 }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('MISSING_TOKEN');
    });

    it('should handle null token', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: null }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('MISSING_TOKEN');
    });

    it('should handle undefined token', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: undefined }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('MISSING_TOKEN');
    });

    it('should handle empty string token', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('MISSING_TOKEN');
    });

    it('should handle database errors gracefully', async () => {
      mocks.consumeUnsubscribeToken.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid-token' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle malformed JSON body', async () => {
      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should not log if token consumption fails', async () => {
      mocks.consumeUnsubscribeToken.mockResolvedValue({
        success: false,
        error: 'INVALID_TOKEN',
      });

      const request = new Request('http://localhost/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token' }),
      });

      await POST(request);

      expect(mocks.loggerInfo).not.toHaveBeenCalled();
    });
  });
});
