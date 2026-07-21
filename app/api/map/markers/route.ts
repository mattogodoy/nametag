import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { getCountryName } from '@/lib/countries';
import type { MapGroup, MapMarker, UnlocatedPerson } from '@/lib/map/types';

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
          nickname: true,
          displayNameOverride: true,
          addresses: {
            select: {
              id: true,
              type: true,
              streetLine1: true,
              streetLine2: true,
              locality: true,
              region: true,
              postalCode: true,
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
    const unlocatedPeople: UnlocatedPerson[] = [];

    for (const person of people) {
      // formatGraphName honors the user's name display settings (FULL,
      // NICKNAME_PREFERRED, SHORT) and the per-person override, matching how
      // names render in the network graph and page titles.
      const personName = formatGraphName(
        person,
        user?.nameOrder ?? undefined,
        (user?.nameDisplayFormat as NameDisplayFormat | undefined) ?? undefined,
      );
      const groupIds = person.groups.map((pg) => pg.group.id);
      for (const pg of person.groups) {
        groupsById.set(pg.group.id, pg.group);
      }

      const personFailedCount = person.addresses.filter(
        (address) => address.geocodeStatus === 'failed'
      ).length;
      if (personFailedCount > 0) {
        unlocatedPeople.push({ personId: person.id, personName, failedCount: personFailedCount });
      }

      for (const address of person.addresses) {
        if (address.geocodeStatus !== 'success' || address.latitude === null || address.longitude === null) {
          continue;
        }
        const addressText = [
          address.streetLine1,
          address.streetLine2,
          address.locality,
          address.region,
          address.postalCode,
          address.country ? getCountryName(address.country) || address.country : null,
        ]
          .filter((part) => part && part.trim().length > 0)
          .join(', ');

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
          addressText: addressText || null,
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
          addressText: null,
          groupIds,
        });
      }
    }

    const groups = [...groupsById.values()].sort((a, b) => a.name.localeCompare(b.name));
    unlocatedPeople.sort((a, b) => a.personName.localeCompare(b.personName));

    return apiResponse.ok({
      markers,
      groups,
      pendingCount,
      failedCount,
      unlocatedPeople,
      geocodingEnabled: user?.geocodingEnabled ?? true,
    });
  } catch (error) {
    return handleApiError(error, 'map-markers');
  }
});
