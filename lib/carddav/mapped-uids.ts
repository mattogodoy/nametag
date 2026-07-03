import { prisma } from '@/lib/prisma';

/**
 * Returns the set of person UIDs that already have a CardDavMapping.
 *
 * Used by discovery, sync, import page, and pending-count to suppress
 * contacts whose person is already mapped under a different UID
 * (e.g. auto-export with server UID rewrite).
 */
export async function getAlreadyMappedPersonUids(userId: string): Promise<Set<string>> {
  const persons = await prisma.person.findMany({
    where: {
      userId,
      deletedAt: null,
      uid: { not: null },
      cardDavMapping: { isNot: null },
    },
    select: { uid: true },
  });
  return new Set(persons.map((p) => p.uid!));
}

/**
 * Returns a map from UID to person ID for all persons (including unmapped ones).
 *
 * Used during sync/discovery to auto-link server contacts to existing persons
 * that were imported via file upload and have matching UIDs but no CardDavMapping.
 */
export async function getUnmappedPersonsByUid(userId: string): Promise<Map<string, string>> {
  const persons = await prisma.person.findMany({
    where: {
      userId,
      deletedAt: null,
      uid: { not: null },
      cardDavMapping: null,
    },
    select: { id: true, uid: true },
  });
  return new Map(persons.map((p) => [p.uid!, p.id]));
}
