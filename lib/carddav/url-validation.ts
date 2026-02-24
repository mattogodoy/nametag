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
import { isSaasMode } from '@/lib/features';

/**
 * Validate a server URL to prevent SSRF attacks.
 * Rejects non-HTTP protocols and malformed URLs in all modes.
 * In SaaS mode, also rejects private IPs, loopback addresses,
 * and domains that resolve to private/internal IPs.
 * In self-hosted mode, private/internal addresses are allowed
 * so users can connect to local network services (e.g., Radicale).
 *
 * @throws {Error} If the URL is invalid, uses a non-HTTP protocol, or (in SaaS mode) targets an internal address
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

  // Private/internal IP checks only apply in SaaS mode.
  // Self-hosted users need to reach local network services (e.g., Radicale, Nextcloud).
  if (isSaasMode()) {
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
      // Resolve both IPv4 (A) and IPv6 (AAAA) records to prevent SSRF via IPv6
      const [v4Result, v6Result] = await Promise.allSettled([
        dns.promises.resolve4(cleanHostname),
        dns.promises.resolve6(cleanHostname),
      ]);

      const allAddresses: string[] = [];

      if (v4Result.status === 'fulfilled') {
        allAddresses.push(...v4Result.value);
      }
      if (v6Result.status === 'fulfilled') {
        allAddresses.push(...v6Result.value);
      }

      if (allAddresses.length === 0) {
        throw new Error('Could not resolve server hostname');
      }

      for (const ip of allAddresses) {
        if (isPrivateIP(ip)) {
          throw new Error('Internal addresses are not allowed');
        }
      }
    }
  }
}

/**
 * Check if an IP address falls within private/internal ranges.
 *
 * IPv4 private ranges checked:
 * - 10.0.0.0/8 (Class A private)
 * - 172.16.0.0/12 (Class B private)
 * - 192.168.0.0/16 (Class C private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local)
 * - 0.0.0.0/8 (Current network)
 *
 * IPv6 private ranges checked:
 * - ::1 (Loopback)
 * - fe80::/10 (Link-local)
 * - fc00::/7 (Unique local — fd00::/8 and fc00::/8)
 * - ::ffff:0:0/96 (IPv4-mapped IPv6 — delegates to IPv4 check)
 */
export function isPrivateIP(hostname: string): boolean {
  // Normalize: strip surrounding brackets if present
  const ip = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // IPv6 checks
  if (ip.includes(':')) {
    // IPv6 loopback
    if (ip === '::1') return true;

    // IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
    const v4MappedMatch = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4MappedMatch) {
      return isPrivateIP(v4MappedMatch[1]);
    }

    // Expand the IPv6 address to check prefix ranges
    const expanded = expandIPv6(ip);
    if (!expanded) return false;

    // fe80::/10 — Link-local
    // First 10 bits: 1111 1110 10 → first byte 0xfe, second byte 0x80–0xbf
    if (expanded[0] === 0xfe && (expanded[1] & 0xc0) === 0x80) return true;

    // fc00::/7 — Unique local (fc00::/8 and fd00::/8)
    // First 7 bits: 1111 110 → first byte 0xfc or 0xfd
    if (expanded[0] === 0xfc || expanded[0] === 0xfd) return true;

    return false;
  }

  // IPv4 checks
  const parts = ip.split('.');
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

/**
 * Expand a compressed IPv6 address into an array of 16 bytes.
 * Returns null if the address is malformed.
 */
function expandIPv6(ip: string): number[] | null {
  // Handle :: expansion
  let halves: [string, string];
  if (ip.includes('::')) {
    const parts = ip.split('::');
    if (parts.length !== 2) return null;
    halves = [parts[0], parts[1]];
  } else {
    halves = [ip, ''];
  }

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];

  // Total groups must not exceed 8
  if (left.length + right.length > 8) return null;
  // If no :: was present, must be exactly 8 groups
  if (!ip.includes('::') && left.length !== 8) return null;

  const missing = 8 - left.length - right.length;
  const groups = [...left, ...Array(missing).fill('0'), ...right];

  const bytes: number[] = [];
  for (const group of groups) {
    const val = parseInt(group || '0', 16);
    if (isNaN(val) || val < 0 || val > 0xffff) return null;
    bytes.push((val >> 8) & 0xff);
    bytes.push(val & 0xff);
  }

  return bytes;
}
