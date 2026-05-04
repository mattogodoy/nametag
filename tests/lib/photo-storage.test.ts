import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { isValidImageBuffer, processPhoto, savePhotoFromBuffer, resetPhotoStorageCache } from '@/lib/photo-storage';

// Helper: create a minimal valid JPEG buffer (magic bytes + padding)
function makeJpegBuffer(size = 64): Buffer {
  // Create a real 1x1 JPEG using sharp synchronously is not possible,
  // so we build a valid JPEG header with enough content for sharp.
  // We'll use sharp in tests to generate real images.
  const buf = Buffer.alloc(size);
  buf[0] = 0xFF;
  buf[1] = 0xD8;
  buf[2] = 0xFF;
  return buf;
}

function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(64);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4E;
  buf[3] = 0x47;
  return buf;
}

function makeGifBuffer(): Buffer {
  const buf = Buffer.alloc(64);
  buf[0] = 0x47;
  buf[1] = 0x49;
  buf[2] = 0x46;
  return buf;
}

function makeWebpBuffer(): Buffer {
  const buf = Buffer.alloc(64);
  // RIFF
  buf[0] = 0x52;
  buf[1] = 0x49;
  buf[2] = 0x46;
  buf[3] = 0x46;
  // WEBP at offset 8
  buf[8] = 0x57;
  buf[9] = 0x45;
  buf[10] = 0x42;
  buf[11] = 0x50;
  return buf;
}

async function createTestImage(
  width: number,
  height: number,
  format: 'png' | 'jpeg' | 'webp' = 'png'
): Promise<Buffer> {
  const img = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  });
  return img.toFormat(format).toBuffer();
}

describe('isValidImageBuffer', () => {
  it('should accept JPEG buffers', () => {
    expect(isValidImageBuffer(makeJpegBuffer())).toBe(true);
  });

  it('should accept PNG buffers', () => {
    expect(isValidImageBuffer(makePngBuffer())).toBe(true);
  });

  it('should accept GIF buffers', () => {
    expect(isValidImageBuffer(makeGifBuffer())).toBe(true);
  });

  it('should accept WebP buffers', () => {
    expect(isValidImageBuffer(makeWebpBuffer())).toBe(true);
  });

  it('should reject empty buffers', () => {
    expect(isValidImageBuffer(Buffer.alloc(0))).toBe(false);
  });

  it('should reject buffers shorter than 4 bytes', () => {
    expect(isValidImageBuffer(Buffer.from([0xFF, 0xD8]))).toBe(false);
  });

  it('should reject unknown formats', () => {
    expect(isValidImageBuffer(Buffer.from('hello world'))).toBe(false);
  });

  it('should reject SVG-like content', () => {
    expect(isValidImageBuffer(Buffer.from('<svg xmlns='))).toBe(false);
  });

  it('should reject text/plain content', () => {
    expect(isValidImageBuffer(Buffer.from('Just some plain text data'))).toBe(false);
  });

  it('should reject partial WebP (missing WEBP marker)', () => {
    const buf = Buffer.alloc(16);
    buf[0] = 0x52; // R
    buf[1] = 0x49; // I
    buf[2] = 0x46; // F
    buf[3] = 0x46; // F
    // No WEBP at offset 8
    expect(isValidImageBuffer(buf)).toBe(false);
  });
});

describe('processPhoto', () => {
  it('should reject unsupported image formats', async () => {
    const textBuf = Buffer.from('not an image at all');
    await expect(processPhoto(textBuf)).rejects.toThrow('Unsupported image format');
  });

  it('should reject buffers exceeding 50MB', async () => {
    // Create a buffer with JPEG magic bytes but over 50MB
    const oversized = Buffer.alloc(50 * 1024 * 1024 + 1);
    oversized[0] = 0xFF;
    oversized[1] = 0xD8;
    oversized[2] = 0xFF;
    await expect(processPhoto(oversized)).rejects.toThrow('exceeds maximum size');
  });

  it('should resize an opaque PNG image to 256x256 JPEG', async () => {
    const input = await createTestImage(512, 512, 'png');
    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.format).toBe('jpeg');
    expect(output.hasAlpha).toBe(false);
  });

  it('should resize a non-square image using cover fit', async () => {
    const input = await createTestImage(800, 400, 'png');
    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.format).toBe('jpeg');
  });

  it('should convert WebP to JPEG', async () => {
    const input = await createTestImage(100, 100, 'webp');
    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(256);
  });

  it('should convert JPEG input and resize', async () => {
    const input = await createTestImage(1024, 768, 'jpeg');
    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
  });

  it('should strip EXIF metadata', async () => {
    const input = await createTestImage(300, 300, 'jpeg');
    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    // sharp JPEG output with no explicit withMetadata() call strips EXIF
    expect(metadata.exif).toBeUndefined();
  });

  it('should produce output smaller than or equal to input for large images', async () => {
    const input = await createTestImage(2000, 2000, 'png');
    const output = await processPhoto(input);

    // Resized 256x256 JPEG should be much smaller than 2000x2000 PNG
    expect(output.data.length).toBeLessThan(input.length);
  });

  it('should preserve transparency as PNG for images with alpha', async () => {
    // Create a PNG with alpha channel (channels: 4)
    const input = await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 0.5 },
      },
    }).png().toBuffer();

    const output = await processPhoto(input);

    const metadata = await sharp(output.data).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(output.hasAlpha).toBe(true);
  });
});

describe('savePhotoFromBuffer', () => {
  let originalEnv: string | undefined;
  let tmpDir: string;

  beforeEach(async () => {
    originalEnv = process.env.PHOTO_STORAGE_PATH;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nametag-test-'));
    process.env.PHOTO_STORAGE_PATH = tmpDir;
    resetPhotoStorageCache();
  });

  afterEach(async () => {
    process.env.PHOTO_STORAGE_PATH = originalEnv;
    resetPhotoStorageCache();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should save a photo and return the filename', async () => {
    const input = await createTestImage(300, 300, 'jpeg');
    const filename = await savePhotoFromBuffer('test-user', 'person-1', input);

    expect(filename).toBe('person-1.jpg');
    const savedPath = path.join(tmpDir, 'test-user', filename);
    const stat = await fs.stat(savedPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it('should write to storage path without using os.tmpdir (no EXDEV)', async () => {
    // Use a storage path on a different "device" (simulated by a subdirectory)
    // The key assertion is that temp files are created inside the storage dir,
    // not in os.tmpdir(), so rename never crosses filesystem boundaries.
    const input = await createTestImage(100, 100, 'png');
    await savePhotoFromBuffer('test-user', 'person-2', input);

    // Verify no leftover temp files in os.tmpdir matching our pattern
    const tmpFiles = await fs.readdir(os.tmpdir());
    const leftover = tmpFiles.filter(f => f.startsWith('.nametag-tmp-'));
    expect(leftover).toHaveLength(0);

    // Verify the file was written to the correct location
    const userDir = path.join(tmpDir, 'test-user');
    const files = await fs.readdir(userDir);
    expect(files).toContain('person-2.jpg');
  });

  it('should not leave temp files on success', async () => {
    const input = await createTestImage(100, 100, 'jpeg');
    await savePhotoFromBuffer('test-user', 'person-3', input);

    const userDir = path.join(tmpDir, 'test-user');
    const files = await fs.readdir(userDir);
    const tmpFiles = files.filter(f => f.startsWith('.nametag-tmp-'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('should overwrite existing photo for the same person', async () => {
    const input1 = await createTestImage(100, 100, 'jpeg');
    const input2 = await createTestImage(200, 200, 'jpeg');

    await savePhotoFromBuffer('test-user', 'person-4', input1);
    await savePhotoFromBuffer('test-user', 'person-4', input2);

    const userDir = path.join(tmpDir, 'test-user');
    const files = await fs.readdir(userDir);
    const personFiles = files.filter(f => f.startsWith('person-4'));
    expect(personFiles).toHaveLength(1);
  });
});
