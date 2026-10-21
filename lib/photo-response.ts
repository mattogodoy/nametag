import crypto from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Strong ETag for a photo: a hash of its bytes, so it changes exactly when
 * the photo does. Native clients keep a cached copy and revalidate with
 * If-None-Match instead of downloading the image again.
 */
export function photoETag(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('base64url').slice(0, 22);
  return `"${hash}"`;
}

/** True when an If-None-Match header lists this ETag (or `*`). Weak prefixes compare equal. */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === '*' || tag === etag);
}

/**
 * Serve photo bytes with an ETag. Clients may store the image privately but
 * must revalidate before use; a matching If-None-Match gets a bodiless 304.
 */
export function photoResponse(
  request: Request,
  photo: { buffer: Buffer; mimeType: string }
): NextResponse {
  const etag = photoETag(photo.buffer);
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache' };

  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(new Uint8Array(photo.buffer), {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': photo.mimeType,
      'Content-Length': String(photo.buffer.length),
    },
  });
}
