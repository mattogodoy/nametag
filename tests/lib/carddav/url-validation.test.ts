import { validateServerUrl } from '@/lib/carddav/url-validation';
import { describe, it, expect } from 'vitest';

describe('validateServerUrl', () => {
  // --- Valid URLs ---

  it('allows HTTPS URLs', () => {
    expect(() => validateServerUrl('https://contacts.google.com')).not.toThrow();
  });

  it('allows HTTP URLs', () => {
    expect(() => validateServerUrl('http://my-nextcloud.example.com')).not.toThrow();
  });

  it('allows HTTPS URLs with paths', () => {
    expect(() => validateServerUrl('https://example.com/dav/contacts')).not.toThrow();
  });

  it('allows HTTPS URLs with ports', () => {
    expect(() => validateServerUrl('https://example.com:8443/dav')).not.toThrow();
  });

  it('allows non-private 172.x addresses', () => {
    expect(() => validateServerUrl('https://172.15.0.1')).not.toThrow();
    expect(() => validateServerUrl('https://172.32.0.1')).not.toThrow();
  });

  // --- Private IP ranges ---

  it('rejects private IP 192.168.x.x', () => {
    expect(() => validateServerUrl('https://192.168.1.1')).toThrow('Internal addresses are not allowed');
  });

  it('rejects private IP 10.x.x.x', () => {
    expect(() => validateServerUrl('https://10.0.0.1')).toThrow('Internal addresses are not allowed');
  });

  it('rejects private IP 172.16-31.x.x', () => {
    expect(() => validateServerUrl('https://172.16.0.1')).toThrow('Internal addresses are not allowed');
    expect(() => validateServerUrl('https://172.31.255.255')).toThrow('Internal addresses are not allowed');
  });

  // --- Loopback ---

  it('rejects loopback 127.x.x.x', () => {
    expect(() => validateServerUrl('https://127.0.0.1')).toThrow('Internal addresses are not allowed');
  });

  it('rejects 127.x.x.x variants', () => {
    expect(() => validateServerUrl('https://127.0.0.2')).toThrow('Internal addresses are not allowed');
    expect(() => validateServerUrl('https://127.255.255.255')).toThrow('Internal addresses are not allowed');
  });

  it('rejects localhost', () => {
    expect(() => validateServerUrl('https://localhost')).toThrow('Internal addresses are not allowed');
  });

  it('rejects localhost with port', () => {
    expect(() => validateServerUrl('https://localhost:8080')).toThrow('Internal addresses are not allowed');
  });

  it('rejects IPv6 loopback', () => {
    expect(() => validateServerUrl('https://[::1]')).toThrow('Internal addresses are not allowed');
  });

  // --- Link-local ---

  it('rejects link-local 169.254.x.x', () => {
    expect(() => validateServerUrl('https://169.254.1.1')).toThrow('Internal addresses are not allowed');
  });

  // --- Non-HTTP protocols ---

  it('rejects FTP protocol', () => {
    expect(() => validateServerUrl('ftp://example.com')).toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects file protocol', () => {
    expect(() => validateServerUrl('file:///etc/passwd')).toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects javascript protocol', () => {
    expect(() => validateServerUrl('javascript:alert(1)')).toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  it('rejects data URIs', () => {
    expect(() => validateServerUrl('data:text/html,<h1>test</h1>')).toThrow('Only HTTP and HTTPS protocols are allowed');
  });

  // --- Malformed URLs ---

  it('rejects invalid URLs', () => {
    expect(() => validateServerUrl('not-a-url')).toThrow('Invalid URL format');
  });

  it('rejects empty string', () => {
    expect(() => validateServerUrl('')).toThrow('Invalid URL format');
  });

  // --- Edge cases ---

  it('rejects 0.0.0.0', () => {
    expect(() => validateServerUrl('https://0.0.0.0')).toThrow('Internal addresses are not allowed');
  });

  it('handles URLs with userinfo', () => {
    // URL with embedded credentials should still work for hostname extraction
    expect(() => validateServerUrl('https://user:pass@example.com/dav')).not.toThrow();
  });

  it('handles URLs with embedded credentials targeting private IPs', () => {
    expect(() => validateServerUrl('https://user:pass@192.168.1.1/dav')).toThrow('Internal addresses are not allowed');
  });
});
