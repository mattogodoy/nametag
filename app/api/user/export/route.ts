import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session) => {
  try {
    // Fetch all user data
    const [user, people, groups, relationshipTypes] = await Promise.all([
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
        where: { userId: session.user.id },
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
