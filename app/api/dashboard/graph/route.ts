import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { handleApiError } from '@/lib/api-utils';

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

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters for filtering
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const limit = searchParams.get('limit');

  // Build where clause
  const whereClause: any = {
    userId: session.user.id,
  };

  // Filter by group if specified
  if (groupId && groupId !== 'all') {
    whereClause.groups = {
      some: {
        groupId: groupId,
      },
    };
  }

  // Fetch people with optimized select to minimize payload
  const people = await prisma.person.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      surname: true,
      nickname: true,
      relationshipToUser: {
        select: {
          label: true,
          color: true,
        },
      },
      groups: {
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
        select: {
          relatedPersonId: true,
          relationshipType: {
            select: {
              label: true,
              color: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
    ...(limit ? { take: parseInt(limit) } : {}),
  });

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
        const sourceId = person.id < rel.relatedPersonId ? person.id : rel.relatedPersonId;
        const targetId = person.id < rel.relatedPersonId ? rel.relatedPersonId : person.id;
        const edgeKey = `${sourceId}-${targetId}`;

        // Only add if we haven't already added this edge
        if (!addedEdges.has(edgeKey)) {
          addedEdges.add(edgeKey);
          edges.push({
            source: sourceId,
            target: targetId,
            type: rel.relationshipType?.label || 'Unknown',
            color: rel.relationshipType?.color || '#999999',
          });
        }
      }
    });
  });

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    return handleApiError(error, 'dashboard-graph');
  }
}
