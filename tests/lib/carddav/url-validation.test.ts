import { validateServerUrl } from '@/lib/carddav/url-validation';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import dns from 'dns';

// Mock dns.promises.resolve4 and resolve6 to avoid real DNS lookups in tests
vi.mock('dns', () => ({
  default: {
    promises: {
      resolve4: vi.fn(),
      resolve6: vi.fn(),
    },
  },
  promises: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

const mockResolve4 = dns.promises.resolve4 as ReturnType<typeof vi.fn>;
const mockResolve6 = dns.promises.resolve6 as ReturnType<typeof vi.fn>;

describe('validateServerUrl', () => {
  beforeEach(() => {
    // Default: resolve to a safe public IP (v4), no AAAA records (v6)
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    mockResolve6.mockRejectedValue(new Error('ENODATA'));
  });

  // --- Valid URLs ---

  it('allows HTTPS URLs', async () => {
    await expect(validateServerUrl('https://contacts.google.com')).resolves.toBeUndefined();
  });

  it('allows HTTP URLs', async () => {
    await expect(validateServerUrl('http://my-nextcloud.example.com')).resolves.toBeUndefined();
  });

  it('allows HTTPS URLs with paths', async () => {
    await expect(validateServerUrl('https://example.com/dav/contacts')).resolves.toBeUndefined();
  });

  it('allows HTTPS URLs with ports', async () => {
    await expect(validateServerUrl('https://example.com:8443/dav')).resolves.toBeUndefined();
  });

  it('allows non-private 172.x addresses', async () => {
    await expect(validateServerUrl('https://172.15.0.1')).resolves.toBeUndefined();
    await expect(validateServerUrl('https://172.32.0.1')).resolves.toBeUndefined();
  });

  // --- Private IP ranges ---

  it('rejects private IP 192.168.x.x', async () => {
    await expect(validateServerUrl('https://192.168.1.1')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects private IP 10.x.x.x', async () => {
    await expect(validateServerUrl('https://10.0.0.1')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects private IP 172.16-31.x.x', async () => {
    await expect(validateServerUrl('https://172.16.0.1')).rejects.toThrow('Internal addresses are not allowed');
    await expect(validateServerUrl('https://172.31.255.255')).rejects.toThrow('Internal addresses are not allowed');
  });

  // --- Loopback ---

  it('rejects loopback 127.x.x.x', async () => {
    await expect(validateServerUrl('https://127.0.0.1')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects 127.x.x.x variants', async () => {
    await expect(validateServerUrl('https://127.0.0.2')).rejects.toThrow('Internal addresses are not allowed');
    await expect(validateServerUrl('https://127.255.255.255')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects localhost', async () => {
    await expect(validateServerUrl('https://localhost')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects localhost with port', async () => {
    await expect(validateServerUrl('https://localhost:8080')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects IPv6 loopback', async () => {
    await expect(validateServerUrl('https://[::1]')).rejects.toThrow('Internal addresses are not allowed');
  });

  // --- Link-local ---

  it('rejects link-local 169.254.x.x', async () => {
    await expect(validateServerUrl('https://169.254.1.1')).rejects.toThrow('Internal addresses are not allowed');
  });

  // --- Non-HTTP protocols ---

  it('rejects FTP protocol', async () => {
    await expect(validateServerUrl('ftp://example.com')).rejects.toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects file protocol', async () => {
    await expect(validateServerUrl('file:///etc/passwd')).rejects.toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects javascript protocol', async () => {
    await expect(validateServerUrl('javascript:alert(1)')).rejects.toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects data URIs', async () => {
    await expect(validateServerUrl('data:text/html,<h1>test</h1>')).rejects.toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  // --- Malformed URLs ---

  it('rejects invalid URLs', async () => {
    await expect(validateServerUrl('not-a-url')).rejects.toThrow('Invalid URL format');
  });

  it('rejects empty string', async () => {
    await expect(validateServerUrl('')).rejects.toThrow('Invalid URL format');
  });

  // --- Edge cases ---

  it('rejects 0.0.0.0', async () => {
    await expect(validateServerUrl('https://0.0.0.0')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('handles URLs with userinfo', async () => {
    await expect(validateServerUrl('https://user:pass@example.com/dav')).resolves.toBeUndefined();
  });

  it('handles URLs with embedded credentials targeting private IPs', async () => {
    await expect(validateServerUrl('https://user:pass@192.168.1.1/dav')).rejects.toThrow('Internal addresses are not allowed');
  });

  // --- DNS rebinding protection ---

  it('rejects domains that resolve to private IPs', async () => {
    mockResolve4.mockResolvedValue(['127.0.0.1']);
    await expect(validateServerUrl('https://evil.com')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects domains that resolve to 10.x.x.x', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.1']);
    await expect(validateServerUrl('https://evil.com')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects domains that resolve to 192.168.x.x', async () => {
    mockResolve4.mockResolvedValue(['192.168.1.100']);
    await expect(validateServerUrl('https://evil.com')).rejects.toThrow('Internal addresses are not allowed');
  });

  it('rejects unresolvable hostnames', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(validateServerUrl('https://nonexistent.example.com')).rejects.toThrow('Could not resolve server hostname');
  });

  it('allows domains resolving to public IPs', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    await expect(validateServerUrl('https://example.com')).resolves.toBeUndefined();
  });

  it('rejects if any resolved IP is private', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34', '10.0.0.1']);
    await expect(validateServerUrl('https://dual-homed.example.com')).rejects.toThrow('Internal addresses are not allowed');
  });
});
