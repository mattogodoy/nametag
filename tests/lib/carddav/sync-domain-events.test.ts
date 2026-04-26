import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared capture store — hoisted so the mock factory can reference it.
const lines = vi.hoisted<Record<string, unknown>[]>(() => []);

// Hoisted prisma mock fns
const mocks = vi.hoisted(() => ({
  findManyMapping: vi.fn(),
  findFirstMapping: vi.fn(),
  updateMapping: vi.fn(async () => ({})),
  createConflict: vi.fn(async () => ({})),
  findConnection: vi.fn(async () => ({
    id: 'conn-1', userId: 'u-1', serverUrl: 'https://carddav.example', username: 'u', password: 'p',
    syncEnabled: true, autoExportNew: false,
  })),
  findManyPerson: vi.fn(async () => []),
  updateConnection: vi.fn(async () => ({})),
  findManyPending: vi.fn(async () => []),
  countPending: vi.fn(async () => 0),
  updateManyConnection: vi.fn(async () => ({ count: 1 })),
  // CardDAV client
  fetchAddressBooks: vi.fn(),
  fetchVCards: vi.fn(),
  updateVCard: vi.fn(),
  createVCard: vi.fn(),
  fetchVCard: vi.fn(),
}));

vi.mock('@/lib/logger', async () => {
  const { Writable } = await import('node:stream');
  const { default: pino } = await import('pino');

  const actual = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

  const stream = new Writable({
    write(c: Buffer, _e: BufferEncoding, cb: () => void) {
      lines.push(JSON.parse(c.toString()) as Record<string, unknown>);
      cb();
    },
  });

  const log = pino({ ...actual.pinoOptions, transport: undefined }, stream);

  return {
    ...actual,
    logger: log,
    createModuleLogger: (m: string) => log.child({ module: m }),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findUnique: mocks.findConnection,
      update: mocks.updateConnection,
      updateMany: mocks.updateManyConnection,
    },
    cardDavMapping: {
      findMany: mocks.findManyMapping,
      findFirst: mocks.findFirstMapping,
      update: mocks.updateMapping,
      create: vi.fn(async () => ({})),
    },
    cardDavConflict: { create: mocks.createConflict },
    cardDavPendingImport: {
      findMany: mocks.findManyPending,
      count: mocks.countPending,
      deleteMany: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({})),
    },
    person: {
      findUnique: vi.fn(async () => null),
      findMany: mocks.findManyPerson,
      update: vi.fn(async () => ({})),
    },
  },
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: vi.fn(async () => ({
    fetchAddressBooks: mocks.fetchAddressBooks,
    fetchVCards: mocks.fetchVCards,
    updateVCard: mocks.updateVCard,
    createVCard: mocks.createVCard,
    fetchVCard: mocks.fetchVCard,
    deleteVCard: vi.fn(),
  })),
}));
vi.mock('@/lib/carddav/address-book', () => ({
  getAddressBook: vi.fn(async () => ({ url: 'https://carddav.example/ab/', raw: {} })),
}));
vi.mock('@/lib/carddav/mapped-uids', () => ({
  getAlreadyMappedPersonUids: vi.fn(async () => new Set<string>()),
}));
vi.mock('@/lib/carddav/hash', () => ({ buildLocalHash: vi.fn(() => 'hash') }));
vi.mock('@/lib/carddav/vcard-import', () => ({
  vCardToPerson: vi.fn(() => ({ uid: 'remote-uid', name: 'Remote' })),
  updatePersonFromVCard: vi.fn(async () => {}),
}));
vi.mock('@/lib/carddav/vcard-export', () => ({ personToVCard: vi.fn(() => 'BEGIN:VCARD\r\nEND:VCARD') }));
vi.mock('@/lib/carddav/vcard-parser', () => ({ parseVCard: vi.fn(() => ({ unknownProperties: [] })) }));
vi.mock('@/lib/photo-storage', () => ({
  readPhotoForExport: vi.fn(async () => null),
  isPhotoFilename: vi.fn(() => false),
}));

import { bidirectionalSync, syncFromServer, syncToServer } from '@/lib/carddav/sync';
import { ExternalServiceError } from '@/lib/errors';

beforeEach(() => { lines.length = 0; });

describe('CardDAV sync domain events', () => {
  it('emits carddav.sync.finished after bidirectionalSync completes', async () => {
    mocks.findManyMapping.mockResolvedValue([]);
    mocks.fetchAddressBooks.mockResolvedValue([{ url: 'https://carddav.example/ab/', raw: {} }]);
    mocks.fetchVCards.mockResolvedValue([]);
    mocks.findManyPerson.mockResolvedValue([]);

    await bidirectionalSync('u-1');

    const finished = lines.find((l) => l.event === 'carddav.sync.finished');
    expect(finished).toBeDefined();
    expect(finished).toMatchObject({
      imported: expect.any(Number),
      exported: expect.any(Number),
      errors: expect.any(Number),
      durationMs: expect.any(Number),
    });
  });

  it('emits carddav.conflict.created when both local and remote changed', async () => {
    mocks.fetchAddressBooks.mockResolvedValue([{ url: 'https://carddav.example/ab/', raw: {} }]);
    mocks.fetchVCards.mockResolvedValue([
      { url: 'https://carddav.example/ab/x.vcf', etag: '"new"', data: 'BEGIN:VCARD\r\nUID:remote-uid\r\nFN:Remote\r\nEND:VCARD' },
    ]);
    const mapping = {
      id: 'map-1', personId: 'p-1', connectionId: 'conn-1', uid: 'remote-uid',
      href: 'https://carddav.example/ab/x.vcf', etag: '"old"',
      lastLocalChange: new Date(Date.now()),
      lastSyncedAt: new Date(Date.now() - 1_000_000),
      preservedProperties: null,
    };
    mocks.findManyMapping.mockResolvedValue([mapping]);
    mocks.findFirstMapping.mockResolvedValue({
      ...mapping,
      person: {
        id: 'p-1', phoneNumbers: [], emails: [], addresses: [], urls: [],
        imHandles: [], locations: [], customFields: [],
      },
    });

    await syncFromServer('u-1');

    const conflict = lines.find((l) => l.event === 'carddav.conflict.created');
    expect(conflict).toBeDefined();
    expect(conflict).toMatchObject({ personId: 'p-1', mappingId: 'map-1', level: 'warn' });
  });

  it('emits carddav.push.failed when a per-vCard update throws', async () => {
    mocks.findManyMapping.mockResolvedValue([{
      id: 'map-1', personId: 'p-1', connectionId: 'conn-1',
      href: 'https://carddav.example/ab/x.vcf', etag: '"e"',
      syncStatus: 'pending', preservedProperties: null,
      person: {
        id: 'p-1', notes: null,
        phoneNumbers: [], emails: [], addresses: [], urls: [], imHandles: [],
        locations: [], customFields: [], importantDates: [], groups: [], relationshipsFrom: [],
      },
    }]);
    mocks.fetchAddressBooks.mockResolvedValue([{ url: 'https://carddav.example/ab/', raw: {} }]);
    mocks.updateVCard.mockRejectedValue(new ExternalServiceError({
      message: 'CardDAV UPDATE failed: 400 Bad Request',
      service: 'carddav', status: 400, body: '<error>bad</error>',
    }));
    // Recovery path: GET returns the same etag we sent, so the failure is
    // genuine (body issue) rather than a stale-etag/resource-gone case.
    // This keeps the original test intent: a real failure should emit
    // carddav.push.failed.
    mocks.fetchVCard.mockResolvedValue({
      url: 'https://carddav.example/ab/x.vcf', etag: '"e"', data: '',
    });
    mocks.findManyPerson.mockResolvedValue([]);

    await syncToServer('u-1');

    const failed = lines.find((l) => l.event === 'carddav.push.failed');
    expect(failed).toBeDefined();
    expect(failed).toMatchObject({ personId: 'p-1', level: 'warn' });
    expect((failed!.err as Record<string, unknown>).status).toBe(400);
  });
});
