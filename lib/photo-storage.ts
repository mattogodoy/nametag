import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createModuleLogger } from './logger';

const log = createModuleLogger('photos');

const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB
const FETCH_TIMEOUT_MS = 15000;

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
 * Get the base path for photo storage
 */
export function getPhotoStoragePath(): string {
  return process.env.PHOTO_STORAGE_PATH || './data/photos';
}

/**
 * Ensure the user's photo directory exists
 */
export async function ensureUserPhotoDir(userId: string): Promise<string> {
  const dirPath = path.join(getPhotoStoragePath(), userId);
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
 * Detect image extension from magic bytes
 */
function detectImageExtension(buffer: Buffer): string {
  if (buffer.length < 4) return 'jpg';

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'gif';
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'webp';

  return 'jpg';
}

/**
 * Download a photo from a URL and return its buffer and extension
 */
async function downloadPhoto(url: string): Promise<{ buffer: Buffer; ext: string }> {
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
    let ext: string;

    if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
      // Download from URL
      const result = await downloadPhoto(photoData);
      buffer = result.buffer;
      ext = result.ext;
    } else {
      // Parse data URI or raw base64
      const parsed = parsePhotoData(photoData);
      if (!parsed) return null;
      buffer = parsed.buffer;
      ext = parsed.ext;
    }

    // Enforce size limit
    if (buffer.length > MAX_PHOTO_SIZE) {
      log.warn({ personId, maxSizeMB: MAX_PHOTO_SIZE / (1024 * 1024) }, 'Photo exceeds size limit');
      return null;
    }

    // Ensure directory exists
    const dirPath = await ensureUserPhotoDir(userId);

    // Delete any existing photo for this person (handle extension change)
    await deletePersonPhotos(userId, personId);

    const filename = `${personId}.${ext}`;
    const filePath = path.join(dirPath, filename);

    // Write atomically: temp file + rename
    const tmpPath = path.join(os.tmpdir(), `nametag-photo-${crypto.randomBytes(8).toString('hex')}`);
    await fs.writeFile(tmpPath, buffer);
    await fs.rename(tmpPath, filePath);

    return filename;
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)), personId }, 'Failed to save photo');
    return null;
  }
}

/**
 * Delete a specific photo file
 */
export async function deletePhoto(userId: string, filename: string): Promise<void> {
  try {
    const filePath = path.join(getPhotoStoragePath(), userId, filename);
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
    const dirPath = path.join(getPhotoStoragePath(), userId);
    const files = await fs.readdir(dirPath).catch(() => []);

    for (const file of files) {
      // Match personId.ext pattern
      const baseName = path.parse(file).name;
      if (baseName === personId) {
        await fs.unlink(path.join(dirPath, file));
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
    const filePath = path.join(getPhotoStoragePath(), userId, photo);
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
    const filePath = path.join(getPhotoStoragePath(), userId, photo);
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
