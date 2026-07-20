import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  addressCount: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany },
    user: { findUnique: mocks.userFindUnique },
    personAddress: { count: mocks.addressCount },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { GET } from '../../app/api/map/markers/route';

describe('GET /api/map/markers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({ nameOrder: 'WESTERN', nameDisplayFormat: 'FULL', geocodingEnabled: true });
    mocks.addressCount.mockResolvedValue(0);
  });

  it('returns markers for geocoded addresses and GEO locations', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
        addresses: [
          {
            id: 'addr-1',
            type: 'home',
            locality: 'London',
            region: 'Greater London',
            country: 'GB',
            latitude: '51.5',
            longitude: '-0.12',
            geocodeStatus: 'success',
          },
          {
            id: 'addr-2',
            type: 'work',
            locality: 'Paris',
            country: 'FR',
            latitude: null,
            longitude: null,
            geocodeStatus: 'pending',
          },
        ],
        locations: [
          { id: 'loc-1', type: 'other', label: 'Cabin', latitude: '60.1', longitude: '10.2' },
        ],
        groups: [{ group: { id: 'group-1', name: 'Friends' } }],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.markers).toHaveLength(2); // pending address excluded
    expect(body.markers[0]).toMatchObject({
      id: 'addr_addr-1',
      source: 'address',
      personId: 'person-1',
      personName: 'Alice Smith',
      latitude: 51.5,
      longitude: -0.12,
      city: 'London',
      region: 'Greater London',
      country: 'GB',
      groupIds: ['group-1'],
    });
    expect(body.markers[1]).toMatchObject({
      id: 'loc_loc-1',
      source: 'location',
      label: 'Cabin',
      city: null,
      region: null,
      country: null,
    });
    expect(body.groups).toEqual([{ id: 'group-1', name: 'Friends' }]);
    expect(body.geocodingEnabled).toBe(true);
  });

  it('scopes the query to the session user and excludes soft-deleted people', async () => {
    mocks.personFindMany.mockResolvedValue([]);

    await GET(new Request('http://localhost/api/map/markers'));

    expect(mocks.personFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', deletedAt: null },
        select: expect.objectContaining({
          addresses: {
            select: {
              id: true,
              type: true,
              locality: true,
              region: true,
              country: true,
              latitude: true,
              longitude: true,
              geocodeStatus: true,
            },
          },
          locations: {
            select: {
              id: true,
              type: true,
              label: true,
              latitude: true,
              longitude: true,
            },
          },
          groups: expect.objectContaining({
            where: { group: { deletedAt: null } },
          }),
        }),
      })
    );
  });

  it('returns pending and failed counts', async () => {
    mocks.personFindMany.mockResolvedValue([]);
    mocks.addressCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2);

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(body.pendingCount).toBe(4);
    expect(body.failedCount).toBe(2);
  });

  it('scopes the pending and failed address count queries to the session user, excluding soft-deleted people', async () => {
    mocks.personFindMany.mockResolvedValue([]);

    await GET(new Request('http://localhost/api/map/markers'));

    expect(mocks.addressCount).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          person: { userId: 'user-123', deletedAt: null },
        }),
      })
    );
    expect(mocks.addressCount).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          person: { userId: 'user-123', deletedAt: null },
        }),
      })
    );
  });

  it('reports geocodingEnabled as false when the user has disabled geocoding', async () => {
    mocks.personFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({
      nameOrder: 'WESTERN',
      nameDisplayFormat: 'FULL',
      geocodingEnabled: false,
    });

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(body.geocodingEnabled).toBe(false);
  });

  it('dedupes and sorts groups by name across people', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
        addresses: [],
        locations: [],
        groups: [
          { group: { id: 'group-friends', name: 'Friends' } },
          { group: { id: 'group-colleagues', name: 'Colleagues' } },
        ],
      },
      {
        id: 'person-2',
        name: 'Bob',
        surname: 'Jones',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
        addresses: [],
        locations: [],
        groups: [{ group: { id: 'group-friends', name: 'Friends' } }],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(body.groups).toEqual([
      { id: 'group-colleagues', name: 'Colleagues' },
      { id: 'group-friends', name: 'Friends' },
    ]);
  });

  it('uses displayNameOverride for personName when present', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: 'Ace',
        addresses: [
          {
            id: 'addr-1',
            type: 'home',
            locality: 'London',
            region: 'Greater London',
            country: 'GB',
            latitude: '51.5',
            longitude: '-0.12',
            geocodeStatus: 'success',
          },
        ],
        locations: [],
        groups: [],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(body.markers[0].personName).toBe('Ace');
  });

  it('falls back to the formatted canonical name for personName when there is no override', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
        addresses: [
          {
            id: 'addr-1',
            type: 'home',
            locality: 'London',
            region: 'Greater London',
            country: 'GB',
            latitude: '51.5',
            longitude: '-0.12',
            geocodeStatus: 'success',
          },
        ],
        locations: [],
        groups: [],
      },
    ]);

    const response = await GET(new Request('http://localhost/api/map/markers'));
    const body = await response.json();

    expect(body.markers[0].personName).toBe('Alice Smith');
  });
});
