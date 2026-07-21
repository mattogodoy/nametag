import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sharpToBuffer: vi.fn(),
  sharpJpeg: vi.fn(),
  sharpRotate: vi.fn(),
  sharpMetadata: vi.fn(),
}));

vi.mock('sharp', () => {
  const pipeline = {
    rotate: () => { mocks.sharpRotate(); return pipeline; },
    jpeg: (opts: unknown) => { mocks.sharpJpeg(opts); return pipeline; },
    toBuffer: () => mocks.sharpToBuffer(),
    metadata: () => mocks.sharpMetadata(),
  };
  const sharpFn = () => pipeline;
  sharpFn.format = {};
  sharpFn.versions = {};
  return { default: sharpFn };
});

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/photos/convert/route';

function makeHeicBuffer(brand: string = 'heic'): Buffer {
  const buf = Buffer.alloc(64);
  buf.write('ftyp', 4, 'ascii');
  buf.write(brand, 8, 'ascii');
  return buf;
}

function createConvertRequest(buffer: Buffer, type = 'image/heic'): Request {
  const formData = new FormData();
  formData.append('photo', new Blob([new Uint8Array(buffer)], { type }));
  return new Request('http://localhost/api/photos/convert', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/photos/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const jpegOutput = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    mocks.sharpToBuffer.mockResolvedValue(jpegOutput);
    mocks.sharpJpeg.mockReturnValue(undefined);
    mocks.sharpRotate.mockReturnValue(undefined);
  });

  it('should convert a HEIC buffer to JPEG and return binary response', async () => {
    const request = createConvertRequest(makeHeicBuffer());
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');

    const resultBuffer = Buffer.from(await response.arrayBuffer());
    expect(resultBuffer[0]).toBe(0xFF);
    expect(resultBuffer[1]).toBe(0xD8);
  });

  it('should reject non-HEIC files with 400', async () => {
    const jpegBuf = Buffer.alloc(64);
    jpegBuf[0] = 0xFF;
    jpegBuf[1] = 0xD8;
    jpegBuf[2] = 0xFF;

    const request = createConvertRequest(jpegBuf, 'image/jpeg');
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it('should reject files exceeding 50MB', async () => {
    const formData = new FormData();
    const largeBlob = new Blob([new ArrayBuffer(51 * 1024 * 1024)], { type: 'image/heic' });
    formData.append('photo', largeBlob);
    const largeRequest = new Request('http://localhost/api/photos/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(largeRequest);
    expect(response.status).toBe(400);
  });

  it('should reject requests with no file', async () => {
    const formData = new FormData();
    const request = new Request('http://localhost/api/photos/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should accept heix brand variant', async () => {
    const request = createConvertRequest(makeHeicBuffer('heix'));
    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('should accept mif1 brand variant', async () => {
    const request = createConvertRequest(makeHeicBuffer('mif1'));
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
