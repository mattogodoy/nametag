import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personDelete: vi.fn(),
  personGroupDeleteMany: vi.fn(),
  importantDateDeleteMany: vi.fn(),
  relationshipDeleteMany: vi.fn(),
  personPhoneDeleteMany: vi.fn(),
  personEmailDeleteMany: vi.fn(),
  personAddressDeleteMany: vi.fn(),
  personUrlDeleteMany: vi.fn(),
  personIMDeleteMany: vi.fn(),
  personLocationDeleteMany: vi.fn(),
  personCustomFieldDeleteMany: vi.fn(),
  personCustomFieldValueDeleteMany: vi.fn(),
  cardDavMappingDeleteMany: vi.fn(),
  duplicateDismissalDeleteMany: vi.fn(),
  journalEntryPersonDeleteMany: vi.fn(),
  disconnect: vi.fn(),
  deletePersonPhotos: vi.fn(),
  // Group mocks
  groupFindUnique: vi.fn(),
  groupDelete: vi.fn(),
  groupPersonGroupDeleteMany: vi.fn(),
  // Relationship mocks
  relationshipFindUnique: vi.fn(),
  relationshipDelete: vi.fn(),
  relationshipFindFirst: vi.fn(),
  personFindFirst: vi.fn(),
  // Relationship type mocks
  relationshipTypeFindFirst: vi.fn(),
  relationshipTypeDelete: vi.fn(),
  personUpdateMany: vi.fn(),
  relationshipUpdateMany: vi.fn(),
  relationshipTypeUpdateMany: vi.fn(),
  // Important date mocks
  importantDateFindUnique: vi.fn(),
  importantDateDelete: vi.fn(),
  importantDatePersonFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  withDeleted: () => ({
    person: {
      findUnique: mocks.personFindUnique,
      findFirst: mocks.personFindFirst,
      delete: mocks.personDelete,
      updateMany: mocks.personUpdateMany,
    },
    personGroup: { deleteMany: mocks.personGroupDeleteMany },
    importantDate: {
      findUnique: mocks.importantDateFindUnique,
      delete: mocks.importantDateDelete,
      deleteMany: mocks.importantDateDeleteMany,
    },
    relationship: {
      findUnique: mocks.relationshipFindUnique,
      findFirst: mocks.relationshipFindFirst,
      delete: mocks.relationshipDelete,
      deleteMany: mocks.relationshipDeleteMany,
      updateMany: mocks.relationshipUpdateMany,
    },
    group: {
      findUnique: mocks.groupFindUnique,
      delete: mocks.groupDelete,
    },
    relationshipType: {
      findFirst: mocks.relationshipTypeFindFirst,
      delete: mocks.relationshipTypeDelete,
      updateMany: mocks.relationshipTypeUpdateMany,
    },
    personPhone: { deleteMany: mocks.personPhoneDeleteMany },
    personEmail: { deleteMany: mocks.personEmailDeleteMany },
    personAddress: { deleteMany: mocks.personAddressDeleteMany },
    personUrl: { deleteMany: mocks.personUrlDeleteMany },
    personIM: { deleteMany: mocks.personIMDeleteMany },
    personLocation: { deleteMany: mocks.personLocationDeleteMany },
    personCustomField: { deleteMany: mocks.personCustomFieldDeleteMany },
    personCustomFieldValue: { deleteMany: mocks.personCustomFieldValueDeleteMany },
    cardDavMapping: { deleteMany: mocks.cardDavMappingDeleteMany },
    duplicateDismissal: { deleteMany: mocks.duplicateDismissalDeleteMany },
    journalEntryPerson: { deleteMany: mocks.journalEntryPersonDeleteMany },
    $disconnect: mocks.disconnect,
  }),
}));

vi.mock('../../lib/photo-storage', () => ({
  deletePersonPhotos: mocks.deletePersonPhotos,
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { DELETE as deletePerson } from '../../app/api/people/[id]/permanent/route';
import { DELETE as deleteGroup } from '../../app/api/groups/[id]/permanent/route';
import { DELETE as deleteRelationship } from '../../app/api/relationships/[id]/permanent/route';
import { DELETE as deleteRelationshipType } from '../../app/api/relationship-types/[id]/permanent/route';
import { DELETE as deleteImportantDate } from '../../app/api/people/[id]/important-dates/[dateId]/permanent/route';

describe('Permanent delete API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DELETE /api/people/[id]/permanent', () => {
    it('should return 404 when person not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/p1/permanent');
      const context = { params: Promise.resolve({ id: 'p1' }) };
      const response = await deletePerson(request, context);

      expect(response.status).toBe(404);
    });

    it('should return 400 when person is not deleted', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-123',
        deletedAt: null,
      });

      const request = new Request('http://localhost/api/people/p1/permanent');
      const context = { params: Promise.resolve({ id: 'p1' }) };
      const response = await deletePerson(request, context);

      expect(response.status).toBe(400);
    });

    it('should permanently delete a trashed person and cascade', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mocks.deletePersonPhotos.mockResolvedValue(undefined);
      mocks.personGroupDeleteMany.mockResolvedValue({ count: 0 });
      mocks.importantDateDeleteMany.mockResolvedValue({ count: 0 });
      mocks.relationshipDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personPhoneDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personEmailDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personAddressDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personUrlDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personIMDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personLocationDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personCustomFieldDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personCustomFieldValueDeleteMany.mockResolvedValue({ count: 0 });
      mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });
      mocks.duplicateDismissalDeleteMany.mockResolvedValue({ count: 0 });
      mocks.journalEntryPersonDeleteMany.mockResolvedValue({ count: 0 });
      mocks.personDelete.mockResolvedValue({ id: 'p1' });

      const request = new Request('http://localhost/api/people/p1/permanent');
      const context = { params: Promise.resolve({ id: 'p1' }) };
      const response = await deletePerson(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mocks.deletePersonPhotos).toHaveBeenCalledWith('user-123', 'p1');
      expect(mocks.personDelete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });

  describe('DELETE /api/groups/[id]/permanent', () => {
    it('should return 404 when group not found', async () => {
      mocks.groupFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/groups/g1/permanent');
      const context = { params: Promise.resolve({ id: 'g1' }) };
      const response = await deleteGroup(request, context);

      expect(response.status).toBe(404);
    });

    it('should permanently delete a trashed group and its memberships', async () => {
      mocks.groupFindUnique.mockResolvedValue({
        id: 'g1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mocks.personGroupDeleteMany.mockResolvedValue({ count: 2 });
      mocks.groupDelete.mockResolvedValue({ id: 'g1' });

      const request = new Request('http://localhost/api/groups/g1/permanent');
      const context = { params: Promise.resolve({ id: 'g1' }) };
      const response = await deleteGroup(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mocks.personGroupDeleteMany).toHaveBeenCalledWith({
        where: { groupId: 'g1' },
      });
    });
  });

  describe('DELETE /api/relationships/[id]/permanent', () => {
    it('should permanently delete a trashed relationship and its inverse', async () => {
      mocks.relationshipFindUnique.mockResolvedValue({
        id: 'r1',
        personId: 'p1',
        relatedPersonId: 'p2',
        deletedAt: new Date(),
        person: { userId: 'user-123' },
      });
      mocks.relationshipFindFirst.mockResolvedValue({
        id: 'r2',
        deletedAt: new Date(),
      });
      mocks.relationshipDelete.mockResolvedValue({ id: 'r1' });

      const request = new Request('http://localhost/api/relationships/r1/permanent');
      const context = { params: Promise.resolve({ id: 'r1' }) };
      const response = await deleteRelationship(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      // Should delete both the relationship and its inverse
      expect(mocks.relationshipDelete).toHaveBeenCalledTimes(2);
    });
  });

  describe('DELETE /api/relationship-types/[id]/permanent', () => {
    it('should permanently delete a trashed relationship type and clean refs', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue({
        id: 'rt1',
        userId: 'user-123',
        deletedAt: new Date(),
      });
      mocks.personUpdateMany.mockResolvedValue({ count: 0 });
      mocks.relationshipUpdateMany.mockResolvedValue({ count: 0 });
      mocks.relationshipTypeUpdateMany.mockResolvedValue({ count: 0 });
      mocks.relationshipTypeDelete.mockResolvedValue({ id: 'rt1' });

      const request = new Request('http://localhost/api/relationship-types/rt1/permanent');
      const context = { params: Promise.resolve({ id: 'rt1' }) };
      const response = await deleteRelationshipType(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mocks.personUpdateMany).toHaveBeenCalled();
      expect(mocks.relationshipUpdateMany).toHaveBeenCalled();
      expect(mocks.relationshipTypeUpdateMany).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/people/[id]/important-dates/[dateId]/permanent', () => {
    it('should permanently delete a trashed important date', async () => {
      mocks.importantDatePersonFindUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-123',
      });
      mocks.importantDateFindUnique.mockResolvedValue({
        id: 'd1',
        personId: 'p1',
        deletedAt: new Date(),
      });
      mocks.importantDateDelete.mockResolvedValue({ id: 'd1' });

      const request = new Request('http://localhost/api/people/p1/important-dates/d1/permanent');
      const context = { params: Promise.resolve({ id: 'p1', dateId: 'd1' }) };
      const response = await deleteImportantDate(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
