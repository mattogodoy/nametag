/**
 * Tests for /api/vcard/upload endpoint
 * Verifies vCard file upload and pending import creation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/vcard/upload/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/auth');
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    cardDavPendingImport: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('POST /api/vcard/upload', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
  });

  describe('secondLastName in displayName', () => {
    it('should include secondLastName in displayName when present', async () => {
      const vcardWithSecondLastName = `BEGIN:VCARD
VERSION:3.0
FN:Mauro Belluco De La Rosa
N:Belluco De La Rosa;Mauro;;;
X-NAMETAG-SECOND-LASTNAME:De La Rosa
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const mockCreatedImport = {
        id: 'import-1',
        displayName: 'Mauro Belluco De La Rosa',
      };

      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreatedImport);

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardWithSecondLastName,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);

      // Verify displayName includes all name parts
      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('Mauro Belluco De La Rosa');
    });

    it('should handle Spanish names with secondLastName', async () => {
      const vcardSpanish = `BEGIN:VCARD
VERSION:3.0
FN:Juan García López
N:García López;Juan;;;
X-NAMETAG-SECOND-LASTNAME:López
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardSpanish,
      });

      await POST(request);

      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('Juan García López');
    });

    it('should work without secondLastName', async () => {
      const vcardSimple = `BEGIN:VCARD
VERSION:3.0
FN:John Smith
N:Smith;John;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardSimple,
      });

      await POST(request);

      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('John Smith');
    });

    it('should include prefix and suffix in displayName', async () => {
      const vcardWithTitles = `BEGIN:VCARD
VERSION:3.0
FN:Dr. John Smith Jr.
N:Smith;John;;Dr.;Jr.
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardWithTitles,
      });

      await POST(request);

      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('Dr. John Smith Jr.');
    });

    it('should fallback to nickname if name is empty', async () => {
      const vcardNickname = `BEGIN:VCARD
VERSION:3.0
FN:
N:;;;;
NICKNAME:Johnny
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardNickname,
      });

      await POST(request);

      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('Johnny');
    });

    it('should use "Unknown Contact" as last resort', async () => {
      const vcardEmpty = `BEGIN:VCARD
VERSION:3.0
FN:
N:;;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcardEmpty,
      });

      await POST(request);

      const createCall = (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createCall.data.displayName).toBe('Unknown Contact');
    });
  });

  describe('Multi-contact vCard files', () => {
    it('should handle multiple vCards in one file', async () => {
      const multiVcard = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
N:Smith;Jane;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'import-1' })
        .mockResolvedValueOnce({ id: 'import-2' });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: multiVcard,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.count).toBe(2);
      expect(prisma.cardDavPendingImport.create).toHaveBeenCalledTimes(2);
    });

    it('should continue processing if one vCard fails to parse', async () => {
      const mixedVcard = `BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
END:VCARD
INVALID VCARD DATA
BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
N:Smith;Jane;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });

      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ id: 'import-1' })
        .mockResolvedValueOnce({ id: 'import-2' });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: mixedVcard,
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still import the valid ones
      expect(data.success).toBe(true);
      expect(data.count).toBeGreaterThan(0);
    });
  });

  describe('Special file import connection', () => {
    it('should use special connection ID for file imports', async () => {
      const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test User
N:User;Test;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.cardDavConnection.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });
      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcard,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.connectionId).toBe('00000000-0000-0000-0000-000000000001');

      // Verify connection was created with correct ID
      expect(prisma.cardDavConnection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: '00000000-0000-0000-0000-000000000001',
          userId: 'user-123',
          serverUrl: 'file-import',
          username: 'file-import',
          syncEnabled: false,
          autoExportNew: false,
        }),
      });
    });

    it('should delete existing pending imports before creating new ones', async () => {
      const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test User
N:User;Test;;;
END:VCARD`;

      (prisma.cardDavConnection.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
      });
      (prisma.cardDavPendingImport.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardDavPendingImport.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'import-1',
      });

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: vcard,
      });

      await POST(request);

      expect(prisma.cardDavPendingImport.deleteMany).toHaveBeenCalledWith({
        where: {
          connectionId: '00000000-0000-0000-0000-000000000001',
          uploadedByUserId: 'user-123',
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should return 401 if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: 'BEGIN:VCARD\nEND:VCARD',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid vCard data', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: 'INVALID DATA',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty request body', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      const request = new Request('http://localhost/api/vcard/upload', {
        method: 'POST',
        body: '',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
