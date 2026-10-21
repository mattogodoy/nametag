import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  readPhotoFile: vi.fn(),
}));

// The global setup mock has no NextResponse constructor; photo routes build raw responses.
vi.mock('next/server', () => ({
  NextResponse: class extends Response {
    static json(data: unknown, init?: ResponseInit) {
      return Response.json(data, init);
    }
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findUnique: mocks.personFindUnique },
    user: { findUnique: mocks.userFindUnique },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/photo-storage', () => ({
  isPhotoFilename: (photo: string | null | undefined) =>
    !!photo && !photo.startsWith('data:') && !photo.startsWith('http'),
  readPhotoFile: mocks.readPhotoFile,
}));

import { GET as getPersonPhoto } from '../../app/api/photos/[personId]/route';
import { GET as getUserPhoto } from '../../app/api/photos/user/route';

const PHOTO_A = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PHOTO_B = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);

function personRequest(personId: string, ifNoneMatch?: string) {
  const headers: Record<string, string> = ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {};
  return getPersonPhoto(new Request(`http://localhost/api/photos/${personId}`, { headers }), {
    params: Promise.resolve({ personId }),
  });
}

function userRequest(ifNoneMatch?: string) {
  const headers: Record<string, string> = ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {};
  return getUserPhoto(new Request('http://localhost/api/photos/user', { headers }), {
    params: Promise.resolve({}),
  });
}

describe('GET /api/photos/[personId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindUnique.mockResolvedValue({ photo: 'person-1.jpg' });
    mocks.readPhotoFile.mockResolvedValue({ buffer: PHOTO_A, mimeType: 'image/jpeg' });
  });

  it('returns the photo with an ETag and a revalidate-before-use cache header', async () => {
    const res = await personRequest('person-1');

    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).toMatch(/^"[A-Za-z0-9_-]{22}"$/);
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_A);
  });

  it('returns 304 with no body when If-None-Match matches', async () => {
    const etag = (await personRequest('person-1')).headers.get('ETag') ?? '';

    const res = await personRequest('person-1', etag);

    expect(res.status).toBe(304);
    expect(res.headers.get('ETag')).toBe(etag);
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  it('matches a weak tag and a tag inside a list', async () => {
    const etag = (await personRequest('person-1')).headers.get('ETag') ?? '';

    expect((await personRequest('person-1', `W/${etag}`)).status).toBe(304);
    expect((await personRequest('person-1', `"other", ${etag}`)).status).toBe(304);
  });

  it('returns 200 when If-None-Match does not match', async () => {
    const res = await personRequest('person-1', '"stale"');

    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_A);
  });

  it('changes the ETag when the photo is replaced, so the old one no longer matches', async () => {
    const oldEtag = (await personRequest('person-1')).headers.get('ETag') ?? '';
    mocks.readPhotoFile.mockResolvedValue({ buffer: PHOTO_B, mimeType: 'image/jpeg' });

    const res = await personRequest('person-1', oldEtag);

    expect(res.status).toBe(200);
    expect(res.headers.get('ETag')).not.toBe(oldEtag);
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PHOTO_B);
  });

  it("returns 404 for another user's person even with a matching ETag", async () => {
    const etag = (await personRequest('person-1')).headers.get('ETag') ?? '';
    mocks.personFindUnique.mockResolvedValue(null);

    const res = await personRequest('someone-elses', etag);

    expect(res.status).toBe(404);
    expect(mocks.personFindUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-123', deletedAt: null }) })
    );
  });
});

describe('GET /api/photos/user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({ photo: 'user-123.jpg' });
    mocks.readPhotoFile.mockResolvedValue({ buffer: PHOTO_A, mimeType: 'image/jpeg' });
  });

  it('returns the photo with an ETag and 304 on revalidation', async () => {
    const first = await userRequest();
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('private, no-cache');
    const etag = first.headers.get('ETag') ?? '';

    const second = await userRequest(etag);

    expect(second.status).toBe(304);
  });
});
