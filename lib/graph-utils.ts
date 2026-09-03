import { Prisma } from '@prisma/client';
import { formatGraphName, type NameDisplayFormat } from './nameUtils';
import type { LabelResolver } from './relationship-labels';

export interface GraphNode {
  id: string;
  label: string;
  groups: string[];
  colors: string[];
  isCenter: boolean;
  photo?: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  color: string;
  sourceLabel?: string;
  targetLabel?: string;
}

type PersonId = Prisma.PersonGetPayload<{
  select: { id: true };
}>;

type RelationshipToUser = Prisma.RelationshipTypeGetPayload<{
  select: { id: true; label: true; color: true };
}>;

type InverseRelationship = RelationshipToUser;

interface PersonWithRelationshipToUser extends PersonId {
  relationshipToUser:
    | (RelationshipToUser & {
        inverse: InverseRelationship | null;
      })
    | null;
}

/**
 * Converts a person's relationship to the user into graph edges.
 */
export function relationshipsWithUserToGraphEdges(
  person: PersonWithRelationshipToUser,
  userId: string,
  resolver?: LabelResolver,
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  if (person.relationshipToUser) {
    const directType = person.relationshipToUser;
    // Add edge from person to user (their relationship to you)
    edges.push({
      source: person.id,
      target: userId,
      type: resolver
        ? resolver.resolve({
            relationshipTypeId: directType.id,
            typeLabel: directType.label,
            describedPersonId: person.id,
            otherPersonId: 'USER',
          }).label
        : directType.label,
      color: directType.color || '#9CA3AF',
    });

    // Add edge from user to person (your relationship to them)
    // Use inverse type if available, otherwise use the type itself
    // (correct for symmetric types where the inverse IS the same type)
    const inverseType = person.relationshipToUser.inverse || person.relationshipToUser;
    edges.push({
      source: userId,
      target: person.id,
      type: resolver
        ? resolver.resolve({
            relationshipTypeId: inverseType.id,
            typeLabel: inverseType.label,
            describedPersonId: 'USER',
            otherPersonId: person.id,
          }).label
        : inverseType.label,
      color: inverseType.color || '#9CA3AF',
    });
  }
  return edges;
}

type Relationship = Prisma.RelationshipGetPayload<{
  select: {
    personId: true;
    relatedPersonId: true;
    relationshipType: { select: { id: true; label: true; color: true } };
  };
}>;

/**
 * Converts a relationship into a graph edge.
 * Returns undefined if the relationship type is missing.
 */
export function relationshipToGraphEdge(
  relationship: Relationship,
  resolver?: LabelResolver,
): GraphEdge | undefined {
  const type = relationship.relationshipType;
  if (!type) {
    return;
  }
  return {
    source: relationship.personId,
    target: relationship.relatedPersonId,
    type: resolver
      ? resolver.resolve({
          relationshipTypeId: type.id,
          typeLabel: type.label,
          describedPersonId: relationship.personId,
          otherPersonId: relationship.relatedPersonId,
        }).label
      : type.label,
    color: type.color || '#999999',
  };
}

interface RelationshipWithInverse extends Relationship {
  relationshipType:
    | (Relationship['relationshipType'] & {
        inverse: InverseRelationship | null;
      })
    | null;
}

/**
 * Converts the inverse relationship into a graph edge
 * E.g., if the relationship is "parent", this creates
 * the "child" edge.
 * Returns undefined if there is no inverse relationship.
 */
export function inverseRelationshipToGraphEdge(
  relationship: RelationshipWithInverse,
  resolver?: LabelResolver,
): GraphEdge | undefined {
  if (!relationship.relationshipType) {
    return;
  }
  // Use inverse type if available, otherwise use the type itself
  // (correct for symmetric types where the inverse IS the same type)
  const inverseType = relationship.relationshipType.inverse || relationship.relationshipType;
  return {
    source: relationship.relatedPersonId,
    target: relationship.personId,
    type: resolver
      ? resolver.resolve({
          relationshipTypeId: inverseType.id,
          typeLabel: inverseType.label,
          describedPersonId: relationship.relatedPersonId,
          otherPersonId: relationship.personId,
        }).label
      : inverseType.label,
    color: inverseType.color || '#999999',
  };
}

type Group = Prisma.GroupGetPayload<{
  select: { id: true; name: true; color: true };
}>;

interface Person
  extends Prisma.PersonGetPayload<{
    select: { id: true; name: true; surname: true; nickname: true; displayNameOverride: true; photo: true };
  }> {
  groups: { group: Group }[];
}

export function personToGraphNode(
  person: Person,
  isCenter = false,
  nameOrder?: 'WESTERN' | 'EASTERN',
  nameDisplayFormat?: NameDisplayFormat
): GraphNode {
  return {
    id: person.id,
    label: formatGraphName(person, nameOrder, nameDisplayFormat),
    groups: person.groups.map((pg) => pg.group.id),
    colors: person.groups.map((pg) => pg.group.color || '#3B82F6'),
    isCenter,
    photo: person.photo,
  };
}

export function userToGraphNode(id: string, isCenter = false, photo?: string | null): GraphNode {
  return {
    id,
    label: 'You',
    groups: [],
    colors: [],
    isCenter,
    photo: photo || undefined,
  };
}
