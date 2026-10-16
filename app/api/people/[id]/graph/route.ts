import { prisma } from '@/lib/prisma';
import { findPersonForGraph } from '@/lib/prisma-queries';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import type { GraphNode, GraphEdge } from '@/lib/graph-utils';
import {
  userToGraphNode,
  personToGraphNode,
  relationshipsWithUserToGraphEdges,
  relationshipToGraphEdge,
  inverseRelationshipToGraphEdge,
} from '@/lib/graph-utils';
import { createLabelResolver } from '@/lib/relationship-labels';

export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Fetch the person with all their relationships
    const person = await findPersonForGraph(id, session.user.id);

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Build graph data
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // One resolver for the whole graph: it loads every displayed person's data
    // up front, so `resolve` below is a synchronous, cheap call per edge.
    const allPersonIds = new Set<string>([person.id]);
    person.relationshipsFrom.forEach((rel) => {
      allPersonIds.add(rel.relatedPersonId);
    });
    const labelResolver = await createLabelResolver(session.user.id, Array.from(allPersonIds), {
      userContext: {
        fields: {
          name: session.user.name ?? null,
          surname: session.user.surname ?? null,
          nickname: session.user.nickname ?? null,
        },
        groupIds: new Set<string>(),
        customValues: new Map(),
        dates: [],
      },
    });

    // Fetch user photo and name order preference
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { photo: true, nameOrder: true, nameDisplayFormat: true },
    });
    const nameOrder = user?.nameOrder;
    const nameDisplayFormat = user?.nameDisplayFormat;

    // Add center node (the person we're viewing)
    nodes.push(personToGraphNode(person, true, nameOrder, nameDisplayFormat));
    nodeIds.add(person.id);

    // Add user as a node
    const userId = `user-${session.user.id}`;
    nodes.push(userToGraphNode(userId, false, user?.photo));
    nodeIds.add(userId);

    // if person has direct relationship to user, add them
    edges.push(...relationshipsWithUserToGraphEdges(person, userId, labelResolver));

    // Add related people as nodes
    person.relationshipsFrom.forEach((rel) => {
      nodes.push(personToGraphNode(rel.relatedPerson, false, nameOrder, nameDisplayFormat));
      nodeIds.add(rel.relatedPersonId);

      // If the related person has direct relationship to the user, add them
      edges.push(
        ...relationshipsWithUserToGraphEdges(rel.relatedPerson, userId, labelResolver),
      );
    });

    // Build edges with deduplication
    const dedupedEdges = new Map<string, GraphEdge>();

    // Add edges from center person to related people
    person.relationshipsFrom
      .map((r) => relationshipToGraphEdge(r, labelResolver))
      .filter((e) => e !== undefined)
      .forEach((e) => {
          dedupedEdges.set(`${e.source}-${e.target}`, e);
      });

    // include the inverse relationships too
    person.relationshipsFrom
      .map((r) => inverseRelationshipToGraphEdge(r, labelResolver))
      .filter((e) => e !== undefined)
      .forEach((e) => {
          dedupedEdges.set(`${e.source}-${e.target}`, e);
      });

    // Add edges between related people (relationships within the network)
    person.relationshipsFrom.forEach((rel) => {
      if (!rel.relatedPerson.relationshipsFrom) {
        return;
      }

      // Find relationships from this related person to other related people
      // and add edge only if this other related person's already in the graph
      rel.relatedPerson.relationshipsFrom
        .filter((r) => nodeIds.has(r.relatedPersonId))
        .map((r) => relationshipToGraphEdge(r, labelResolver))
        .filter((e) => e !== undefined)
        .forEach((e) => {
          dedupedEdges.set(`${e.source}-${e.target}`, e);
        });

      // include the inverse relationships too
      rel.relatedPerson.relationshipsFrom
        .filter((r) => nodeIds.has(r.relatedPersonId))
        .map((r) => inverseRelationshipToGraphEdge(r, labelResolver))
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
    return handleApiError(error, 'people-graph');
  }
});
