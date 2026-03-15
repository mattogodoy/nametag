import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSaasMode: vi.fn(),
}));

vi.mock('@/lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

import { downloadPhoto } from '@/lib/photo-storage';

describe('downloadPhoto SSRF protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject private IP URLs in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('http://192.168.1.1/photo.jpg')).rejects.toThrow(/internal/i);
  });

  it('should reject localhost URLs in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('http://localhost/photo.jpg')).rejects.toThrow(/internal/i);
  });

  it('should reject non-HTTP protocols', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    await expect(downloadPhoto('ftp://example.com/photo.jpg')).rejects.toThrow();
  });
});
