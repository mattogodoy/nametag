import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserLocale, detectBrowserLocale, isSupportedLocale, normalizeLocale } from '@/lib/locale';
import { prisma } from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

describe('Locale Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isSupportedLocale', () => {
    it('should return true for "en"', () => {
      expect(isSupportedLocale('en')).toBe(true);
    });

    it('should return true for "es-ES"', () => {
      expect(isSupportedLocale('es-ES')).toBe(true);
    });

    it('should return true for "ja-JP"', () => {
      expect(isSupportedLocale('ja-JP')).toBe(true);
    });

    it('should return false for unsupported locales', () => {
      expect(isSupportedLocale('fr-FR')).toBe(false);
      expect(isSupportedLocale('de')).toBe(false);
    });
  });

  describe('normalizeLocale', () => {
    it('should pass through exact matches', () => {
      expect(normalizeLocale('en')).toBe('en');
      expect(normalizeLocale('es-ES')).toBe('es-ES');
      expect(normalizeLocale('ja-JP')).toBe('ja-JP');
    });

    it('should map "es" to "es-ES"', () => {
      expect(normalizeLocale('es')).toBe('es-ES');
    });

    it('should map "en-US" to "en"', () => {
      expect(normalizeLocale('en-US')).toBe('en');
    });

    it('should map "ja" to "ja-JP"', () => {
      expect(normalizeLocale('ja')).toBe('ja-JP');
    });

    it('should default to "en" for unsupported locales', () => {
      expect(normalizeLocale('fr-FR')).toBe('en');
      expect(normalizeLocale('de')).toBe('en');
    });
  });

  describe('getUserLocale', () => {
    it('should return user language preference if set', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user1',
        language: 'es-ES',
        email: 'test@example.com',
        password: 'hash',
        emailVerified: false,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        emailVerifySentAt: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordResetSentAt: null,
        lastLoginAt: null,
        provider: null,
        providerAccountId: null,
        name: '',
        surname: null,
        nickname: null,
        theme: 'LIGHT',
        dateFormat: 'MDY',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const locale = await getUserLocale('user1');

      expect(locale).toBe('es-ES');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
        select: { language: true },
      });
    });

    it('should return "en" if user language is not set', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user1',
        language: null,
        email: 'test@example.com',
        password: 'hash',
        emailVerified: false,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        emailVerifySentAt: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordResetSentAt: null,
        lastLoginAt: null,
        provider: null,
        providerAccountId: null,
        name: '',
        surname: null,
        nickname: null,
        theme: 'LIGHT',
        dateFormat: 'MDY',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { cookies, headers } = await import('next/headers');
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);

      const locale = await getUserLocale('user1');

      expect(locale).toBe('en');
    });

    it('should return "en" if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const { cookies, headers } = await import('next/headers');
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);

      const locale = await getUserLocale('user1');

      expect(locale).toBe('en');
    });

    it('should return "en" if no userId provided', async () => {
      const { cookies, headers } = await import('next/headers');
      vi.mocked(cookies).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);

      const locale = await getUserLocale();

      expect(locale).toBe('en');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('detectBrowserLocale', () => {
    it('should detect Spanish from Accept-Language header', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('es-ES,es;q=0.9,en;q=0.8'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('es-ES');
    });

    it('should map "es" to "es-ES"', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('es,en;q=0.9'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('es-ES');
    });

    it('should detect English from Accept-Language header', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('en-US,en;q=0.9'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('en');
    });

    it('should detect Japanese from Accept-Language header', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('ja-JP,ja;q=0.9,en;q=0.8'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('ja-JP');
    });

    it('should map "ja" to "ja-JP"', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('ja,en;q=0.9'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('ja-JP');
    });

    it('should default to "en" for unsupported languages', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('fr-FR,fr;q=0.9'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('en');
    });

    it('should default to "en" if no header provided', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue(null),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('en');
    });

    it('should default to "en" if header is empty', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue(''),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('en');
    });

    it('should handle complex Accept-Language headers', async () => {
      const { headers } = await import('next/headers');
      vi.mocked(headers).mockResolvedValue({
        get: vi.fn().mockReturnValue('fr-FR,fr;q=0.9,es-ES;q=0.8,es;q=0.7,en;q=0.6'),
      } as any);

      const locale = await detectBrowserLocale();

      expect(locale).toBe('es-ES');
    });
  });
});
