import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch the person with all their relationships
  const person = await prisma.person.findUnique({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      relationshipToUser: true, // Include the relationship to the user
      groups: {
        include: {
          group: true,
        },
      },
      relationshipsFrom: {
        include: {
          relatedPerson: {
            include: {
              relationshipToUser: true, // Include the related person's relationship to user
              groups: {
                include: {
                  group: true,
                },
              },
            },
          },
          relationshipType: true,
        },
      },
    },
  });

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  // Build graph data
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();

  // Add center node (the person we're viewing)
  nodes.push({
    id: person.id,
    label: person.fullName,
    groups: person.groups.map((pg) => pg.group.name),
    colors: person.groups.map((pg) => pg.group.color || '#3B82F6'),
    isCenter: true,
  });
  nodeIds.add(person.id);

  // Add user as a node
  const userId = `user-${session.user.id}`;
  nodes.push({
    id: userId,
    label: session.user.name || session.user.email || 'You',
    groups: [],
    colors: [],
    isCenter: false,
  });
  nodeIds.add(userId);

  // Add edge from person to user (their relationship to you) if direct relationship exists
  if (person.relationshipToUser) {
    edges.push({
      source: person.id,
      target: userId,
      type: person.relationshipToUser.label,
      color: person.relationshipToUser.color || '#9CA3AF',
    });
  }

  // Add related people as nodes and create edges
  person.relationshipsFrom.forEach((rel) => {
    if (!nodeIds.has(rel.relatedPersonId)) {
      nodes.push({
        id: rel.relatedPersonId,
        label: rel.relatedPerson.fullName,
        groups: rel.relatedPerson.groups.map((pg) => pg.group.name),
        colors: rel.relatedPerson.groups.map((pg) => pg.group.color || '#3B82F6'),
        isCenter: false,
      });
      nodeIds.add(rel.relatedPersonId);
    }

    // Add edge from person to related person
    edges.push({
      source: person.id,
      target: rel.relatedPersonId,
      type: rel.relationshipType?.label || 'Unknown',
      color: rel.relationshipType?.color || '#999999',
    });

    // If the related person has a direct relationship to the user, add that edge too
    if (rel.relatedPerson.relationshipToUser) {
      edges.push({
        source: rel.relatedPersonId,
        target: userId,
        type: rel.relatedPerson.relationshipToUser.label,
        color: rel.relatedPerson.relationshipToUser.color || '#9CA3AF',
      });
    }
  });

  return NextResponse.json({ nodes, edges });
}
