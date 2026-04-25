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
  photo: string | null;
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
      id: string;
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

    const parseGroupIds = (value: string | null) =>
      Array.from(
        new Set(
          (value ?? '')
            .split(',')
            .map((groupId) => groupId.trim())
            .filter(Boolean),
        ),
      );

    const includeGroupIds = parseGroupIds(searchParams.get('includeGroupIds'));
    const excludeGroupIds = parseGroupIds(searchParams.get('excludeGroupIds'));
    const limit = searchParams.get('limit');
    const includePredicates: Array<Record<string, unknown>> = [];
    const excludePredicates: Array<Record<string, unknown>> = [];

    // Build atomic predicates for included and excluded groups
    includeGroupIds.forEach((groupId) => {
      includePredicates.push({
        groups: {
          some: {
            groupId,
            group: {
              deletedAt: null,
            },
          },
        },
      });
    });

    excludeGroupIds.forEach((groupId) => {
      excludePredicates.push({
        NOT: {
          groups: {
            some: {
              groupId,
              group: {
                deletedAt: null,
              },
            },
          },
        },
      });
    });

    // Build where clause
    const groupOperator = searchParams.get('groupMatchOperator') === 'and' ? 'AND' : 'OR';
    const includeGroupClause =
      includePredicates.length > 0 ? { [groupOperator]: includePredicates } : null;
    const filterPredicates: Array<Record<string, unknown>> = [];

    if (includeGroupClause) {
      filterPredicates.push(includeGroupClause);
    }
    filterPredicates.push(...excludePredicates);

    const whereClause = {
      userId: session.user.id,
      deletedAt: null,
      ...(filterPredicates.length > 0 ? { AND: filterPredicates } : {}),
    };

    // Fetch people with optimized select to minimize payload
    const people = (await prisma.person.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        photo: true,
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
                id: true,
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

    // Fetch user photo and name order preference for the center node
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { photo: true, nameOrder: true, nameDisplayFormat: true },
    });
    const nameOrder = user?.nameOrder;
    const nameDisplayFormat = user?.nameDisplayFormat;

    // Add user as the center node
    const userId = `user-${session.user.id}`;
    nodes.push(userToGraphNode(userId, true, user?.photo));
    nodeIds.add(userId);

    // Add all people as nodes
    people.forEach((person) => {
      nodes.push(personToGraphNode(person, false, nameOrder, nameDisplayFormat));
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

    // Enrich edges with source and target labels for tooltip display
    const nodeLabels = new Map<string, string>();
    nodes.forEach((n) => nodeLabels.set(n.id, n.label));

    const enrichedEdges = edges.map((e) => ({
      ...e,
      sourceLabel: nodeLabels.get(e.source) || '',
      targetLabel: nodeLabels.get(e.target) || '',
    }));

    return apiResponse.ok({ nodes, edges: enrichedEdges });
  } catch (error) {
    return handleApiError(error, 'dashboard-graph');
  }
});
