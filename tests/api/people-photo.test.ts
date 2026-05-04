import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personUpdate: vi.fn(),
  savePhotoFromBuffer: vi.fn(),
  deletePersonPhotos: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      update: mocks.personUpdate,
    },
  },
}));

// Mock auth
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Mock photo-storage
vi.mock('../../lib/photo-storage', () => ({
  savePhotoFromBuffer: mocks.savePhotoFromBuffer,
  deletePersonPhotos: mocks.deletePersonPhotos,
}));

// Import after mocking
import { POST, DELETE } from '../../app/api/people/[id]/photo/route';

// JPEG magic bytes for a valid image buffer
const JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

function createFormDataRequest(
  personId: string,
  file?: Blob | null,
  method = 'POST'
): { request: Request; context: { params: Promise<{ id: string }> } } {
  const formData = new FormData();
  if (file) {
    formData.append('photo', file);
  }

  const request = new Request(`http://localhost/api/people/${personId}/photo`, {
    method,
    body: formData,
  });

  const context = { params: Promise.resolve({ id: personId }) };
  return { request, context };
}

describe('People Photo API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.savePhotoFromBuffer.mockResolvedValue('person-1.jpg');
    mocks.deletePersonPhotos.mockResolvedValue(undefined);
    mocks.personUpdate.mockResolvedValue({ id: 'person-1', photo: 'person-1.jpg' });
  });

  describe('POST /api/people/[id]/photo', () => {
    it('should upload and process a photo successfully', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });

      const file = new Blob([JPEG_HEADER], { type: 'image/jpeg' });
      const { request, context } = createFormDataRequest('person-1', file);
      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.photo).toBe('person-1.jpg');

      // Should verify person ownership
      expect(mocks.personFindUnique).toHaveBeenCalledWith({
        where: {
          id: 'person-1',
          userId: 'user-123',
          deletedAt: null,
        },
        select: { id: true },
      });

      // Should save photo via savePhotoFromBuffer
      expect(mocks.savePhotoFromBuffer).toHaveBeenCalledWith(
        'user-123',
        'person-1',
        expect.any(Buffer)
      );

      // Should update person record
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { photo: 'person-1.jpg' },
      });
    });

    it('should return 400 when no photo file is provided', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });

      const formData = new FormData();
      const request = new Request('http://localhost/api/people/person-1/photo', {
        method: 'POST',
        body: formData,
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('No photo file provided');
    });

    it('should return 400 when photo exceeds 50MB', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });

      // Create a blob that reports a size > 50MB
      const largeBuffer = new ArrayBuffer(50 * 1024 * 1024 + 1);
      const file = new Blob([largeBuffer], { type: 'image/jpeg' });
      const { request, context } = createFormDataRequest('person-1', file);
      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('50MB');
    });

    it('should return 404 for non-existent person', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const file = new Blob([JPEG_HEADER], { type: 'image/jpeg' });
      const { request, context } = createFormDataRequest('non-existent', file);
      const response = await POST(request, context);

      expect(response.status).toBe(404);
    });

    it('should return 400 for unsupported image format', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });
      mocks.savePhotoFromBuffer.mockRejectedValue(
        new Error('Unsupported image format')
      );

      const file = new Blob([Buffer.from('not-an-image')], { type: 'application/octet-stream' });
      const { request, context } = createFormDataRequest('person-1', file);
      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Unsupported image format');
    });

    it('should return 404 for person owned by different user', async () => {
      // findUnique returns null because userId doesn't match
      mocks.personFindUnique.mockResolvedValue(null);

      const file = new Blob([JPEG_HEADER], { type: 'image/jpeg' });
      const { request, context } = createFormDataRequest('other-user-person', file);
      const response = await POST(request, context);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/people/[id]/photo', () => {
    it('should delete a photo successfully', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });
      mocks.personUpdate.mockResolvedValue({ id: 'person-1', photo: null });

      const request = new Request('http://localhost/api/people/person-1/photo', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Should verify person ownership
      expect(mocks.personFindUnique).toHaveBeenCalledWith({
        where: {
          id: 'person-1',
          userId: 'user-123',
          deletedAt: null,
        },
        select: { id: true },
      });

      // Should delete photo files
      expect(mocks.deletePersonPhotos).toHaveBeenCalledWith('user-123', 'person-1');

      // Should clear photo field
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: 'person-1' },
        data: { photo: null },
      });
    });

    it('should return 404 for non-existent person', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent/photo', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await DELETE(request, context);

      expect(response.status).toBe(404);
    });

    it('should return 200 even if no photo existed (idempotent)', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1' });
      mocks.personUpdate.mockResolvedValue({ id: 'person-1', photo: null });

      const request = new Request('http://localhost/api/people/person-1/photo', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should return 404 for person owned by different user', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/other-user-person/photo', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'other-user-person' }) };
      const response = await DELETE(request, context);

      expect(response.status).toBe(404);
    });
  });
});
