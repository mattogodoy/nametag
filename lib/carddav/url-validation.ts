/**
 * URL validation utility to prevent SSRF (Server-Side Request Forgery) attacks.
 *
 * Validates that a server URL:
 * - Uses only HTTP or HTTPS protocols
 * - Does not point to private/internal IP ranges
 * - Does not point to loopback or link-local addresses
 * - Resolves DNS to non-private IPs (prevents DNS rebinding)
 * - Is a well-formed URL
 */

import dns from 'dns';

/**
 * Validate a server URL to prevent SSRF attacks.
 * Rejects private IPs, loopback addresses, non-HTTP protocols,
 * and domains that resolve to private/internal IPs.
 *
 * @throws {Error} If the URL is invalid, uses a non-HTTP protocol, or targets an internal address
 */
export async function validateServerUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP and HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost
  if (hostname === 'localhost') {
    throw new Error('Internal addresses are not allowed');
  }

  // Reject IPv6 loopback (::1) - hostname may be with or without brackets
  const cleanHostname = hostname.replace(/^\[|\]$/g, '');
  if (cleanHostname === '::1') {
    throw new Error('Internal addresses are not allowed');
  }

  // Reject private/internal IPv4 ranges (string check)
  if (isPrivateIP(cleanHostname)) {
    throw new Error('Internal addresses are not allowed');
  }

  // DNS resolution check: resolve hostname and verify IPs aren't private.
  // Skip for raw IP addresses (already checked above).
  const isRawIP = /^\d+\.\d+\.\d+\.\d+$/.test(cleanHostname) || cleanHostname === '::1';
  if (!isRawIP) {
    try {
      const addresses = await dns.promises.resolve4(cleanHostname);
      for (const ip of addresses) {
        if (isPrivateIP(ip)) {
          throw new Error('Internal addresses are not allowed');
        }
      }
    } catch (error) {
      // Re-throw our own SSRF errors
      if (error instanceof Error && error.message === 'Internal addresses are not allowed') {
        throw error;
      }
      // DNS resolution failure — host doesn't exist or DNS is unreachable
      throw new Error('Could not resolve server hostname');
    }
  }
}

/**
 * Check if an IP address falls within private/internal ranges.
 *
 * Private ranges checked:
 * - 10.0.0.0/8 (Class A private)
 * - 172.16.0.0/12 (Class B private)
 * - 192.168.0.0/16 (Class C private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local)
 * - 0.0.0.0/8 (Current network)
 */
export function isPrivateIP(hostname: string): boolean {
  // IPv6 loopback
  if (hostname === '::1') return true;

  // IPv4 checks
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;

  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return false;

  // 0.0.0.0/8 - Current network
  if (nums[0] === 0) return true;

  // 10.0.0.0/8
  if (nums[0] === 10) return true;

  // 172.16.0.0/12
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;

  // 192.168.0.0/16
  if (nums[0] === 192 && nums[1] === 168) return true;

  // 127.0.0.0/8 (Loopback)
  if (nums[0] === 127) return true;

  // 169.254.0.0/16 (Link-local)
  if (nums[0] === 169 && nums[1] === 254) return true;

  return false;
}
