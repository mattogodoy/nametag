import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { validateStoragePath, validateFilePath } from '@/lib/photo-storage';

describe('Photo Storage Security', () => {
  describe('validateStoragePath', () => {
    it('should reject paths containing ..', () => {
      expect(() => validateStoragePath('/data/../etc')).toThrow('invalid');
    });
    it('should reject relative paths', () => {
      expect(() => validateStoragePath('data/photos')).toThrow('absolute');
    });
    it('should accept valid absolute paths', () => {
      expect(() => validateStoragePath('/data/photos')).not.toThrow();
    });
    it('should return the resolved path', () => {
      const result = validateStoragePath('/data/photos');
      expect(result).toBe(path.resolve('/data/photos'));
    });
  });

  describe('validateFilePath', () => {
    const basePath = '/data/photos';

    it('should reject paths that escape the base directory', () => {
      const malicious = path.join(basePath, '..', '..', 'etc', 'passwd');
      expect(() => validateFilePath(malicious, basePath)).toThrow('escape');
    });
    it('should reject filenames with null bytes', () => {
      const malicious = path.join(basePath, 'user1', 'file\x00.jpg');
      expect(() => validateFilePath(malicious, basePath)).toThrow();
    });
    it('should accept paths within the base directory', () => {
      const valid = path.join(basePath, 'user1', 'photo.jpg');
      expect(() => validateFilePath(valid, basePath)).not.toThrow();
    });
    it('should accept the base directory itself', () => {
      expect(() => validateFilePath(basePath, basePath)).not.toThrow();
    });
    it('should reject paths that are prefixes but not subdirectories', () => {
      // /data/photos-evil is not inside /data/photos
      expect(() => validateFilePath('/data/photos-evil/file.jpg', basePath)).toThrow('escape');
    });
  });

  describe('getPhotoStoragePath caching', () => {
    afterEach(() => {
      // Reset the cached path by clearing the module-level variable.
      // We test indirectly through validateStoragePath instead.
    });

    it('validateStoragePath returns consistent resolved paths', () => {
      const result1 = validateStoragePath('/tmp/test-photos');
      const result2 = validateStoragePath('/tmp/test-photos');
      expect(result1).toBe(result2);
    });
  });
});
