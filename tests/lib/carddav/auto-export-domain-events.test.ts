import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared capture store — hoisted so the mock factory can reference it.
const lines = vi.hoisted<Record<string, unknown>[]>(() => []);

// Hoisted mock fns
const mocks = vi.hoisted(() => ({
  findUniquePerson: vi.fn(),
  findUniqueConnection: vi.fn(async () => ({
    id: 'conn-1', userId: 'u-1', syncEnabled: true, autoExportNew: true,
    serverUrl: 'https://carddav.example', username: 'u', password: 'p',
  })),
  findUniqueMapping: vi.fn(),
  updateMapping: vi.fn(async () => ({})),
  updateConnection: vi.fn(async () => ({})),
  createVCardMock: vi.fn(),
  updateVCardMock: vi.fn(),
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
    person: { findUnique: mocks.findUniquePerson, update: vi.fn(async () => ({})) },
    cardDavConnection: { findUnique: mocks.findUniqueConnection, update: mocks.updateConnection },
    cardDavMapping: {
      findUnique: mocks.findUniqueMapping,
      update: mocks.updateMapping,
      create: vi.fn(async () => ({})),
    },
  },
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: vi.fn(async () => ({
    createVCard: mocks.createVCardMock,
    updateVCard: mocks.updateVCardMock,
    fetchVCards: vi.fn(async () => []),
    deleteVCard: vi.fn(),
  })),
}));
vi.mock('@/lib/carddav/address-book', () => ({
  getAddressBook: vi.fn(async () => ({ url: 'https://carddav.example/ab/', raw: {} })),
}));
vi.mock('@/lib/carddav/hash', () => ({ buildLocalHash: vi.fn(() => 'hash') }));
vi.mock('@/lib/carddav/vcard-export', () => ({ personToVCard: vi.fn(() => 'BEGIN:VCARD\r\nEND:VCARD') }));
vi.mock('@/lib/photo-storage', () => ({
  readPhotoForExport: vi.fn(async () => null),
  isPhotoFilename: vi.fn(() => false),
}));

import { autoExportPerson, autoUpdatePerson } from '@/lib/carddav/auto-export';
import { ExternalServiceError } from '@/lib/errors';

const basePerson = {
  id: 'p-1', userId: 'u-1', uid: 'uid-1', name: 'Alice', surname: 'Smith',
  cardDavSyncEnabled: true, deletedAt: null, photo: null,
  phoneNumbers: [], emails: [], addresses: [], urls: [], imHandles: [],
  locations: [], customFields: [], importantDates: [],
  relationshipsFrom: [], groups: [],
};

beforeEach(() => { lines.length = 0; vi.clearAllMocks(); });

describe('auto-export domain events', () => {
  it('emits carddav.autoExport.failed with personId on error', async () => {
    mocks.findUniquePerson.mockResolvedValue(basePerson);
    mocks.findUniqueMapping.mockResolvedValue(null);
    mocks.findUniqueConnection.mockResolvedValue({
      id: 'conn-1', userId: 'u-1', syncEnabled: true, autoExportNew: true,
      serverUrl: 'https://carddav.example', username: 'u', password: 'p',
    });
    mocks.createVCardMock.mockRejectedValue(new ExternalServiceError({
      message: 'CardDAV CREATE failed: 400 Bad Request',
      service: 'carddav', status: 400, body: 'bad',
    }));
    mocks.updateConnection.mockResolvedValue({});

    await expect(autoExportPerson('p-1')).rejects.toBeInstanceOf(ExternalServiceError);

    const failed = lines.find((l) => l.event === 'carddav.autoExport.failed');
    expect(failed).toBeDefined();
    expect(failed).toMatchObject({ personId: 'p-1', level: 'error' });
    expect((failed!.err as Record<string, unknown>).status).toBe(400);
  });

  it('emits carddav.autoUpdate.failed with personId on error', async () => {
    mocks.findUniquePerson.mockResolvedValue(basePerson);
    mocks.findUniqueMapping.mockResolvedValue({
      id: 'map-1', personId: 'p-1', href: 'https://carddav.example/ab/x.vcf', etag: '"e"',
    });
    mocks.findUniqueConnection.mockResolvedValue({
      id: 'conn-1', userId: 'u-1', syncEnabled: true, autoExportNew: true,
      serverUrl: 'https://carddav.example', username: 'u', password: 'p',
    });
    mocks.updateVCardMock.mockRejectedValue(new ExternalServiceError({
      message: 'CardDAV UPDATE failed: 400 Bad Request',
      service: 'carddav', status: 400, body: 'bad',
    }));
    mocks.updateMapping.mockResolvedValue({});
    mocks.updateConnection.mockResolvedValue({});

    await expect(autoUpdatePerson('p-1')).rejects.toBeInstanceOf(ExternalServiceError);

    const failed = lines.find((l) => l.event === 'carddav.autoUpdate.failed');
    expect(failed).toBeDefined();
    expect(failed).toMatchObject({ personId: 'p-1', level: 'error' });
  });
});
