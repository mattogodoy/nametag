import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DAVAddressBook, DAVVCard } from 'tsdav';

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { fetchAllVCards } from '@/lib/carddav/fetch-vcards';

const fetchVCardsMock = vi.fn();
const propfindMock = vi.fn();
const client = {
  fetchVCards: fetchVCardsMock,
  propfind: propfindMock,
} as unknown as Parameters<typeof fetchAllVCards>[0];

const addressBook = { url: 'https://dav.example.com/carddav/32/' } as DAVAddressBook;

const card = (name: string): DAVVCard => ({
  url: `https://dav.example.com/carddav/32/${name}.vcf`,
  etag: '"1"',
  data: `BEGIN:VCARD\r\nFN:${name}\r\nEND:VCARD`,
});

beforeEach(() => {
  fetchVCardsMock.mockReset();
  propfindMock.mockReset();
});

describe('fetchAllVCards', () => {
  it('returns the default query result without a PROPFIND when it finds contacts', async () => {
    fetchVCardsMock.mockResolvedValueOnce([card('a'), card('b')]);

    const result = await fetchAllVCards(client, addressBook);

    expect(result).toHaveLength(2);
    expect(propfindMock).not.toHaveBeenCalled();
    expect(fetchVCardsMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a PROPFIND listing when the default query returns nothing', async () => {
    fetchVCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card('a'), card('b')]);
    propfindMock.mockResolvedValueOnce([
      { href: '/carddav/32/', ok: true },
      { href: '/carddav/32/a.vcf', ok: true },
      { href: 'https://dav.example.com/carddav/32/b.vcf', ok: true },
    ]);

    const result = await fetchAllVCards(client, addressBook);

    expect(result).toHaveLength(2);
    expect(fetchVCardsMock).toHaveBeenLastCalledWith({
      addressBook,
      objectUrls: ['/carddav/32/a.vcf', '/carddav/32/b.vcf'],
    });
  });

  it('skips the collection itself, sub-collections and failed entries', async () => {
    fetchVCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card('a')]);
    propfindMock.mockResolvedValueOnce([
      { href: '/carddav/32', ok: true },
      { href: '/carddav/32/sub/', ok: true },
      { href: '/carddav/32/broken.vcf', ok: false },
      { href: '', ok: true },
      { href: '/carddav/32/a.vcf', ok: true },
    ]);

    await fetchAllVCards(client, addressBook);

    expect(fetchVCardsMock).toHaveBeenLastCalledWith({
      addressBook,
      objectUrls: ['/carddav/32/a.vcf'],
    });
  });

  it('keeps hrefs that do not end in .vcf', async () => {
    fetchVCardsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card('a')]);
    propfindMock.mockResolvedValueOnce([
      { href: '/carddav/32/', ok: true },
      { href: '/carddav/32/contact-1', ok: true },
    ]);

    await fetchAllVCards(client, addressBook);

    expect(fetchVCardsMock).toHaveBeenLastCalledWith({
      addressBook,
      objectUrls: ['/carddav/32/contact-1'],
    });
  });

  it('returns an empty list for a genuinely empty address book without a second fetch', async () => {
    fetchVCardsMock.mockResolvedValueOnce([]);
    propfindMock.mockResolvedValueOnce([{ href: '/carddav/32/', ok: true }]);

    const result = await fetchAllVCards(client, addressBook);

    expect(result).toEqual([]);
    expect(fetchVCardsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the old empty result when the fallback listing fails', async () => {
    fetchVCardsMock.mockResolvedValueOnce([]);
    propfindMock.mockRejectedValueOnce(new Error('PROPFIND not allowed'));

    const result = await fetchAllVCards(client, addressBook);

    expect(result).toEqual([]);
  });
});
