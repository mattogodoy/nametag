import type { CardDavConnection } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { mergePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { createCardDavClient, deleteVCardDirect } from '@/lib/carddav/client';
import { mergePeople } from '@/lib/services/person';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('merge');

// ---------------------------------------------------------------------------
// CardDAV helpers — external HTTP concerns that belong in the route layer
// ---------------------------------------------------------------------------

/**
 * Best-effort deletion of a secondary contact's vCard from the CardDAV server.
 * Tries multiple strategies: stored etag → wildcard → server-side lookup.
 */
async function deleteSecondaryVCard(
  secondary: {
    id: string;
    name: string;
    surname: string | null;
    displayNameOverride: string | null;
    cardDavMapping: {
      href: string;
      etag: string | null;
      uid: string;
      connection: CardDavConnection;
    } | null;
  },
): Promise<void> {
  if (!secondary.cardDavMapping) return;

  const mapping = secondary.cardDavMapping;
  const connection = mapping.connection;

  // Step 1: Try direct DELETE with stored etag
  try {
    await deleteVCardDirect(connection, mapping.href, mapping.etag || '');
    return;
  } catch (etagErr) {
    log.warn(
      { err: etagErr instanceof Error ? etagErr : new Error(String(etagErr)), personId: secondary.id },
      'CardDAV delete with etag failed, retrying with wildcard'
    );
  }

  // Step 2: Try direct DELETE with wildcard etag
  try {
    await deleteVCardDirect(connection, mapping.href, '*');
    return;
  } catch (wildcardErr) {
    log.warn(
      { err: wildcardErr instanceof Error ? wildcardErr : new Error(String(wildcardErr)), personId: secondary.id },
      'CardDAV delete with wildcard etag also failed'
    );

    // Step 3: If 404, the stored href is wrong (common with Google Contacts
    // which rewrites both the URL and UID of created vCards).
    if (!String(wildcardErr).includes('404')) return;
  }

  // Step 3: Server-side lookup by UID or name
  log.info({ personId: secondary.id, uid: mapping.uid }, 'Stored href returned 404, attempting server-side lookup');
  try {
    const client = await createCardDavClient(connection);
    const addressBooks = await client.fetchAddressBooks();
    for (const ab of addressBooks) {
      const vCards = await client.fetchVCards(ab);

      // Try 1: Match by UID in vCard data
      let match = null;
      if (mapping.uid) {
        const escapedUid = mapping.uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const uidPattern = new RegExp(`^UID[^:]*:(?:urn:uuid:)?${escapedUid}\\s*$`, 'mi');
        match = vCards.find((vc) => vc.data && uidPattern.test(vc.data));
      }

      // Try 2: Match by UID in URL
      if (!match && mapping.uid) {
        const uidInUrl = mapping.uid.toLowerCase();
        match = vCards.find((vc) => vc.url.toLowerCase().includes(uidInUrl));
      }

      // Try 3: Match by name (FN field)
      if (!match) {
        const fullName = secondary.displayNameOverride
          || [secondary.name, secondary.surname].filter(Boolean).join(' ');
        if (fullName) {
          const fnMatches = vCards.filter((vc) => {
            const fnMatch = vc.data.match(/^FN[^:]*:(.+)$/mi);
            return fnMatch && fnMatch[1].trim() === fullName;
          });
          if (fnMatches.length === 1) {
            match = fnMatches[0];
          } else if (fnMatches.length > 1) {
            log.warn(
              { personId: secondary.id, count: fnMatches.length, fullName },
              'Multiple vCards match by name, skipping delete to avoid wrong deletion'
            );
          }
        }
      }

      if (match) {
        log.info(
          { personId: secondary.id, storedHref: mapping.href, actualUrl: match.url },
          'Found vCard on server via lookup, deleting'
        );
        await deleteVCardDirect(connection, match.url, '*');
        return;
      }
    }
    log.warn({ personId: secondary.id }, 'vCard not found on server by UID or name');
  } catch (lookupErr) {
    log.warn(
      { err: lookupErr instanceof Error ? lookupErr : new Error(String(lookupErr)), personId: secondary.id },
      'Server-side vCard lookup for delete failed'
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/people/merge
// ---------------------------------------------------------------------------

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(mergePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { primaryId, secondaryId, fieldOverrides } = validation.data;

    // Pre-fetch both people's CardDAV data for server-side vCard cleanup.
    // The core merge logic in mergePeople() handles all DB operations.
    const [primaryCardDav, secondaryForCardDav] = await Promise.all([
      prisma.cardDavMapping.findUnique({
        where: { personId: primaryId },
      }),
      prisma.person.findUnique({
        where: { id: secondaryId, userId: session.user.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          surname: true,
          displayNameOverride: true,
          cardDavMapping: { include: { connection: true } },
        },
      }),
    ]);

    // Best-effort: delete secondary's vCard from the CardDAV server
    if (secondaryForCardDav) {
      await deleteSecondaryVCard(secondaryForCardDav);
    }

    // Core merge — handles all DB operations (scalar transfer, dedup,
    // relationship re-parenting, group transfer, soft-delete)
    const result = await mergePeople(primaryId, secondaryId, session.user.id, fieldOverrides);

    if (!result) {
      return apiResponse.notFound('Person not found');
    }

    // Mark primary's CardDAV mapping as pending so merge changes get pushed
    if (primaryCardDav) {
      await prisma.cardDavMapping.update({
        where: { id: primaryCardDav.id },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    }

    log.info(
      { primaryId, secondaryId, userId: session.user.id },
      'Successfully merged contacts'
    );

    return apiResponse.ok({ mergedInto: primaryId });
  } catch (error) {
    return handleApiError(error, 'people-merge');
  }
});
