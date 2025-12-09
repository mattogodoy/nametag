import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (request, session) => {
  try {
    // Parse query params for group filtering
    const { searchParams } = new URL(request.url);
    const groupIdsParam = searchParams.get('groupIds');
    const filterByGroups = groupIdsParam ? groupIdsParam.split(',').filter(Boolean) : null;

    // Fetch all user data
    const [user, allPeople, allGroups, relationshipTypes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          email: true,
          name: true,
          theme: true,
          dateFormat: true,
          createdAt: true,
        },
      }),
      prisma.person.findMany({
        where: {
          userId: session.user.id,
          ...(filterByGroups && filterByGroups.length > 0
            ? {
                groups: {
                  some: {
                    groupId: { in: filterByGroups },
                  },
                },
              }
            : {}),
        },
        include: {
          relationshipToUser: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
          groups: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          relationshipsFrom: {
            include: {
              relatedPerson: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  nickname: true,
                },
              },
              relationshipType: {
                select: {
                  id: true,
                  name: true,
                  label: true,
                },
              },
            },
          },
        },
      }),
      prisma.group.findMany({
        where: { userId: session.user.id },
      }),
      prisma.relationshipType.findMany({
        where: { userId: session.user.id },
      }),
    ]);

    // Get set of exported person IDs for filtering relationships
    const exportedPersonIds = new Set(allPeople.map((p) => p.id));

    // When filtering by groups, only include those specific groups (not all groups the people belong to)
    const exportedGroupIds = filterByGroups && filterByGroups.length > 0
      ? new Set(filterByGroups)
      : new Set(allPeople.flatMap((p) => p.groups.map((g) => g.group.id)));

    // Filter relationships to only include those between exported people
    // Also filter person's groups to only include the exported groups
    const people = allPeople.map((person) => ({
      ...person,
      groups: person.groups.filter((g) => exportedGroupIds.has(g.group.id)),
      relationshipsFrom: person.relationshipsFrom.filter((rel) =>
        exportedPersonIds.has(rel.relatedPersonId)
      ),
    }));

    // Filter groups to only include the exported groups
    const groups = allGroups.filter((g) => exportedGroupIds.has(g.id));

    // Build export data structure
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      user: {
        email: user?.email,
        name: user?.name,
        theme: user?.theme,
        dateFormat: user?.dateFormat,
        accountCreated: user?.createdAt,
      },
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
      })),
      people: people.map((person) => ({
        id: person.id,
        name: person.name,
        surname: person.surname,
        nickname: person.nickname,
        lastContact: person.lastContact,
        notes: person.notes,
        relationshipToUser: person.relationshipToUser
          ? {
              name: person.relationshipToUser.name,
              label: person.relationshipToUser.label,
            }
          : null,
        groups: person.groups.map((pg) => pg.group.name),
        relationships: person.relationshipsFrom.map((rel) => ({
          relatedPersonId: rel.relatedPersonId,
          relatedPersonName: `${rel.relatedPerson.name}${rel.relatedPerson.nickname ? ` '${rel.relatedPerson.nickname}'` : ''}${rel.relatedPerson.surname ? ` ${rel.relatedPerson.surname}` : ''}`,
          relationshipType: rel.relationshipType
            ? {
                name: rel.relationshipType.name,
                label: rel.relationshipType.label,
              }
            : null,
          notes: rel.notes,
        })),
      })),
      customRelationshipTypes: relationshipTypes.map((type) => ({
        id: type.id,
        name: type.name,
        label: type.label,
        color: type.color,
        inverseId: type.inverseId,
      })),
    };

    return apiResponse.ok(exportData);
  } catch (error) {
    return handleApiError(error, 'user-export');
  }
});
