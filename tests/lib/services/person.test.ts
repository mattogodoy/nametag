import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must be defined before any imports that use them)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  // Individual mock functions
  const personCreate = vi.fn();
  const personUpdate = vi.fn();
  const personFindUnique = vi.fn();
  const transaction = vi.fn();
  const cardDavMappingDeleteMany = vi.fn();
  const personGroupDeleteMany = vi.fn();
  const personGroupCreateMany = vi.fn();
  const relationshipUpdateMany = vi.fn();
  const personPhoneUpdateMany = vi.fn();
  const personPhoneDeleteMany = vi.fn();
  const personEmailUpdateMany = vi.fn();
  const personEmailDeleteMany = vi.fn();
  const personAddressUpdateMany = vi.fn();
  const personAddressDeleteMany = vi.fn();
  const personUrlUpdateMany = vi.fn();
  const personUrlDeleteMany = vi.fn();
  const personIMUpdateMany = vi.fn();
  const personIMDeleteMany = vi.fn();
  const personLocationUpdateMany = vi.fn();
  const personLocationDeleteMany = vi.fn();
  const personCustomFieldUpdateMany = vi.fn();
  const personCustomFieldDeleteMany = vi.fn();
  const importantDateUpdateMany = vi.fn();
  const importantDateDeleteMany = vi.fn();
  const journalEntryPersonFindMany = vi.fn();
  const journalEntryPersonUpdateMany = vi.fn();
  const journalEntryPersonDeleteMany = vi.fn();
  const withDeletedPersonFindUnique = vi.fn();
  const withDeletedPersonUpdate = vi.fn();
  const withDeletedDisconnect = vi.fn();
  const autoExportPerson = vi.fn();
  const autoUpdatePerson = vi.fn();

  const mockTxClient = {
    person: { update: personUpdate },
    cardDavMapping: { deleteMany: cardDavMappingDeleteMany, findUnique: vi.fn() },
    personGroup: { deleteMany: personGroupDeleteMany, createMany: personGroupCreateMany },
    relationship: { updateMany: relationshipUpdateMany },
    personPhone: { updateMany: personPhoneUpdateMany, deleteMany: personPhoneDeleteMany },
    personEmail: { updateMany: personEmailUpdateMany, deleteMany: personEmailDeleteMany },
    personAddress: { updateMany: personAddressUpdateMany, deleteMany: personAddressDeleteMany },
    personUrl: { updateMany: personUrlUpdateMany, deleteMany: personUrlDeleteMany },
    personIM: { updateMany: personIMUpdateMany, deleteMany: personIMDeleteMany },
    personLocation: { updateMany: personLocationUpdateMany, deleteMany: personLocationDeleteMany },
    personCustomField: { updateMany: personCustomFieldUpdateMany, deleteMany: personCustomFieldDeleteMany },
    importantDate: { updateMany: importantDateUpdateMany, deleteMany: importantDateDeleteMany },
    journalEntryPerson: {
      findMany: journalEntryPersonFindMany,
      updateMany: journalEntryPersonUpdateMany,
      deleteMany: journalEntryPersonDeleteMany,
    },
  };

  return {
    personCreate,
    personUpdate,
    personFindUnique,
    transaction,
    cardDavMappingDeleteMany,
    personGroupDeleteMany,
    personGroupCreateMany,
    relationshipUpdateMany,
    personPhoneUpdateMany,
    personPhoneDeleteMany,
    personEmailUpdateMany,
    personEmailDeleteMany,
    personAddressUpdateMany,
    personAddressDeleteMany,
    personUrlUpdateMany,
    personUrlDeleteMany,
    personIMUpdateMany,
    personIMDeleteMany,
    personLocationUpdateMany,
    personLocationDeleteMany,
    personCustomFieldUpdateMany,
    personCustomFieldDeleteMany,
    importantDateUpdateMany,
    importantDateDeleteMany,
    journalEntryPersonFindMany,
    journalEntryPersonUpdateMany,
    journalEntryPersonDeleteMany,
    withDeletedPersonFindUnique,
    withDeletedPersonUpdate,
    withDeletedDisconnect,
    autoExportPerson,
    autoUpdatePerson,
    mockTxClient,
  };
});

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    person: {
      create: mocks.personCreate,
      update: mocks.personUpdate,
      findUnique: mocks.personFindUnique,
    },
    $transaction: mocks.transaction,
    cardDavMapping: { deleteMany: mocks.cardDavMappingDeleteMany },
    personGroup: {
      deleteMany: mocks.personGroupDeleteMany,
      createMany: mocks.personGroupCreateMany,
    },
    relationship: { updateMany: mocks.relationshipUpdateMany },
    personPhone: { updateMany: mocks.personPhoneUpdateMany, deleteMany: mocks.personPhoneDeleteMany },
    personEmail: { updateMany: mocks.personEmailUpdateMany, deleteMany: mocks.personEmailDeleteMany },
    personAddress: { updateMany: mocks.personAddressUpdateMany, deleteMany: mocks.personAddressDeleteMany },
    personUrl: { updateMany: mocks.personUrlUpdateMany, deleteMany: mocks.personUrlDeleteMany },
    personIM: { updateMany: mocks.personIMUpdateMany, deleteMany: mocks.personIMDeleteMany },
    personLocation: { updateMany: mocks.personLocationUpdateMany, deleteMany: mocks.personLocationDeleteMany },
    personCustomField: { updateMany: mocks.personCustomFieldUpdateMany, deleteMany: mocks.personCustomFieldDeleteMany },
    importantDate: { updateMany: mocks.importantDateUpdateMany, deleteMany: mocks.importantDateDeleteMany },
    journalEntryPerson: {
      findMany: mocks.journalEntryPersonFindMany,
      updateMany: mocks.journalEntryPersonUpdateMany,
      deleteMany: mocks.journalEntryPersonDeleteMany,
    },
  },
  withDeleted: vi.fn(() => ({
    person: {
      findUnique: mocks.withDeletedPersonFindUnique,
      update: mocks.withDeletedPersonUpdate,
    },
    $disconnect: mocks.withDeletedDisconnect,
  })),
}));

vi.mock('../../../lib/carddav/auto-export', () => ({
  autoExportPerson: mocks.autoExportPerson,
  autoUpdatePerson: mocks.autoUpdatePerson,
}));

// ---------------------------------------------------------------------------
// Module under test (imported AFTER mocks)
// ---------------------------------------------------------------------------

import {
  createPerson,
  updatePerson,
  deletePerson,
  restorePerson,
  mergePeople,
} from '../../../lib/services/person';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-1';
const PERSON_ID = 'person-1';
const SOURCE_ID = 'person-2';

function makeMinimalPersonData() {
  return {
    name: 'Alice',
    relationshipToUserId: 'rel-type-1',
  };
}

function makeFullPersonData() {
  return {
    name: 'Alice',
    surname: 'Smith',
    middleName: 'M',
    secondLastName: 'Jones',
    nickname: 'Ali',
    prefix: 'Dr',
    suffix: 'Jr',
    uid: 'uid-123',
    organization: 'Acme',
    jobTitle: 'Engineer',
    photo: null,
    gender: 'F',
    anniversary: '2020-06-15',
    lastContact: '2024-01-01',
    notes: 'Some notes',
    relationshipToUserId: 'rel-type-1',
    groupIds: ['group-1', 'group-2'],
    importantDates: [
      {
        title: 'Birthday',
        date: '1990-03-14',
        reminderEnabled: false,
      },
    ],
    contactReminderEnabled: false,
    cardDavSyncEnabled: true,
    phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
    emails: [{ type: 'work', email: 'alice@example.com' }],
    addresses: [
      {
        type: 'home',
        streetLine1: '123 Main St',
        streetLine2: null,
        locality: 'Springfield',
        region: 'IL',
        postalCode: '62701',
        country: 'US',
      },
    ],
    urls: [{ type: 'website', url: 'https://alice.example.com' }],
    imHandles: [{ protocol: 'telegram' as const, handle: '@alice' }],
    locations: [{ type: 'home' as const, latitude: 40.7128, longitude: -74.006 }],
    customFields: [{ key: 'X-CUSTOM', value: 'value1', type: null }],
  };
}

function makeExistingPerson(overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    userId: USER_ID,
    deletedAt: null,
    name: 'Alice',
    surname: null,
    cardDavSyncEnabled: true,
    contactReminderEnabled: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autoExportPerson.mockResolvedValue(undefined);
  mocks.autoUpdatePerson.mockResolvedValue(undefined);
  mocks.withDeletedDisconnect.mockResolvedValue(undefined);
});

// ===========================================================================
// createPerson
// ===========================================================================

describe('createPerson', () => {
  const createdPerson = { id: PERSON_ID, name: 'Alice', groups: [] };

  beforeEach(() => {
    mocks.personCreate.mockResolvedValue(createdPerson);
  });

  it('calls prisma.person.create with user connect and sanitized name', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());

    expect(mocks.personCreate).toHaveBeenCalledOnce();
    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.user).toEqual({ connect: { id: USER_ID } });
    expect(call.data.name).toBe('Alice');
  });

  it('connects relationshipToUser when provided', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.relationshipToUser).toEqual({ connect: { id: 'rel-type-1' } });
  });

  it('omits relationshipToUser when not provided', async () => {
    const data = { name: 'Bob' };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.relationshipToUser).toBeUndefined();
  });

  it('creates group associations when groupIds are provided', async () => {
    const data = { ...makeMinimalPersonData(), groupIds: ['g1', 'g2'] };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.groups).toEqual({
      create: [{ groupId: 'g1' }, { groupId: 'g2' }],
    });
  });

  it('omits groups when groupIds not provided', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());
    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.groups).toBeUndefined();
  });

  it('creates phoneNumbers when provided', async () => {
    const data = {
      ...makeMinimalPersonData(),
      phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
    };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.phoneNumbers).toEqual({
      create: [{ type: 'mobile', number: '+1234567890' }],
    });
  });

  it('creates emails when provided', async () => {
    const data = {
      ...makeMinimalPersonData(),
      emails: [{ type: 'work', email: 'test@example.com' }],
    };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.emails).toEqual({
      create: [{ type: 'work', email: 'test@example.com' }],
    });
  });

  it('creates addresses with null coercion for optional fields', async () => {
    const data = {
      ...makeMinimalPersonData(),
      addresses: [{ type: 'home', streetLine1: '123 Main St' }],
    };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.addresses.create[0]).toMatchObject({
      type: 'home',
      streetLine1: '123 Main St',
      streetLine2: null,
      locality: null,
      region: null,
      postalCode: null,
      country: null,
    });
  });

  it('creates importantDates with correct date transformation', async () => {
    const data = {
      ...makeMinimalPersonData(),
      importantDates: [{ title: 'Birthday', date: '1990-03-14', reminderEnabled: false }],
    };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.importantDates.create[0]).toMatchObject({
      title: 'Birthday',
      reminderEnabled: false,
      reminderType: null,
    });
    expect(call.data.importantDates.create[0].date).toBeInstanceOf(Date);
  });

  it('sets year to 1604 when yearUnknown is true', async () => {
    const data = {
      ...makeMinimalPersonData(),
      importantDates: [{ title: 'Birthday', date: '1990-03-14', yearUnknown: true, reminderEnabled: false }],
    };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    const dateValue = call.data.importantDates.create[0].date as Date;
    expect(dateValue.getFullYear()).toBe(1604);
  });

  it('converts anniversary string to Date', async () => {
    const data = { ...makeMinimalPersonData(), anniversary: '2020-06-15' };
    await createPerson(USER_ID, data);

    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.anniversary).toBeInstanceOf(Date);
  });

  it('sets anniversary to null when not provided', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());
    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.anniversary).toBeNull();
  });

  it('returns the created person', async () => {
    const result = await createPerson(USER_ID, makeMinimalPersonData());
    expect(result).toEqual(createdPerson);
  });

  it('schedules auto-export when cardDavSyncEnabled is not false', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());
    await Promise.resolve();
    expect(mocks.autoExportPerson).toHaveBeenCalledWith(PERSON_ID);
  });

  it('does NOT schedule auto-export when cardDavSyncEnabled is false', async () => {
    const data = { ...makeMinimalPersonData(), cardDavSyncEnabled: false };
    await createPerson(USER_ID, data);
    await Promise.resolve();
    expect(mocks.autoExportPerson).not.toHaveBeenCalled();
  });

  it('defaults cardDavSyncEnabled to true', async () => {
    await createPerson(USER_ID, makeMinimalPersonData());
    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.cardDavSyncEnabled).toBe(true);
  });

  it('includes all multi-value fields from full data', async () => {
    await createPerson(USER_ID, makeFullPersonData());
    const call = mocks.personCreate.mock.calls[0][0];
    expect(call.data.phoneNumbers).toBeDefined();
    expect(call.data.emails).toBeDefined();
    expect(call.data.addresses).toBeDefined();
    expect(call.data.urls).toBeDefined();
    expect(call.data.imHandles).toBeDefined();
    expect(call.data.locations).toBeDefined();
    expect(call.data.customFields).toBeDefined();
  });
});

// ===========================================================================
// updatePerson
// ===========================================================================

describe('updatePerson', () => {
  const updatedPerson = { id: PERSON_ID, name: 'Alice Updated', groups: [] };

  beforeEach(() => {
    mocks.personFindUnique.mockResolvedValue(makeExistingPerson());
    mocks.personUpdate.mockResolvedValue(updatedPerson);
  });

  it('returns null when person not found', async () => {
    mocks.personFindUnique.mockResolvedValue(null);
    const result = await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    expect(result).toBeNull();
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it('verifies ownership by including userId in findUnique where', async () => {
    await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    expect(mocks.personFindUnique).toHaveBeenCalledWith({
      where: { id: PERSON_ID, userId: USER_ID, deletedAt: null },
    });
  });

  it('only includes fields that are provided in updateData', async () => {
    await updatePerson(PERSON_ID, USER_ID, { name: 'NewName' });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data).toHaveProperty('name');
    expect(call.data).not.toHaveProperty('surname');
    expect(call.data).not.toHaveProperty('notes');
  });

  it('sanitizes name field', async () => {
    await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.name).toBe('Alice');
  });

  it('uses deleteMany+create for groupIds', async () => {
    await updatePerson(PERSON_ID, USER_ID, { groupIds: ['g1', 'g2'] });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.groups).toEqual({
      deleteMany: {},
      create: [{ groupId: 'g1' }, { groupId: 'g2' }],
    });
  });

  it('uses deleteMany+create for phoneNumbers', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      phoneNumbers: [{ type: 'mobile', number: '+1' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.phoneNumbers).toEqual({
      deleteMany: {},
      create: [{ type: 'mobile', number: '+1' }],
    });
  });

  it('uses deleteMany+create for emails', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      emails: [{ type: 'work', email: 'a@b.com' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.emails).toEqual({
      deleteMany: {},
      create: [{ type: 'work', email: 'a@b.com' }],
    });
  });

  it('uses deleteMany+create for importantDates', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      importantDates: [{ title: 'Birthday', date: '1990-03-14', reminderEnabled: false }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.importantDates.deleteMany).toEqual({});
    expect(call.data.importantDates.create).toHaveLength(1);
  });

  it('uses deleteMany+create for addresses with null coercion', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      addresses: [{ type: 'home' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.addresses.create[0]).toMatchObject({
      type: 'home',
      streetLine1: null,
      streetLine2: null,
    });
  });

  it('uses deleteMany+create for urls', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      urls: [{ type: 'website', url: 'https://example.com' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.urls).toEqual({
      deleteMany: {},
      create: [{ type: 'website', url: 'https://example.com' }],
    });
  });

  it('uses deleteMany+create for imHandles', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      imHandles: [{ protocol: 'telegram' as const, handle: '@alice' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.imHandles).toEqual({
      deleteMany: {},
      create: [{ protocol: 'telegram', handle: '@alice' }],
    });
  });

  it('uses deleteMany+create for locations', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      locations: [{ type: 'home' as const, latitude: 40, longitude: -74 }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.locations).toEqual({
      deleteMany: {},
      create: [{ type: 'home', latitude: 40, longitude: -74 }],
    });
  });

  it('uses deleteMany+create for customFields', async () => {
    await updatePerson(PERSON_ID, USER_ID, {
      customFields: [{ key: 'X-FOO', value: 'bar' }],
    });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.customFields).toEqual({
      deleteMany: {},
      create: [{ key: 'X-FOO', value: 'bar', type: null }],
    });
  });

  it('connects relationshipToUser when id provided', async () => {
    await updatePerson(PERSON_ID, USER_ID, { relationshipToUserId: 'rel-type-1' });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.relationshipToUser).toEqual({ connect: { id: 'rel-type-1' } });
  });

  it('disconnects relationshipToUser when null provided', async () => {
    await updatePerson(PERSON_ID, USER_ID, { relationshipToUserId: null });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.relationshipToUser).toEqual({ disconnect: true });
  });

  it('does not include relationshipToUser when not in data', async () => {
    await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data).not.toHaveProperty('relationshipToUser');
  });

  it('returns the updated person', async () => {
    const result = await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    expect(result).toEqual(updatedPerson);
  });

  it('schedules auto-update when cardDavSyncEnabled is not false', async () => {
    await updatePerson(PERSON_ID, USER_ID, { name: 'Alice' });
    await Promise.resolve();
    expect(mocks.autoUpdatePerson).toHaveBeenCalledWith(PERSON_ID);
  });

  it('does NOT schedule auto-update when cardDavSyncEnabled is false', async () => {
    await updatePerson(PERSON_ID, USER_ID, { cardDavSyncEnabled: false });
    await Promise.resolve();
    expect(mocks.autoUpdatePerson).not.toHaveBeenCalled();
  });

  it('does NOT schedule auto-update when stored cardDavSyncEnabled is false and input omits it', async () => {
    mocks.personFindUnique.mockResolvedValue(makeExistingPerson({ cardDavSyncEnabled: false }));
    await updatePerson(PERSON_ID, USER_ID, { name: 'Bob' });
    await Promise.resolve();
    expect(mocks.autoUpdatePerson).not.toHaveBeenCalled();
  });

  it('converts anniversary string to Date', async () => {
    await updatePerson(PERSON_ID, USER_ID, { anniversary: '2020-06-15' });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.anniversary).toBeInstanceOf(Date);
  });

  it('sets anniversary to null when null provided', async () => {
    await updatePerson(PERSON_ID, USER_ID, { anniversary: null });
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.data.anniversary).toBeNull();
  });
});

// ===========================================================================
// deletePerson
// ===========================================================================

describe('deletePerson', () => {
  beforeEach(() => {
    mocks.personFindUnique.mockResolvedValue(makeExistingPerson());
    mocks.personUpdate.mockResolvedValue({ id: PERSON_ID });
  });

  it('returns null when person not found', async () => {
    mocks.personFindUnique.mockResolvedValue(null);
    const result = await deletePerson(PERSON_ID, USER_ID);
    expect(result).toBeNull();
    expect(mocks.personUpdate).not.toHaveBeenCalled();
  });

  it('verifies ownership in findUnique', async () => {
    await deletePerson(PERSON_ID, USER_ID);
    expect(mocks.personFindUnique).toHaveBeenCalledWith({
      where: { id: PERSON_ID, userId: USER_ID, deletedAt: null },
    });
  });

  it('sets deletedAt on the person', async () => {
    await deletePerson(PERSON_ID, USER_ID);
    const call = mocks.personUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: PERSON_ID });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it('deletes CardDAV mapping before soft-deleting', async () => {
    await deletePerson(PERSON_ID, USER_ID);
    expect(mocks.cardDavMappingDeleteMany).toHaveBeenCalledWith({
      where: { personId: PERSON_ID },
    });
  });

  it('returns the person id on success', async () => {
    const result = await deletePerson(PERSON_ID, USER_ID);
    expect(result).toBe(PERSON_ID);
  });
});

// ===========================================================================
// restorePerson
// ===========================================================================

describe('restorePerson', () => {
  beforeEach(() => {
    mocks.withDeletedPersonFindUnique.mockResolvedValue({
      id: PERSON_ID,
      userId: USER_ID,
      deletedAt: new Date('2024-01-01'),
    });
    mocks.withDeletedPersonUpdate.mockResolvedValue({ id: PERSON_ID });
  });

  it('returns null when person not found', async () => {
    mocks.withDeletedPersonFindUnique.mockResolvedValue(null);
    const result = await restorePerson(PERSON_ID, USER_ID);
    expect(result).toBeNull();
    expect(mocks.withDeletedPersonUpdate).not.toHaveBeenCalled();
  });

  it('returns null when person is not soft-deleted', async () => {
    mocks.withDeletedPersonFindUnique.mockResolvedValue({
      id: PERSON_ID,
      userId: USER_ID,
      deletedAt: null,
    });
    const result = await restorePerson(PERSON_ID, USER_ID);
    expect(result).toBeNull();
    expect(mocks.withDeletedPersonUpdate).not.toHaveBeenCalled();
  });

  it('clears deletedAt on restore', async () => {
    await restorePerson(PERSON_ID, USER_ID);
    const call = mocks.withDeletedPersonUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: PERSON_ID });
    expect(call.data).toEqual({ deletedAt: null });
  });

  it('returns the person id on success', async () => {
    const result = await restorePerson(PERSON_ID, USER_ID);
    expect(result).toBe(PERSON_ID);
  });

  it('always calls disconnect on the raw client', async () => {
    await restorePerson(PERSON_ID, USER_ID);
    expect(mocks.withDeletedDisconnect).toHaveBeenCalled();
  });

  it('calls disconnect even if findUnique throws', async () => {
    mocks.withDeletedPersonFindUnique.mockRejectedValue(new Error('db error'));
    await expect(restorePerson(PERSON_ID, USER_ID)).rejects.toThrow('db error');
    expect(mocks.withDeletedDisconnect).toHaveBeenCalled();
  });
});

// ===========================================================================
// mergePeople
// ===========================================================================

describe('mergePeople', () => {
  function makePersonForMerge(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      userId: USER_ID,
      deletedAt: null,
      name: id === PERSON_ID ? 'Alice' : 'Alicia',
      surname: null,
      middleName: null,
      secondLastName: null,
      nickname: null,
      prefix: null,
      suffix: null,
      organization: null,
      jobTitle: null,
      gender: null,
      photo: null,
      notes: null,
      anniversary: null,
      lastContact: null,
      relationshipToUserId: null,
      cardDavMapping: null,
      groups: [] as Array<{ groupId: string; personId: string }>,
      relationshipsFrom: [] as Array<{ id: string; personId: string; relatedPersonId: string; deletedAt: null }>,
      relationshipsTo: [] as Array<{ id: string; personId: string; relatedPersonId: string; deletedAt: null }>,
      phoneNumbers: [] as Array<{ id: string; number: string; type: string }>,
      emails: [] as Array<{ id: string; email: string; type: string }>,
      addresses: [] as Array<{ id: string; type: string; streetLine1: string | null; streetLine2: string | null; locality: string | null; region: string | null; postalCode: string | null; country: string | null }>,
      urls: [] as Array<{ id: string; url: string; type: string }>,
      imHandles: [] as Array<{ id: string; protocol: string; handle: string }>,
      locations: [] as Array<{ id: string; latitude: number; longitude: number }>,
      customFields: [] as Array<{ id: string; key: string; value: string }>,
      importantDates: [] as Array<{ id: string; title: string; date: Date }>,
      ...overrides,
    };
  }

  beforeEach(() => {
    mocks.personFindUnique
      .mockResolvedValueOnce(makePersonForMerge(PERSON_ID))
      .mockResolvedValueOnce(makePersonForMerge(SOURCE_ID));

    // $transaction: execute callback with a tx client that has the same mocks
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mocks.mockTxClient);
      }
    );

    mocks.personUpdate.mockResolvedValue({ id: PERSON_ID });
    mocks.mockTxClient.person.update.mockResolvedValue({ id: PERSON_ID });
    mocks.mockTxClient.cardDavMapping.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.cardDavMapping.findUnique.mockResolvedValue(null);
    mocks.mockTxClient.personGroup.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personGroup.createMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.relationship.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personPhone.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personPhone.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personEmail.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personEmail.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personAddress.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personAddress.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personUrl.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personUrl.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personIM.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personIM.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personLocation.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personLocation.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personCustomField.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.personCustomField.deleteMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.importantDate.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.importantDate.deleteMany.mockResolvedValue({ count: 0 });
    // Default: target has no existing journal references → updateMany still
    // runs unconditionally, but deleteMany is skipped. Tests that exercise
    // the collision path override findMany per-test.
    mocks.mockTxClient.journalEntryPerson.findMany.mockResolvedValue([]);
    mocks.mockTxClient.journalEntryPerson.updateMany.mockResolvedValue({ count: 0 });
    mocks.mockTxClient.journalEntryPerson.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('returns null when target not found', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makePersonForMerge(SOURCE_ID));
    const result = await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns null when source not found', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(makePersonForMerge(PERSON_ID))
      .mockResolvedValueOnce(null);
    const result = await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(result).toBeNull();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('returns targetId on success', async () => {
    const result = await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(result).toBe(PERSON_ID);
  });

  it('runs operations inside a transaction', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it('soft-deletes the source person in the transaction', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    const calls = mocks.mockTxClient.person.update.mock.calls;
    const softDeleteCall = calls.find(
      (c: unknown[]) => {
        const arg = c[0] as { where: { id: string }; data: { deletedAt?: unknown } };
        return arg.where.id === SOURCE_ID && arg.data.deletedAt instanceof Date;
      }
    );
    expect(softDeleteCall).toBeDefined();
  });

  it('deletes source CardDAV mapping in transaction', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(mocks.mockTxClient.cardDavMapping.deleteMany).toHaveBeenCalledWith({
      where: { personId: SOURCE_ID },
    });
  });

  it('deletes source group memberships in transaction', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(mocks.mockTxClient.personGroup.deleteMany).toHaveBeenCalledWith({
      where: { personId: SOURCE_ID },
    });
  });

  it('applies scalar overrides to target', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID, { name: 'Alice Override', surname: 'Smith' });
    const call = mocks.mockTxClient.person.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === PERSON_ID
    );
    if (!call) throw new Error('Expected update call for target person');
    const data = (call[0] as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('Alice Override');
    expect(data.surname).toBe('Smith');
  });

  it('auto-transfers scalar fields that are empty on target', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(makePersonForMerge(PERSON_ID, { name: 'Alice', surname: null }))
      .mockResolvedValueOnce(makePersonForMerge(SOURCE_ID, { name: 'Alicia', surname: 'Smith' }));

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    const call = mocks.mockTxClient.person.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { where: { id: string } }).where.id === PERSON_ID
    );
    if (!call) throw new Error('Expected update call for target person');
    const data = (call[0] as { data: Record<string, unknown> }).data;
    expect(data.surname).toBe('Smith');
  });

  it('transfers non-duplicate phone numbers to target', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(
        makePersonForMerge(PERSON_ID, {
          phoneNumbers: [{ id: 'ph1', number: '+1111', type: 'mobile' }],
        })
      )
      .mockResolvedValueOnce(
        makePersonForMerge(SOURCE_ID, {
          phoneNumbers: [
            { id: 'ph2', number: '+2222', type: 'work' },   // new
            { id: 'ph3', number: '+1111', type: 'mobile' },  // duplicate
          ],
        })
      );

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.personPhone.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ph2'] } },
      data: { personId: PERSON_ID },
    });
    expect(mocks.mockTxClient.personPhone.deleteMany).toHaveBeenCalledWith({
      where: { personId: SOURCE_ID },
    });
  });

  it('transfers new group memberships to target', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(
        makePersonForMerge(PERSON_ID, {
          groups: [{ groupId: 'g1', personId: PERSON_ID }],
        })
      )
      .mockResolvedValueOnce(
        makePersonForMerge(SOURCE_ID, {
          groups: [
            { groupId: 'g1', personId: SOURCE_ID },
            { groupId: 'g2', personId: SOURCE_ID },
          ],
        })
      );

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.personGroup.createMany).toHaveBeenCalledWith({
      data: [{ personId: PERSON_ID, groupId: 'g2' }],
    });
  });

  it('re-parents relationships from source to target (skipping self-refs)', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(
        makePersonForMerge(PERSON_ID, {
          relationshipsFrom: [],
        })
      )
      .mockResolvedValueOnce(
        makePersonForMerge(SOURCE_ID, {
          relationshipsFrom: [
            { id: 'rel-1', personId: SOURCE_ID, relatedPersonId: 'person-3', deletedAt: null },
            { id: 'rel-self', personId: SOURCE_ID, relatedPersonId: PERSON_ID, deletedAt: null },
          ],
        })
      );

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.relationship.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rel-1'] } },
      data: { personId: PERSON_ID },
    });
  });

  it('soft-deletes self-referential (leftover) relationships', async () => {
    mocks.personFindUnique
      .mockReset()
      .mockResolvedValueOnce(makePersonForMerge(PERSON_ID))
      .mockResolvedValueOnce(
        makePersonForMerge(SOURCE_ID, {
          relationshipsFrom: [
            { id: 'rel-self', personId: SOURCE_ID, relatedPersonId: PERSON_ID, deletedAt: null },
          ],
        })
      );

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.relationship.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['rel-self'] } },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    );
  });

  it('does not call personGroup.createMany when no new groups', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);
    expect(mocks.mockTxClient.personGroup.createMany).not.toHaveBeenCalled();
  });

  it('re-parents source journal entry references to target', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.journalEntryPerson.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.mockTxClient.journalEntryPerson.updateMany).toHaveBeenCalledWith({
      where: { personId: SOURCE_ID },
      data: { personId: PERSON_ID },
    });
  });

  it('removes source journal references that would collide with target', async () => {
    mocks.mockTxClient.journalEntryPerson.findMany.mockResolvedValueOnce([
      { journalEntryId: 'je-1' },
      { journalEntryId: 'je-2' },
    ]);

    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.journalEntryPerson.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.mockTxClient.journalEntryPerson.deleteMany).toHaveBeenCalledWith({
      where: {
        personId: SOURCE_ID,
        journalEntryId: { in: ['je-1', 'je-2'] },
      },
    });
    expect(mocks.mockTxClient.journalEntryPerson.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.mockTxClient.journalEntryPerson.updateMany).toHaveBeenCalledWith({
      where: { personId: SOURCE_ID },
      data: { personId: PERSON_ID },
    });

    // Order matters: the bare updateMany would throw P2002 on the
    // (journalEntryId, personId) unique constraint if it ran before delete.
    const deleteOrder = mocks.mockTxClient.journalEntryPerson.deleteMany.mock.invocationCallOrder[0];
    const updateOrder = mocks.mockTxClient.journalEntryPerson.updateMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(updateOrder);
  });

  it('does not delete journal references when target has none', async () => {
    await mergePeople(PERSON_ID, SOURCE_ID, USER_ID);

    expect(mocks.mockTxClient.journalEntryPerson.deleteMany).not.toHaveBeenCalled();
  });
});
