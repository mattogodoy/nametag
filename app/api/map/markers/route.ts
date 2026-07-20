import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { formatCanonicalName, type NameDisplayFormat } from '@/lib/nameUtils';
import type { MapGroup, MapMarker } from '@/lib/map/types';

export const GET = withAuth(async (request, session) => {
  try {
    const [user, people, pendingCount, failedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { nameOrder: true, nameDisplayFormat: true, geocodingEnabled: true },
      }),
      prisma.person.findMany({
        where: { userId: session.user.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          surname: true,
          middleName: true,
          secondLastName: true,
          nickname: true,
          displayNameOverride: true,
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
          groups: {
            where: { group: { deletedAt: null } },
            select: { group: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.personAddress.count({
        where: {
          person: { userId: session.user.id, deletedAt: null },
          OR: [{ geocodeStatus: null }, { geocodeStatus: 'pending' }],
        },
      }),
      prisma.personAddress.count({
        where: {
          person: { userId: session.user.id, deletedAt: null },
          geocodeStatus: 'failed',
        },
      }),
    ]);

    const groupsById = new Map<string, MapGroup>();
    const markers: MapMarker[] = [];

    for (const person of people) {
      const personName =
        person.displayNameOverride ??
        formatCanonicalName(
          person,
          user?.nameOrder ?? undefined,
          (user?.nameDisplayFormat as NameDisplayFormat | undefined) ?? undefined,
        );
      const groupIds = person.groups.map((pg) => pg.group.id);
      for (const pg of person.groups) {
        groupsById.set(pg.group.id, pg.group);
      }

      for (const address of person.addresses) {
        if (address.geocodeStatus !== 'success' || address.latitude === null || address.longitude === null) {
          continue;
        }
        markers.push({
          id: `addr_${address.id}`,
          source: 'address',
          personId: person.id,
          personName,
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
          label: address.type,
          city: address.locality,
          region: address.region,
          country: address.country,
          groupIds,
        });
      }

      for (const location of person.locations) {
        markers.push({
          id: `loc_${location.id}`,
          source: 'location',
          personId: person.id,
          personName,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          label: location.label ?? location.type,
          city: null,
          region: null,
          country: null,
          groupIds,
        });
      }
    }

    const groups = [...groupsById.values()].sort((a, b) => a.name.localeCompare(b.name));

    return apiResponse.ok({
      markers,
      groups,
      pendingCount,
      failedCount,
      geocodingEnabled: user?.geocodingEnabled ?? true,
    });
  } catch (error) {
    return handleApiError(error, 'map-markers');
  }
});
