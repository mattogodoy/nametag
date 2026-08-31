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
import net from 'net';
import { isSaasMode } from '@/lib/features';

const DNS_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
    const cleanHostname = stripIpv6Brackets(hostname);
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
        withTimeout(dns.promises.resolve4(cleanHostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
        withTimeout(dns.promises.resolve6(cleanHostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
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
 * The family is decided with `net.isIP` rather than by sniffing for a colon
 * or a dot in the string. The reason this function exists at all, and the
 * bug class it must not reintroduce, is that an address is not one string:
 * `127.0.0.1`, `::ffff:127.0.0.1`, `::ffff:7f00:1` and
 * `0:0:0:0:0:ffff:7f00:1` are four spellings of the same loopback address.
 * Matching against one spelling's textual shape (a prefix regex, a specific
 * expansion) and not the others lets an attacker pick whichever spelling the
 * check does not recognise. Every branch below normalises before it decides,
 * so two spellings of the same address always reach the same verdict.
 *
 * IPv4 ranges checked:
 * - 0.0.0.0/8 (Current network, includes the unspecified address)
 * - 10.0.0.0/8 (Class A private)
 * - 100.64.0.0/10 (Carrier-grade NAT)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local)
 * - 172.16.0.0/12 (Class B private)
 * - 192.0.0.0/24 (IETF protocol assignments)
 * - 192.168.0.0/16 (Class C private)
 * - 224.0.0.0/4 (Multicast)
 * - 240.0.0.0/4 (Reserved, includes the 255.255.255.255 broadcast address)
 *
 * IPv6 ranges checked:
 * - ::1 (Loopback)
 * - fe80::/10 (Link-local)
 * - fc00::/7 (Unique local: fd00::/8 and fc00::/8)
 * - Any address whose top 96 bits are zero (::ffff:0:0/96 IPv4-mapped, and
 *   the deprecated ::0:0/96 IPv4-compatible form, which includes `::`):
 *   the embedded IPv4 address is extracted and re-checked against the IPv4
 *   ranges above, so it cannot be used to smuggle a private IPv4 address
 *   past this function inside an IPv6 literal.
 */
export function isPrivateIP(hostname: string): boolean {
  const ip = stripIpv6Brackets(hostname).toLowerCase();
  const family = net.isIP(ip);

  if (family === 6) return isPrivateIPv6(ip);
  if (family === 4) return isPrivateIPv4(ip);

  // Not a literal address (a bare hostname, or malformed input). Callers
  // either gate on `net.isIP` before calling this, or have already resolved
  // DNS to a literal by this point, so there is nothing to range-check here.
  return false;
}

function isPrivateIPv4(ip: string): boolean {
  const nums = ip.split('.').map(Number);

  // 0.0.0.0/8 - Current network (also the unspecified address 0.0.0.0)
  if (nums[0] === 0) return true;

  // 10.0.0.0/8
  if (nums[0] === 10) return true;

  // 100.64.0.0/10 - Carrier-grade NAT (RFC 6598)
  if (nums[0] === 100 && nums[1] >= 64 && nums[1] <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (nums[0] === 127) return true;

  // 169.254.0.0/16 (Link-local)
  if (nums[0] === 169 && nums[1] === 254) return true;

  // 172.16.0.0/12
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;

  // 192.0.0.0/24 - IETF protocol assignments (RFC 6890)
  if (nums[0] === 192 && nums[1] === 0 && nums[2] === 0) return true;

  // 192.168.0.0/16
  if (nums[0] === 192 && nums[1] === 168) return true;

  // 224.0.0.0/4 (Multicast)
  if (nums[0] >= 224 && nums[0] <= 239) return true;

  // 240.0.0.0/4 (Reserved, includes 255.255.255.255)
  if (nums[0] >= 240) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1') return true;

  const bytes = expandIPv6(normalizeIPv6DottedQuad(ip));
  if (!bytes) return false;

  // fe80::/10, link-local
  // First 10 bits: 1111 1110 10 -> first byte 0xfe, second byte 0x80-0xbf
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;

  // fc00::/7, unique local (fc00::/8 and fd00::/8)
  // First 7 bits: 1111 110 -> first byte 0xfc or 0xfd
  if (bytes[0] === 0xfc || bytes[0] === 0xfd) return true;

  // An address whose top 96 bits are all zero is carrying an IPv4 address
  // inside an IPv6 literal, either the IPv4-mapped form (RFC 4291
  // ::ffff:a.b.c.d, what dual-stack sockets and resolvers produce) or the
  // deprecated IPv4-compatible form (::a.b.c.d, which includes `::` itself,
  // embedding 0.0.0.0). Delegating to the IPv4 check here, instead of
  // keeping a second copy of the private-range list for this case, is what
  // makes the two spellings of a private IPv4 address agree by construction.
  const top80Zero = bytes.slice(0, 10).every((b) => b === 0);
  const isV4Mapped = top80Zero && bytes[10] === 0xff && bytes[11] === 0xff;
  const isV4Compatible = top80Zero && bytes[10] === 0 && bytes[11] === 0;
  if (isV4Mapped || isV4Compatible) {
    const embedded = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isPrivateIPv4(embedded);
  }

  return false;
}

/**
 * Rewrite a trailing IPv4 dotted-quad, as in `::ffff:127.0.0.1` or the
 * deprecated `::127.0.0.1`, into two hex groups. This lets `expandIPv6`
 * treat every address as plain hextets instead of needing a second parser
 * for the mixed-notation form, which is just another spelling of the same
 * bytes and must not be handled by a separate, potentially-incomplete code
 * path. Addresses with no dotted tail, or a malformed one, are returned
 * unchanged; `expandIPv6` rejects what is still malformed after this.
 */
function normalizeIPv6DottedQuad(ip: string): string {
  const lastColon = ip.lastIndexOf(':');
  if (lastColon === -1) return ip;

  const tail = ip.slice(lastColon + 1);
  if (!tail.includes('.')) return ip;

  const octets = tail.split('.');
  if (octets.length !== 4) return ip;
  const nums = octets.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return ip;

  const hi = ((nums[0] << 8) | nums[1]).toString(16);
  const lo = ((nums[2] << 8) | nums[3]).toString(16);
  return `${ip.slice(0, lastColon + 1)}${hi}:${lo}`;
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

/**
 * Why resolveTarget refused to hand back a target.
 *
 * `policy` means the request was refused on its merits (wrong protocol,
 * disallowed port, private address, and so on): retrying with the same URL
 * will refuse again. `dns` means resolution itself failed (NXDOMAIN,
 * SERVFAIL, a resolver timeout): the URL might be fine and a later retry
 * might succeed. Callers use this to choose an outbound failure code that
 * does not mislead the user about which one happened.
 */
export type BlockedReason = 'policy' | 'dns';

/**
 * A URL that policy refuses to connect to.
 *
 * Distinct from a network failure: nothing was attempted. Callers surface this
 * as `blocked` rather than as a transport error.
 */
export class BlockedUrlError extends Error {
  readonly reason: BlockedReason;

  constructor(message: string, reason: BlockedReason = 'policy') {
    super(message);
    this.name = 'BlockedUrlError';
    this.reason = reason;
  }
}

export interface OutboundPolicy {
  requireHttps: boolean;
  /** null means any port is acceptable. */
  allowedPorts: readonly number[] | null;
  blockPrivateAddresses: boolean;
}

/**
 * How strict to be about user-supplied outbound targets.
 *
 * SaaS is strict because the destination is attacker-controlled and the source
 * is our infrastructure. Self-hosted is permissive because the user is the
 * operator, and the whole point of a self-hosted webhook or a LAN ntfy server
 * is to reach an address that SaaS would rightly refuse.
 *
 * Port 80 is not in the SaaS allowlist even though the spec mentions it:
 * HTTPS is already required there, so allowing 80 only widens the reachable
 * port range without enabling any real destination.
 */
export function outboundPolicy(): OutboundPolicy {
  return isSaasMode()
    ? { requireHttps: true, allowedPorts: [443], blockPrivateAddresses: true }
    : { requireHttps: false, allowedPorts: null, blockPrivateAddresses: false };
}

/**
 * Strip the brackets the WHATWG URL parser keeps around an IPv6 host.
 *
 * `new URL('https://[fd00::1]/x').hostname` is `"[fd00::1]"`, brackets and
 * all, and `net.isIP` returns 0 for that form. Any caller asking "is this
 * host an IP literal?" has to strip first or it silently gets the wrong
 * answer for every IPv6 address while working fine for IPv4.
 */
export function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '');
}

export interface PinnedTarget {
  /** The original URL. Supplies the Host header and the TLS server name. */
  parsed: URL;
  /** The single validated IP the socket must connect to. */
  address: string;
  family: 4 | 6;
  port: number;
}

const DEFAULT_PORTS: Record<string, number> = { 'https:': 443, 'http:': 80 };

/**
 * Validate a URL and resolve it to one specific IP address.
 *
 * Returning the address is the point. Validating a hostname and then handing
 * that hostname to the HTTP client leaves a window where the resolver can
 * answer differently the second time, which is the DNS rebinding attack this
 * whole function exists to close. The caller pins the socket to the address
 * returned here.
 *
 * Under a blocking policy, EVERY resolved address must be public. Accepting a
 * hostname because its first address is public would let an attacker publish
 * one public and one internal address and win the race some fraction of the
 * time.
 */
export async function resolveTarget(
  rawUrl: string,
  policy: OutboundPolicy
): Promise<PinnedTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BlockedUrlError('Only HTTP and HTTPS protocols are allowed');
  }

  if (policy.requireHttps && parsed.protocol !== 'https:') {
    throw new BlockedUrlError('Only HTTPS is allowed');
  }

  const port = parsed.port ? Number(parsed.port) : DEFAULT_PORTS[parsed.protocol];

  if (policy.allowedPorts && !policy.allowedPorts.includes(port)) {
    throw new BlockedUrlError(`Port ${port} is not allowed`);
  }

  const hostname = stripIpv6Brackets(parsed.hostname).toLowerCase();

  // A literal address needs no lookup, and looking it up would be wrong.
  const literalFamily = net.isIP(hostname);
  if (literalFamily !== 0) {
    if (policy.blockPrivateAddresses && isPrivateIP(hostname)) {
      throw new BlockedUrlError('Internal addresses are not allowed');
    }
    return { parsed, address: hostname, family: literalFamily === 6 ? 6 : 4, port };
  }

  if (policy.blockPrivateAddresses && hostname === 'localhost') {
    throw new BlockedUrlError('Internal addresses are not allowed');
  }

  const [v4, v6] = await Promise.allSettled([
    withTimeout(dns.promises.resolve4(hostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
    withTimeout(dns.promises.resolve6(hostname), DNS_TIMEOUT_MS, 'DNS resolution timeout'),
  ]);

  let candidates: Array<{ address: string; family: 4 | 6 }> = [];
  if (v4.status === 'fulfilled') {
    candidates.push(...v4.value.map((address) => ({ address, family: 4 as const })));
  }
  if (v6.status === 'fulfilled') {
    candidates.push(...v6.value.map((address) => ({ address, family: 6 as const })));
  }

  // resolve4/resolve6 query DNS directly and bypass /etc/hosts. That breaks a
  // self-hoster's Docker Compose `extra_hosts:` entry, any other hosts-file
  // mapping, and mDNS `.local` names, all of which resolve fine for every
  // other program on the same machine. dns.promises.lookup is the
  // hosts-file-aware path (it calls into libuv's getaddrinfo, the same
  // resolution a browser or curl on the same host would use), so it is tried
  // only as a fallback, after both plain DNS record lookups came back empty.
  // The results go through exactly the same private-address check below as
  // the primary path.
  if (candidates.length === 0) {
    try {
      const looked = await withTimeout(
        dns.promises.lookup(hostname, { all: true }),
        DNS_TIMEOUT_MS,
        'DNS resolution timeout'
      );
      candidates = looked.map(({ address, family }) => ({
        address,
        family: family === 6 ? (6 as const) : (4 as const),
      }));
    } catch {
      // Fall through to the "could not resolve" error below.
    }
  }

  if (candidates.length === 0) {
    throw new BlockedUrlError('Could not resolve hostname', 'dns');
  }

  if (policy.blockPrivateAddresses) {
    for (const candidate of candidates) {
      if (isPrivateIP(candidate.address)) {
        throw new BlockedUrlError('Internal addresses are not allowed');
      }
    }
  }

  return { parsed, address: candidates[0].address, family: candidates[0].family, port };
}
