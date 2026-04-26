import { describe, it, expect, vi } from 'vitest';
import { classifyUpdateFailure } from '@/lib/carddav/update-recovery';
import type { AddressBook, CardDavClientInterface } from '@/lib/carddav/client';

function makeClient(fetchVCardImpl: CardDavClientInterface['fetchVCard']): CardDavClientInterface {
  return {
    fetchAddressBooks: vi.fn(),
    fetchVCards: vi.fn(),
    fetchVCard: fetchVCardImpl,
    createVCard: vi.fn(),
    updateVCard: vi.fn(),
    deleteVCard: vi.fn(),
  };
}

const ADDRESS_BOOK: AddressBook = {
  url: 'https://carddav.example.com/addressbooks/default/',
  displayName: 'Contacts',
  raw: {},
} as AddressBook;

describe('classifyUpdateFailure', () => {
  it("returns 'gone' when the resource fetch returns null (404 server-side)", async () => {
    const client = makeClient(vi.fn().mockResolvedValue(null));

    const result = await classifyUpdateFailure(
      client,
      ADDRESS_BOOK,
      'https://carddav.example.com/contacts/dead.vcf',
      'stale-etag',
    );

    expect(result).toEqual({ kind: 'gone' });
  });

  it("returns 'stale-etag' with the fresh etag when the resource exists but etag differs", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        url: 'https://carddav.example.com/contacts/alive.vcf',
        etag: 'fresh-etag',
        data: 'irrelevant',
      }),
    );

    const result = await classifyUpdateFailure(
      client,
      ADDRESS_BOOK,
      'https://carddav.example.com/contacts/alive.vcf',
      'stale-etag',
    );

    expect(result).toEqual({ kind: 'stale-etag', freshEtag: 'fresh-etag' });
  });

  it("returns 'unrecoverable' when the resource exists with the same etag (genuine body issue)", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        url: 'https://carddav.example.com/contacts/alive.vcf',
        etag: 'same-etag',
        data: 'irrelevant',
      }),
    );

    const result = await classifyUpdateFailure(
      client,
      ADDRESS_BOOK,
      'https://carddav.example.com/contacts/alive.vcf',
      'same-etag',
    );

    expect(result).toEqual({ kind: 'unrecoverable' });
  });

  it("returns 'unrecoverable' when fetchVCard itself throws (network or auth failure during recovery)", async () => {
    const client = makeClient(vi.fn().mockRejectedValue(new Error('network down')));

    const result = await classifyUpdateFailure(
      client,
      ADDRESS_BOOK,
      'https://carddav.example.com/contacts/x.vcf',
      'any-etag',
    );

    expect(result).toEqual({ kind: 'unrecoverable' });
  });
});
