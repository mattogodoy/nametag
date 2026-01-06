import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

type DashboardGraphPerson = {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  relationshipToUser: {
    label: string;
    color: string | null;
  } | null;
  groups: Array<{
    group: {
      name: string;
      color: string | null;
    };
  }>;
  relationshipsFrom: Array<{
    relatedPersonId: string;
    relationshipType:
      | {
          label: string;
          color: string | null;
          inverse: {
            label: string;
            color: string | null;
          } | null;
        }
      | null;
  }>;
};

interface GraphNode {
  id: string;
  label: string;
  groups: string[];
  colors: string[];
  isCenter: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  color: string;
}

export const GET = withAuth(async (request, session) => {
  try {
    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const groupIds = searchParams.getAll('groupIds'); // Get all groupIds parameters
    const limit = searchParams.get('limit');

    // Build where clause
    const whereClause = {
      userId: session.user.id,
      deletedAt: null,
      // Filter by groups if specified (show people who belong to ANY of the selected groups)
      ...(groupIds.length > 0 && {
        groups: {
          some: {
            groupId: {
              in: groupIds,
            },
            group: {
              deletedAt: null,
            },
          },
        },
      }),
    };

    // Fetch people with optimized select to minimize payload
    const people = (await prisma.person.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        relationshipToUser: {
          where: {
            deletedAt: null,
          },
          select: {
            label: true,
            color: true,
          },
        },
        groups: {
          where: {
            group: {
              deletedAt: null,
            },
          },
          select: {
            group: {
              select: {
                name: true,
                color: true,
              },
            },
          },
        },
        relationshipsFrom: {
          where: {
            deletedAt: null,
            relatedPerson: {
              deletedAt: null,
            },
          },
          select: {
            relatedPersonId: true,
            relationshipType: {
              where: {
                deletedAt: null,
              },
              select: {
                label: true,
                color: true,
                inverse: {
                  where: {
                    deletedAt: null,
                  },
                  select: {
                    label: true,
                    color: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      ...(limit ? { take: parseInt(limit) } : {}),
    })) as unknown as DashboardGraphPerson[];

    // Build graph data
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Add user as the center node
    const userId = `user-${session.user.id}`;
    nodes.push({
      id: userId,
      label: 'You',
      groups: [],
      colors: [],
      isCenter: true,
    });
    nodeIds.add(userId);

    // Add all people as nodes
    people.forEach((person) => {
      nodes.push({
        id: person.id,
        label: formatFullName(person),
        groups: person.groups.map((pg) => pg.group.name),
        colors: person.groups.map((pg) => pg.group.color || '#3B82F6'),
        isCenter: false,
      });
      nodeIds.add(person.id);

      // Connect each person to the user with their specific relationship (if they have a direct one)
      if (person.relationshipToUser) {
        edges.push({
          source: userId,
          target: person.id,
          type: person.relationshipToUser.label,
          color: person.relationshipToUser.color || '#9CA3AF',
        });
      }
    });

    // Add all relationships between people as edges (deduplicated)
    const addedEdges = new Set<string>();

    people.forEach((person) => {
      person.relationshipsFrom.forEach((rel) => {
        // Only add edges where both nodes exist
        if (nodeIds.has(rel.relatedPersonId)) {
          // Use lexicographic ordering to deduplicate bidirectional relationships
          const isSwapped = person.id > rel.relatedPersonId;
          const sourceId = isSwapped ? rel.relatedPersonId : person.id;
          const targetId = isSwapped ? person.id : rel.relatedPersonId;
          const edgeKey = `${sourceId}-${targetId}`;

          // Only add if we haven't already added this edge
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);

            // If we swapped the direction, use the inverse relationship label
            const relationshipLabel = isSwapped && rel.relationshipType?.inverse
              ? rel.relationshipType.inverse.label
              : (rel.relationshipType?.label || 'Unknown');

            const relationshipColor = isSwapped && rel.relationshipType?.inverse
              ? rel.relationshipType.inverse.color
              : (rel.relationshipType?.color || '#999999');

            edges.push({
              source: sourceId,
              target: targetId,
              type: relationshipLabel,
              color: relationshipColor || '#999999',
            });
          }
        }
      });
    });

    return apiResponse.ok({ nodes, edges });
  } catch (error) {
    return handleApiError(error, 'dashboard-graph');
  }
});
