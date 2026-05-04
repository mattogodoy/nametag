import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { createModuleLogger } from './logger';
import { validateServerUrl } from '@/lib/carddav/url-validation';

const log = createModuleLogger('photos');

const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50MB
const PHOTO_SIZE = 256;
const JPEG_QUALITY = 80;
const FETCH_TIMEOUT_MS = 15000;
// Bound decoded-pixel memory independently of byte size. Sharp's default
// (268MP) is too generous: an attacker can craft a small file that decodes
// into hundreds of MB of RGBA pixels. 100MP covers any realistic phone or
// DSLR sensor (Hasselblad H6D-100c is ~100MP at the high end).
const SHARP_MAX_INPUT_PIXELS = 100 * 1024 * 1024;

/**
 * Atomically write data to filePath: write to a temp file in the same
 * directory, then rename.  This avoids EXDEV errors when the OS tmpdir
 * and the target live on different filesystems (common with Docker
 * bind-mounts).
 */
async function atomicWrite(filePath: string, data: Buffer): Promise<void> {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.nametag-tmp-${crypto.randomBytes(8).toString('hex')}`);
  await fs.writeFile(tmpPath, data);
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Clean up the temp file if rename somehow fails
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Validate that a storage path is absolute and contains no traversal sequences.
 * Returns the resolved path on success, throws on invalid input.
 */
export function validateStoragePath(storagePath: string): string {
  if (!path.isAbsolute(storagePath)) {
    throw new Error('PHOTO_STORAGE_PATH must be an absolute path');
  }
  if (storagePath.includes('..')) {
    throw new Error('PHOTO_STORAGE_PATH contains invalid path traversal');
  }
  return path.resolve(storagePath);
}

/**
 * Validate that a file path stays within the expected base directory.
 * Throws if the path contains null bytes or escapes the base.
 */
export function validateFilePath(filePath: string, basePath: string): void {
  if (filePath.includes('\x00')) {
    throw new Error('File path contains null bytes');
  }
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(basePath);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error('File path attempts to escape storage directory');
  }
}

let _validatedPath: string | null = null;

/**
 * Reset the cached storage path. Intended for testing only.
 */
export function resetPhotoStorageCache(): void {
  _validatedPath = null;
}

/**
 * Get the base path for photo storage.
 * Validates and caches the result on first call.
 */
export function getPhotoStoragePath(): string {
  if (!_validatedPath) {
    const configuredPath = process.env.PHOTO_STORAGE_PATH || path.resolve('./data/photos');
    _validatedPath = validateStoragePath(
      path.isAbsolute(configuredPath) ? configuredPath : path.resolve(configuredPath)
    );
  }
  return _validatedPath;
}

/**
 * Ensure the user's photo directory exists
 */
export async function ensureUserPhotoDir(userId: string): Promise<string> {
  const basePath = getPhotoStoragePath();
  const dirPath = path.join(basePath, userId);
  validateFilePath(dirPath, basePath);
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Check if a photo value is a stored filename (not a URL or data URI)
 */
export function isPhotoFilename(photo: string | null | undefined): photo is string {
  if (!photo) return false;
  return !photo.startsWith('data:') && !photo.startsWith('http://') && !photo.startsWith('https://');
}

/**
 * Detect MIME type and extract raw bytes from photo data
 * Accepts data URI, raw base64, or returns null for URLs (handled separately)
 */
function parsePhotoData(photoData: string): { buffer: Buffer; ext: string } | null {
  // Data URI: data:image/jpeg;base64,/9j/4AAQ...
  const dataUriMatch = photoData.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
  if (dataUriMatch) {
    const mimeType = dataUriMatch[1];
    const base64Data = dataUriMatch[2].replace(/\s/g, '');
    const ext = MIME_TO_EXT[mimeType] || 'jpg';
    return { buffer: Buffer.from(base64Data, 'base64'), ext };
  }

  // Raw base64 (no data URI prefix, no URL prefix)
  if (!photoData.startsWith('http://') && !photoData.startsWith('https://')) {
    const buffer = Buffer.from(photoData, 'base64');
    // Try to detect type from magic bytes
    const ext = detectImageExtension(buffer);
    return { buffer, ext };
  }

  return null;
}

/**
 * Detect image format from magic bytes
 * Returns the format ('jpg', 'png', 'gif', 'webp') or null for unknown formats
 */
function detectFormat(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'webp';

  return null;
}

/**
 * Detect image extension from magic bytes
 * Returns the detected format or defaults to 'jpg' for unknown formats
 */
function detectImageExtension(buffer: Buffer): string {
  return detectFormat(buffer) ?? 'jpg';
}

/**
 * Check if a buffer contains a supported image format (JPEG, PNG, GIF, WebP)
 * by inspecting magic bytes. Returns false for unknown formats and SVGs.
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  return detectFormat(buffer) !== null;
}

/**
 * Process a photo buffer: validate format, enforce size limit,
 * resize to PHOTO_SIZE x PHOTO_SIZE (cover), convert to JPEG at JPEG_QUALITY, strip EXIF.
 * Throws on invalid input.
 */
export async function processPhoto(buffer: Buffer): Promise<{ data: Buffer; hasAlpha: boolean }> {
  if (!isValidImageBuffer(buffer)) {
    throw new Error('Unsupported image format. Supported: JPEG, PNG, GIF, WebP');
  }

  if (buffer.length > MAX_PHOTO_SIZE) {
    throw new Error(`Photo exceeds maximum size of ${MAX_PHOTO_SIZE / (1024 * 1024)}MB`);
  }

  const image = sharp(buffer, { limitInputPixels: SHARP_MAX_INPUT_PIXELS })
    .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover' })
    .rotate(); // auto-rotate based on EXIF before stripping

  // Check if the source format has an alpha channel
  const metadata = await sharp(buffer, { limitInputPixels: SHARP_MAX_INPUT_PIXELS }).metadata();
  const hasAlpha = metadata.hasAlpha === true;

  if (hasAlpha) {
    // Preserve transparency — save as PNG
    return { data: await image.png().toBuffer(), hasAlpha: true };
  }

  // No alpha — save as JPEG (smaller file size)
  return { data: await image.jpeg({ quality: JPEG_QUALITY }).toBuffer(), hasAlpha: false };
}

/**
 * Download a photo from a URL and return its buffer and extension
 */
export async function downloadPhoto(url: string): Promise<{ buffer: Buffer; ext: string }> {
  await validateServerUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Nametag/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status} ${response.statusText}`);
    }

    // Check content-length before downloading
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PHOTO_SIZE) {
      throw new Error(`Photo exceeds maximum size of ${MAX_PHOTO_SIZE / (1024 * 1024)}MB`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_PHOTO_SIZE) {
      throw new Error(`Photo exceeds maximum size of ${MAX_PHOTO_SIZE / (1024 * 1024)}MB`);
    }

    // Detect extension from content-type or magic bytes
    const contentType = response.headers.get('content-type') || '';
    const ext = MIME_TO_EXT[contentType] || detectImageExtension(buffer);

    return { buffer, ext };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Save a photo to disk for a person
 * Accepts data URI, URL, or raw base64
 * Returns the filename (e.g., "cm1abc.jpg") or null on failure
 */
export async function savePhoto(
  userId: string,
  personId: string,
  photoData: string
): Promise<string | null> {
  try {
    let buffer: Buffer;

    if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
      // Download from URL
      const result = await downloadPhoto(photoData);
      buffer = result.buffer;
    } else {
      // Parse data URI or raw base64
      const parsed = parsePhotoData(photoData);
      if (!parsed) return null;
      buffer = parsed.buffer;
    }

    // Process: validate format, enforce size, resize, strip EXIF
    const { data, hasAlpha } = await processPhoto(buffer);

    // Ensure directory exists
    const dirPath = await ensureUserPhotoDir(userId);

    // Delete any existing photo for this person (handle extension change)
    await deletePersonPhotos(userId, personId);

    const ext = hasAlpha ? 'png' : 'jpg';
    const filename = `${personId}.${ext}`;
    const filePath = path.join(dirPath, filename);
    validateFilePath(filePath, getPhotoStoragePath());

    await atomicWrite(filePath, data);

    return filename;
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)), personId }, 'Failed to save photo');
    return null;
  }
}

/**
 * Save a photo from a raw Buffer (already read from an upload).
 * Validates, processes, and writes the file atomically.
 * Throws on failure (caller handles error responses).
 */
export async function savePhotoFromBuffer(
  userId: string,
  personId: string,
  buffer: Buffer
): Promise<string> {
  const { data, hasAlpha } = await processPhoto(buffer);

  const dirPath = await ensureUserPhotoDir(userId);
  await deletePersonPhotos(userId, personId);

  const ext = hasAlpha ? 'png' : 'jpg';
  const filename = `${personId}.${ext}`;
  const filePath = path.join(dirPath, filename);
  validateFilePath(filePath, getPhotoStoragePath());

  await atomicWrite(filePath, data);

  return filename;
}

/**
 * Delete a specific photo file
 */
export async function deletePhoto(userId: string, filename: string): Promise<void> {
  try {
    const basePath = getPhotoStoragePath();
    const filePath = path.join(basePath, userId, filename);
    validateFilePath(filePath, basePath);
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore ENOENT (file already gone)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error instanceof Error ? error : new Error(String(error)), filename }, 'Failed to delete photo');
    }
  }
}

/**
 * Delete all photo files for a person (glob personId.*)
 */
export async function deletePersonPhotos(userId: string, personId: string): Promise<void> {
  try {
    const basePath = getPhotoStoragePath();
    const dirPath = path.join(basePath, userId);
    validateFilePath(dirPath, basePath);
    const files = await fs.readdir(dirPath).catch(() => []);

    for (const file of files) {
      // Match personId.ext pattern
      const baseName = path.parse(file).name;
      if (baseName === personId) {
        const unlinkPath = path.join(dirPath, file);
        validateFilePath(unlinkPath, basePath);
        await fs.unlink(unlinkPath);
      }
    }
  } catch (error) {
    // Directory may not exist yet
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error instanceof Error ? error : new Error(String(error)), personId }, 'Failed to delete photos for person');
    }
  }
}

/**
 * Read a photo file and return it as a data URI for vCard export
 * Returns null if file is missing
 */
export async function readPhotoForExport(
  userId: string,
  photo: string
): Promise<string | null> {
  if (!isPhotoFilename(photo)) return null;

  try {
    const basePath = getPhotoStoragePath();
    const filePath = path.join(basePath, userId, photo);
    validateFilePath(filePath, basePath);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(photo).slice(1).toLowerCase();
    const mimeType = EXT_TO_MIME[ext] || 'image/jpeg';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error instanceof Error ? error : new Error(String(error)), photo }, 'Failed to read photo');
    }
    return null;
  }
}

/**
 * Read photo file and return raw buffer and MIME type
 * Used by the photo serving endpoint
 */
export async function readPhotoFile(
  userId: string,
  photo: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!isPhotoFilename(photo)) return null;

  try {
    const basePath = getPhotoStoragePath();
    const filePath = path.join(basePath, userId, photo);
    validateFilePath(filePath, basePath);
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(photo).slice(1).toLowerCase();
    const mimeType = EXT_TO_MIME[ext] || 'image/jpeg';
    return { buffer, mimeType };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error instanceof Error ? error : new Error(String(error)), photo }, 'Failed to read photo file');
    }
    return null;
  }
}
