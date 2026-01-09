import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '@/app/api/user/language/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));
vi.mock('@/lib/locale', () => ({
  isSupportedLocale: (locale: string) => ['en', 'es-ES'].includes(locale),
  setLocaleCookie: vi.fn(),
}));

describe('Language API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT /api/user/language', () => {
    it('should update user language to Spanish', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user1',
        language: 'es-ES',
      } as any);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({ language: 'es-ES' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, language: 'es-ES' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { language: 'es-ES' },
      });
    });

    it('should update user language to English', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: 'user1',
        language: 'en',
      } as any);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({ language: 'en' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, language: 'en' });
    });

    it('should return 401 if not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({ language: 'es-ES' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid language', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({ language: 'fr-FR' }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid language');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 400 if language field is missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return 500 for invalid JSON', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: 'invalid json',
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user1', email: 'test@example.com' },
      } as any);

      vi.mocked(prisma.user.update).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/language', {
        method: 'PUT',
        body: JSON.stringify({ language: 'es-ES' }),
      });

      const response = await PUT(request);

      expect(response.status).toBe(500);
    });
  });
});
