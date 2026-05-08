/**
 * Composable Prisma query helpers for Person queries.
 *
 * The Prisma soft-delete extension (lib/prisma.ts) auto-injects
 * `deletedAt: null` on top-level reads, but nested includes need
 * the filter applied manually.  These builders centralise that
 * logic so every route gets correct filtering without duplicating
 * 100+ line include blocks.
 */
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Private helpers – composable fragments
// ---------------------------------------------------------------------------

/**
 * Prisma `include` fragment for a person's CustomFieldTemplate-backed values,
 * filtered to active templates only. Use anywhere a Person is loaded for
 * vCard export, conflict comparison, or detail rendering.
 */
export function customFieldValuesInclude() {
  return {
    include: { template: true },
    where: { template: { deletedAt: null } },
  } as const;
}

/** Multi-value contact fields (phones, emails, etc.) – always included as `true`. */
function multiValueFieldsInclude() {
  return {
    phoneNumbers: true,
    emails: true,
    addresses: true,
    urls: true,
    imHandles: true,
    locations: true,
    customFields: true,
    customFieldValues: customFieldValuesInclude(),
  } as const;
}

/** Groups with soft-delete filter on the related group. */
function groupsInclude() {
  return {
    groups: {
      where: {
        group: {
          deletedAt: null,
        },
      },
      include: {
        group: true,
      },
    },
  } as const;
}

/** Important dates filtered and ordered. */
function importantDatesInclude() {
  return {
    importantDates: {
      where: { deletedAt: null },
      orderBy: { date: 'asc' as const },
    },
  } as const;
}

/** RelationshipToUser with its inverse, both soft-delete filtered. */
function relationshipToUserInclude() {
  return {
    relationshipToUser: {
      include: {
        inverse: {
          where: {
            deletedAt: null,
          },
        },
      },
      where: {
        deletedAt: null,
      },
    },
  } as const;
}

/** RelationshipType with inverse, soft-delete filtered. */
function relationshipTypeInclude() {
  return {
    relationshipType: {
      where: {
        deletedAt: null,
      },
      include: {
        inverse: {
          where: {
            deletedAt: null,
          },
        },
      },
    },
  } as const;
}

// ---------------------------------------------------------------------------
// Public: where clause builder
// ---------------------------------------------------------------------------

/**
 * Ownership-scoped where clause for a single Person.
 *
 * Top-level `deletedAt: null` is handled by the Prisma client extension,
 * so it is intentionally omitted here.
 */
export function personWhere(id: string, userId: string) {
  return { id, userId };
}

// ---------------------------------------------------------------------------
// Public: include builders
// ---------------------------------------------------------------------------

/**
 * Include for the Person detail view (GET /api/people/[id]).
 *
 * Covers multi-value fields, groups (soft-delete filtered),
 * importantDates (filtered + ordered), relationshipsFrom,
 * relationshipsTo (id only), and relationshipToUser.
 */
export function personDetailsInclude() {
  return {
    relationshipToUser: true,
    ...groupsInclude(),
    relationshipsFrom: {
      where: { deletedAt: null },
      include: {
        relatedPerson: true,
      },
    },
    relationshipsTo: {
      where: { deletedAt: null },
      select: { id: true },
    },
    ...multiValueFieldsInclude(),
    ...importantDatesInclude(),
  } as const;
}

/**
 * Include for relationship-heavy views (person + relationships with
 * nested related people, their groups, and relationship types).
 *
 * Matches the pattern in the graph route's `relationshipsFrom` at
 * the first nesting level.
 */
export function personRelationshipsInclude() {
  return {
    relationshipsFrom: {
      where: {
        deletedAt: null,
        relatedPerson: {
          deletedAt: null,
        },
      },
      include: {
        relatedPerson: {
          include: {
            ...relationshipToUserInclude(),
            ...groupsInclude(),
          },
        },
        ...relationshipTypeInclude(),
      },
    },
  } as const;
}

/**
 * Deep include for the person graph view
 * (GET /api/people/[id]/graph).
 *
 * This matches the exact structure from
 * `app/api/people/[id]/graph/route.ts:23-117`.
 */
export function personGraphInclude() {
  return {
    ...relationshipToUserInclude(),
    ...groupsInclude(),
    relationshipsFrom: {
      where: {
        deletedAt: null,
        relatedPerson: {
          deletedAt: null,
        },
      },
      include: {
        relatedPerson: {
          include: {
            ...relationshipToUserInclude(),
            ...groupsInclude(),
            // Fetch relationships between connected people
            relationshipsFrom: {
              where: {
                deletedAt: null,
                relatedPerson: {
                  deletedAt: null,
                },
              },
              include: {
                ...relationshipTypeInclude(),
              },
            },
          },
        },
        ...relationshipTypeInclude(),
      },
    },
  } as const;
}

/**
 * Include for the update response
 * (PUT /api/people/[id] response shape).
 */
export function personUpdateInclude() {
  return {
    ...groupsInclude(),
    ...multiValueFieldsInclude(),
    ...importantDatesInclude(),
  } as const;
}

// ---------------------------------------------------------------------------
// Public: finder functions
// ---------------------------------------------------------------------------

/** Basic findUnique – no extra includes. */
export async function findPersonById(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
  });
}

/** findUnique with the full detail include. */
export async function findPersonWithDetails(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: personDetailsInclude(),
  });
}

/** findUnique with details + deep relationships. */
export async function findPersonWithRelationships(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: {
      ...personDetailsInclude(),
      ...personRelationshipsInclude(),
    },
  });
}

/** findUnique with the graph include. */
export async function findPersonForGraph(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: personGraphInclude(),
  });
}

/** findMany for a user, with optional extra includes and where filters. */
export async function findPeopleByUser(
  userId: string,
  options?: {
    include?: Prisma.PersonInclude;
    where?: Prisma.PersonWhereInput;
    orderBy?: Prisma.PersonOrderByWithRelationInput | Prisma.PersonOrderByWithRelationInput[];
  },
) {
  return prisma.person.findMany({
    where: {
      userId,
      ...options?.where,
    },
    include: options?.include,
    orderBy: options?.orderBy,
  });
}

/** Count people belonging to a user. */
export async function countPeopleByUser(userId: string) {
  return prisma.person.count({
    where: { userId },
  });
}
