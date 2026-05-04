import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExternalServiceError } from '@/lib/errors';

// Module-level mock of tsdav so createCardDavClient returns predictable behavior.
const updateVCardMock = vi.fn();
const createVCardMock = vi.fn();
const deleteVCardMock = vi.fn();
const createDAVClientMock = vi.fn(async () => ({
  updateVCard: updateVCardMock,
  createVCard: createVCardMock,
  deleteVCard: deleteVCardMock,
  fetchAddressBooks: vi.fn(async () => []),
  fetchVCards: vi.fn(async () => []),
}));

vi.mock('tsdav', () => ({
  createDAVClient: () => createDAVClientMock(),
}));

vi.mock('@/lib/carddav/encryption', () => ({
  decryptPassword: (p: string) => p,
}));

import { createCardDavClient } from '@/lib/carddav/client';
import type { CardDavConnection } from '@prisma/client';

const connection = {
  id: 'conn-1',
  userId: 'user-1',
  serverUrl: 'https://carddav.example.com',
  username: 'u@example.com',
  password: 'pw',
} as unknown as CardDavConnection;

beforeEach(() => {
  updateVCardMock.mockReset();
  createVCardMock.mockReset();
  deleteVCardMock.mockReset();
});

describe('CardDavClient error handling', () => {
  it('throws ExternalServiceError with status, body, endpoint on 400 from updateVCard', async () => {
    updateVCardMock.mockResolvedValueOnce(
      new Response('<?xml version="1.0"?><error>PHOTO too large</error>', {
        status: 400,
        statusText: 'Bad Request',
      })
    );

    const client = await createCardDavClient(connection);
    await expect(
      client.updateVCard(
        { url: '/contacts/abc.vcf', etag: '"xyz"', data: '' },
        'BEGIN:VCARD\r\nEND:VCARD'
      )
    ).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof ExternalServiceError)) return false;
      return (
        err.service === 'carddav' &&
        err.method === 'PUT' &&
        err.status === 400 &&
        err.statusCode === 400 &&
        err.body?.includes('PHOTO too large') === true &&
        err.endpoint === 'https://carddav.example.com/contacts/abc.vcf'
      );
    });
  });

  it('throws ExternalServiceError on 400 from createVCard with method POST', async () => {
    createVCardMock.mockResolvedValueOnce(
      new Response('bad', { status: 400, statusText: 'Bad Request' })
    );
    const client = await createCardDavClient(connection);
    await expect(
      client.createVCard(
        { url: 'https://carddav.example.com/addressbook/', raw: { url: 'https://carddav.example.com/addressbook/' } as unknown as import('tsdav').DAVAddressBook },
        'BEGIN:VCARD\r\nEND:VCARD',
        'new.vcf'
      )
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('throws ExternalServiceError on 400 from deleteVCard', async () => {
    deleteVCardMock.mockResolvedValueOnce(
      new Response('nope', { status: 400, statusText: 'Bad Request' })
    );
    const client = await createCardDavClient(connection);
    await expect(
      client.deleteVCard({ url: '/contacts/x.vcf', etag: '"x"', data: '' })
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
