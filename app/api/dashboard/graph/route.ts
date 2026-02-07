import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import type { GraphNode, GraphEdge } from '@/lib/graph-utils';
import {
  userToGraphNode,
  personToGraphNode,
  relationshipsWithUserToGraphEdges,
  relationshipToGraphEdge,
  inverseRelationshipToGraphEdge,
} from '@/lib/graph-utils';

type DashboardGraphPerson = {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  relationshipToUser: {
    label: string;
    color: string | null;
    inverse: {
      label: string;
      color: string | null;
    } | null;
  } | null;
  groups: Array<{
    group: {
      name: string;
      color: string | null;
    };
  }>;
  relationshipsFrom: Array<{
    personId: string;
    relatedPersonId: string;
    relationshipType: {
      label: string;
      color: string | null;
      inverse: {
        label: string;
        color: string | null;
      } | null;
    } | null;
  }>;
};

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
            personId: true,
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
    nodes.push(userToGraphNode(userId, true));
    nodeIds.add(userId);

    // Add all people as nodes
    people.forEach((person) => {
      nodes.push(personToGraphNode(person));
      nodeIds.add(person.id);

      // Connect each person to the user with their specific relationship (if they have a direct one)
      edges.push(...relationshipsWithUserToGraphEdges(person, userId));
    });

    // Add all relationships between people as edges (deduplicated)
    const dedupedEdges = new Map<string, GraphEdge>();

    people.forEach((person) => {
      // only add edges when both people are present in the graph
      person.relationshipsFrom
        .filter((r) => nodeIds.has(r.relatedPersonId))
        .map(relationshipToGraphEdge)
        .filter((e) => e !== undefined)
        .forEach((e) => {
          dedupedEdges.set(`${e.source}-${e.target}`, e);
        });

      // include the inverse relationships too
      person.relationshipsFrom
        .filter((r) => nodeIds.has(r.relatedPersonId))
        .map(inverseRelationshipToGraphEdge)
        .filter((e) => e !== undefined)
        .forEach((e) => {
          dedupedEdges.set(`${e.source}-${e.target}`, e);
        });
    });

    edges.push(...dedupedEdges.values());

    return apiResponse.ok({ nodes, edges });
  } catch (error) {
    return handleApiError(error, 'dashboard-graph');
  }
});
