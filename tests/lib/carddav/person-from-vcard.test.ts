/**
 * Unit tests for person-from-vcard helpers (lib/carddav/person-from-vcard.ts)
 *
 * Focuses on:
 * - Scalar fields passed as `null` (not `undefined`) so Prisma clears them
 * - Multi-value fields replaced correctly on update
 * - Photo handling during updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => ({
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  personPhoneDeleteMany: vi.fn(),
  personEmailDeleteMany: vi.fn(),
  personAddressDeleteMany: vi.fn(),
  personUrlDeleteMany: vi.fn(),
  personIMDeleteMany: vi.fn(),
  personLocationDeleteMany: vi.fn(),
  personCustomFieldDeleteMany: vi.fn(),
  importantDateDeleteMany: vi.fn(),
  $transaction: vi.fn(),

  savePhoto: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      create: mocks.personCreate,
      update: mocks.personUpdate,
    },
    personPhone: { deleteMany: mocks.personPhoneDeleteMany },
    personEmail: { deleteMany: mocks.personEmailDeleteMany },
    personAddress: { deleteMany: mocks.personAddressDeleteMany },
    personUrl: { deleteMany: mocks.personUrlDeleteMany },
    personIM: { deleteMany: mocks.personIMDeleteMany },
    personLocation: { deleteMany: mocks.personLocationDeleteMany },
    personCustomField: { deleteMany: mocks.personCustomFieldDeleteMany },
    importantDate: { deleteMany: mocks.importantDateDeleteMany },
    $transaction: mocks.$transaction,
  },
}));

vi.mock('@/lib/photo-storage', () => ({
  savePhoto: mocks.savePhoto,
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid'),
}));

// --- Import after mocks ---
import {
  updatePersonFromVCard,
  createPersonFromVCardData,
  restorePersonFromVCardData,
  savePhotoForPerson,
} from '@/lib/carddav/vcard-import';
import type { ParsedVCardData } from '@/lib/carddav/types';

// --- Helpers ---

const USER_ID = 'user-1';
const PERSON_ID = 'person-1';

/** Minimal parsed vCard with only the required `name` field set. */
function makeMinimalParsedData(overrides: Partial<ParsedVCardData> = {}): ParsedVCardData {
  return {
    name: 'Alice',
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    importantDates: [],
    categories: [],
    customFields: [],
    ...overrides,
  };
}

// --- Tests ---

describe('person-from-vcard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: $transaction executes the callback with a mock tx that mirrors prisma
    mocks.$transaction.mockImplementation(
      async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          person: { update: mocks.personUpdate },
          personPhone: { deleteMany: mocks.personPhoneDeleteMany },
          personEmail: { deleteMany: mocks.personEmailDeleteMany },
          personAddress: { deleteMany: mocks.personAddressDeleteMany },
          personUrl: { deleteMany: mocks.personUrlDeleteMany },
          personIM: { deleteMany: mocks.personIMDeleteMany },
          personLocation: { deleteMany: mocks.personLocationDeleteMany },
          personCustomField: { deleteMany: mocks.personCustomFieldDeleteMany },
          importantDate: { deleteMany: mocks.importantDateDeleteMany },
        };
        return fn(tx);
      },
    );

    mocks.personUpdate.mockResolvedValue({});
    mocks.personCreate.mockResolvedValue({ id: PERSON_ID });
    mocks.savePhoto.mockResolvedValue(null);
  });

  describe('updatePersonFromVCard', () => {
    const OPTIONAL_SCALAR_FIELDS = [
      'surname',
      'secondLastName',
      'middleName',
      'prefix',
      'suffix',
      'nickname',
      'organization',
      'jobTitle',
      'gender',
      'notes',
    ] as const;

    it('passes null (not undefined) for missing optional scalar fields', async () => {
      // parsedData has no optional scalars set → they are all undefined
      const parsedData = makeMinimalParsedData();

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      expect(mocks.personUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mocks.personUpdate.mock.calls[0][0];
      const data = updateCall.data;

      for (const field of OPTIONAL_SCALAR_FIELDS) {
        expect(data[field]).toBeNull();
      }
    });

    it('passes null for missing date fields (anniversary, lastContact)', async () => {
      const parsedData = makeMinimalParsedData();

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      const data = mocks.personUpdate.mock.calls[0][0].data;
      expect(data.anniversary).toBeNull();
      expect(data.lastContact).toBeNull();
    });

    it('passes null for photo when remote contact has no photo', async () => {
      const parsedData = makeMinimalParsedData();

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      const data = mocks.personUpdate.mock.calls[0][0].data;
      expect(data.photo).toBeNull();
    });

    it('preserves actual values when fields are present', async () => {
      const anniversary = new Date('2020-06-15');
      const parsedData = makeMinimalParsedData({
        nickname: 'Ali',
        surname: 'Smith',
        organization: 'Acme',
        jobTitle: 'Engineer',
        gender: 'female',
        notes: 'Some notes',
        anniversary,
      });

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      const data = mocks.personUpdate.mock.calls[0][0].data;
      expect(data.nickname).toBe('Ali');
      expect(data.surname).toBe('Smith');
      expect(data.organization).toBe('Acme');
      expect(data.jobTitle).toBe('Engineer');
      expect(data.gender).toBe('female');
      expect(data.notes).toBe('Some notes');
      expect(data.anniversary).toBe(anniversary);
    });

    it('saves photo file and uses filename in update', async () => {
      const parsedData = makeMinimalParsedData({ photo: 'base64-photo-data' });
      mocks.savePhoto.mockResolvedValue('photos/user-1/person-1.jpg');

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      expect(mocks.savePhoto).toHaveBeenCalledWith(USER_ID, PERSON_ID, 'base64-photo-data');
      const data = mocks.personUpdate.mock.calls[0][0].data;
      expect(data.photo).toBe('photos/user-1/person-1.jpg');
    });

    it('deletes all multi-value records before recreating', async () => {
      const parsedData = makeMinimalParsedData({
        phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
        emails: [{ type: 'work', email: 'a@b.com' }],
      });

      await updatePersonFromVCard(PERSON_ID, parsedData, USER_ID);

      expect(mocks.personPhoneDeleteMany).toHaveBeenCalledWith({
        where: { personId: PERSON_ID },
      });
      expect(mocks.personEmailDeleteMany).toHaveBeenCalledWith({
        where: { personId: PERSON_ID },
      });
      expect(mocks.personAddressDeleteMany).toHaveBeenCalledWith({
        where: { personId: PERSON_ID },
      });
    });
  });

  describe('createPersonFromVCardData', () => {
    it('creates a person with name defaulting to empty string when missing', async () => {
      const parsedData = makeMinimalParsedData({ name: '' });

      await createPersonFromVCardData(USER_ID, parsedData);

      expect(mocks.personCreate).toHaveBeenCalledTimes(1);
      const createCall = mocks.personCreate.mock.calls[0][0];
      expect(createCall.data.name).toBe('');
    });

    it('generates a UID when none provided', async () => {
      const parsedData = makeMinimalParsedData();

      await createPersonFromVCardData(USER_ID, parsedData);

      const createCall = mocks.personCreate.mock.calls[0][0];
      expect(createCall.data.uid).toBe('generated-uuid');
    });

    it('calls savePhoto when creating person with photo (processes via sharp pipeline)', async () => {
      const parsedData = makeMinimalParsedData({ photo: 'data:image/jpeg;base64,/9j/4AAQ...' });
      mocks.savePhoto.mockResolvedValue('person-1.jpg');

      await createPersonFromVCardData(USER_ID, parsedData);

      expect(mocks.savePhoto).toHaveBeenCalledWith(USER_ID, PERSON_ID, 'data:image/jpeg;base64,/9j/4AAQ...');
      const updateCall = mocks.personUpdate.mock.calls[0][0];
      expect(updateCall.data.photo).toBe('person-1.jpg');
    });

    it('handles savePhoto failure gracefully during create', async () => {
      const parsedData = makeMinimalParsedData({ photo: 'data:image/jpeg;base64,/9j/4AAQ...' });
      mocks.savePhoto.mockResolvedValue(null);

      await createPersonFromVCardData(USER_ID, parsedData);

      expect(mocks.savePhoto).toHaveBeenCalledWith(USER_ID, PERSON_ID, 'data:image/jpeg;base64,/9j/4AAQ...');
      // When savePhoto returns null, photo field should not be updated
      expect(mocks.personUpdate).not.toHaveBeenCalled();
    });

    it('skips photo processing when vCard has no photo', async () => {
      const parsedData = makeMinimalParsedData();

      await createPersonFromVCardData(USER_ID, parsedData);

      expect(mocks.savePhoto).not.toHaveBeenCalled();
    });
  });

  describe('restorePersonFromVCardData', () => {
    it('calls savePhoto when restoring person with photo (processes via sharp pipeline)', async () => {
      const parsedData = makeMinimalParsedData({ photo: 'data:image/jpeg;base64,/9j/4AAQ...' });
      mocks.savePhoto.mockResolvedValue('person-1.jpg');
      mocks.personUpdate.mockResolvedValue({ id: PERSON_ID });

      await restorePersonFromVCardData(USER_ID, PERSON_ID, parsedData);

      expect(mocks.savePhoto).toHaveBeenCalledWith(USER_ID, PERSON_ID, 'data:image/jpeg;base64,/9j/4AAQ...');
      const calls = mocks.personUpdate.mock.calls;
      expect(calls[calls.length - 1][0].data.photo).toBe('person-1.jpg');
    });

    it('handles savePhoto failure gracefully during restore', async () => {
      const parsedData = makeMinimalParsedData({ photo: 'data:image/jpeg;base64,/9j/4AAQ...' });
      mocks.savePhoto.mockResolvedValue(null);
      mocks.personUpdate.mockResolvedValue({ id: PERSON_ID });

      await restorePersonFromVCardData(USER_ID, PERSON_ID, parsedData);

      expect(mocks.savePhoto).toHaveBeenCalled();
      const calls = mocks.personUpdate.mock.calls;
      expect(calls.length).toBe(1); // Only the initial restore, not a second update
    });

    it('sets photo to null when restored person has no photo', async () => {
      const parsedData = makeMinimalParsedData();
      mocks.personUpdate.mockResolvedValue({ id: PERSON_ID });

      await restorePersonFromVCardData(USER_ID, PERSON_ID, parsedData);

      const data = mocks.personUpdate.mock.calls[0][0].data;
      expect(data.photo).toBeNull();
    });
  });

  describe('savePhotoForPerson', () => {
    it('calls savePhoto and updates person record with filename', async () => {
      const photoData = 'data:image/jpeg;base64,/9j/4AAQ...';
      mocks.savePhoto.mockResolvedValue('person-1.jpg');

      await savePhotoForPerson(USER_ID, PERSON_ID, photoData);

      expect(mocks.savePhoto).toHaveBeenCalledWith(USER_ID, PERSON_ID, photoData);
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PERSON_ID },
        data: { photo: 'person-1.jpg' },
      });
    });

    it('skips update when savePhoto returns null (failure)', async () => {
      const photoData = 'data:image/jpeg;base64,/9j/4AAQ...';
      mocks.savePhoto.mockResolvedValue(null);

      await savePhotoForPerson(USER_ID, PERSON_ID, photoData);

      expect(mocks.savePhoto).toHaveBeenCalled();
      expect(mocks.personUpdate).not.toHaveBeenCalled();
    });
  });
});
