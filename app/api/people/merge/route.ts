import { prisma } from '@/lib/prisma';
import { mergePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { createCardDavClient, deleteVCardDirect } from '@/lib/carddav/client';
import { withRetry } from '@/lib/carddav/retry';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('merge');

// Full include for fetching a person with all relations
const personFullInclude = {
  groups: true,
  relationshipsFrom: { where: { deletedAt: null } },
  relationshipsTo: { where: { deletedAt: null } },
  phoneNumbers: true,
  emails: true,
  addresses: true,
  urls: true,
  imHandles: true,
  locations: true,
  customFields: true,
  importantDates: true,
  cardDavMapping: { include: { connection: true } },
};

// POST /api/people/merge - Merge two contacts
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(mergePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { primaryId, secondaryId, fieldOverrides } = validation.data;

    // Fetch both people with all relations
    const [primary, secondary] = await Promise.all([
      prisma.person.findUnique({
        where: { id: primaryId, userId: session.user.id, deletedAt: null },
        include: personFullInclude,
      }),
      prisma.person.findUnique({
        where: { id: secondaryId, userId: session.user.id, deletedAt: null },
        include: personFullInclude,
      }),
    ]);

    if (!primary) {
      return apiResponse.notFound('Primary person not found');
    }

    if (!secondary) {
      return apiResponse.notFound('Secondary person not found');
    }

    // Try to delete the secondary's vCard from CardDAV BEFORE the transaction.
    // This is best-effort: if it fails, we still proceed with the merge.
    // Uses deleteVCardDirect (raw HTTP DELETE) to avoid tsdav's fragile DAV discovery.
    let serverDeleteSucceeded = false;
    if (secondary.cardDavMapping) {
      const mapping = secondary.cardDavMapping;
      const connection = mapping.connection;

      // Step 1: Try direct DELETE with stored etag
      try {
        await deleteVCardDirect(connection, mapping.href, mapping.etag || '');
        serverDeleteSucceeded = true;
      } catch (etagErr) {
        log.warn(
          { err: etagErr instanceof Error ? etagErr : new Error(String(etagErr)), personId: secondaryId },
          'CardDAV delete with etag failed, retrying with wildcard'
        );

        // Step 2: Try direct DELETE with wildcard etag
        try {
          await deleteVCardDirect(connection, mapping.href, '*');
          serverDeleteSucceeded = true;
        } catch (wildcardErr) {
          log.warn(
            { err: wildcardErr instanceof Error ? wildcardErr : new Error(String(wildcardErr)), personId: secondaryId },
            'CardDAV delete with wildcard etag also failed'
          );

          // Step 3: If 404, the stored href is wrong (common with Google Contacts
          // which rewrites both the URL and UID of created vCards).
          // Try to find the vCard by UID or by name (FN field).
          if (String(wildcardErr).includes('404')) {
            log.info({ personId: secondaryId, uid: mapping.uid }, 'Stored href returned 404, attempting server-side lookup');
            try {
              const client = await createCardDavClient(connection);
              const addressBooks = await client.fetchAddressBooks();
              let found = false;
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

                // Try 3: Match by name (FN field) — needed for Google Contacts
                // which replaces both URL and UID with its own values
                if (!match) {
                  const fullName = [secondary.name, secondary.surname].filter(Boolean).join(' ');
                  if (fullName) {
                    match = vCards.find((vc) => {
                      const fnMatch = vc.data.match(/^FN[^:]*:(.+)$/mi);
                      return fnMatch && fnMatch[1].trim() === fullName;
                    }) || null;
                  }
                }

                if (match) {
                  log.info(
                    { personId: secondaryId, storedHref: mapping.href, actualUrl: match.url },
                    'Found vCard on server via lookup, deleting'
                  );
                  await deleteVCardDirect(connection, match.url, '*');
                  serverDeleteSucceeded = true;
                  found = true;
                  break;
                }
              }
              if (!found) {
                log.warn({ personId: secondaryId }, 'vCard not found on server by UID or name');
              }
            } catch (lookupErr) {
              log.warn(
                { err: lookupErr instanceof Error ? lookupErr : new Error(String(lookupErr)), personId: secondaryId },
                'Server-side vCard lookup for delete failed'
              );
            }
          }
        }
      }
    }

    // Track whether we need post-transaction CardDAV cleanup for race conditions
    // (auto-export may create a mapping between our initial fetch and the transaction)
    type CardDavMappingInfo = { href: string; etag: string | null; connectionId: string; uid: string };

    // Build scalar field overrides for the primary contact
    const scalarUpdates: Record<string, unknown> = {};
    if (fieldOverrides) {
      const simpleFields = [
        'name', 'surname', 'middleName', 'secondLastName', 'nickname',
        'prefix', 'suffix', 'organization', 'jobTitle', 'gender', 'photo', 'notes',
      ] as const;

      for (const field of simpleFields) {
        if (field in fieldOverrides) {
          scalarUpdates[field] = fieldOverrides[field];
        }
      }

      if ('anniversary' in fieldOverrides) {
        scalarUpdates.anniversary = fieldOverrides.anniversary
          ? new Date(fieldOverrides.anniversary)
          : null;
      }

      if ('lastContact' in fieldOverrides) {
        scalarUpdates.lastContact = fieldOverrides.lastContact
          ? new Date(fieldOverrides.lastContact)
          : null;
      }

      if ('relationshipToUserId' in fieldOverrides) {
        scalarUpdates.relationshipToUser = fieldOverrides.relationshipToUserId
          ? { connect: { id: fieldOverrides.relationshipToUserId } }
          : { disconnect: true };
      }
    }

    // Auto-transfer secondary values for empty primary fields
    // (explicit user selection via fieldOverrides takes priority)
    const autoTransferFields = [
      'name', 'surname', 'middleName', 'secondLastName', 'nickname',
      'prefix', 'suffix', 'organization', 'jobTitle', 'gender', 'photo', 'notes',
    ] as const;

    for (const field of autoTransferFields) {
      if (!(field in scalarUpdates) && !primary[field] && secondary[field]) {
        scalarUpdates[field] = secondary[field];
      }
    }

    for (const dateField of ['anniversary', 'lastContact'] as const) {
      if (!(dateField in scalarUpdates) && !primary[dateField] && secondary[dateField]) {
        scalarUpdates[dateField] = secondary[dateField];
      }
    }

    if (!('relationshipToUser' in scalarUpdates) && !primary.relationshipToUserId && secondary.relationshipToUserId) {
      scalarUpdates.relationshipToUser = { connect: { id: secondary.relationshipToUserId } };
    }

    // Collect the group IDs that the primary already has
    const primaryGroupIds = new Set(primary.groups.map((g) => g.groupId));

    // Groups from the secondary that the primary doesn't already belong to
    const newGroupIds = secondary.groups
      .filter((g) => !primaryGroupIds.has(g.groupId))
      .map((g) => g.groupId);

    // Deduplication for multi-value fields
    const primaryPhoneNumbers = new Set(primary.phoneNumbers.map((p) => p.number));
    const primaryEmails = new Set(primary.emails.map((e) => e.email.toLowerCase()));
    const primaryUrls = new Set(primary.urls.map((u) => u.url.toLowerCase()));
    const primaryImHandles = new Set(primary.imHandles.map((im) => `${im.protocol}:${im.handle}`.toLowerCase()));
    const primaryAddresses = new Set(primary.addresses.map((a) =>
      [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country]
        .map((v) => (v ?? '').toLowerCase().trim())
        .join('|')
    ));
    const primaryLocations = new Set(primary.locations.map((l) => `${l.latitude},${l.longitude}`));
    const primaryCustomFields = new Set(primary.customFields.map((f) => `${f.key}:${f.value}`));
    const primaryImportantDates = new Set(primary.importantDates.map((d) =>
      `${d.title}:${d.date instanceof Date ? d.date.toISOString() : d.date}`
    ));

    const phonesToTransfer = secondary.phoneNumbers.filter(
      (p) => !primaryPhoneNumbers.has(p.number)
    );
    const emailsToTransfer = secondary.emails.filter(
      (e) => !primaryEmails.has(e.email.toLowerCase())
    );
    const urlsToTransfer = secondary.urls.filter(
      (u) => !primaryUrls.has(u.url.toLowerCase())
    );
    const imHandlesToTransfer = secondary.imHandles.filter(
      (im) => !primaryImHandles.has(`${im.protocol}:${im.handle}`.toLowerCase())
    );
    const addressesToTransfer = secondary.addresses.filter((a) => {
      const key = [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country]
        .map((v) => (v ?? '').toLowerCase().trim())
        .join('|');
      return !primaryAddresses.has(key);
    });
    const locationsToTransfer = secondary.locations.filter(
      (l) => !primaryLocations.has(`${l.latitude},${l.longitude}`)
    );
    const customFieldsToTransfer = secondary.customFields.filter(
      (f) => !primaryCustomFields.has(`${f.key}:${f.value}`)
    );
    const importantDatesToTransfer = secondary.importantDates.filter((d) => {
      const key = `${d.title}:${d.date instanceof Date ? d.date.toISOString() : d.date}`;
      return !primaryImportantDates.has(key);
    });

    // Relationships FROM the secondary: re-parent to primary.
    // Skip only if it would create a self-reference (secondary -> primary).
    const relsFromToTransfer = secondary.relationshipsFrom.filter((r) => {
      if (r.relatedPersonId === primaryId) return false; // would be self-referential
      return true;
    });

    // Relationships TO the secondary: re-parent to primary.
    // Skip only if it would create a self-reference (primary -> primary).
    const relsToToTransfer = secondary.relationshipsTo.filter((r) => {
      if (r.personId === primaryId) return false; // would be self-referential
      return true;
    });

    // IDs of relationships that will be transferred
    const transferredRelIds = new Set([
      ...relsFromToTransfer.map((r) => r.id),
      ...relsToToTransfer.map((r) => r.id),
    ]);

    // Leftover relationship IDs (self-refs that won't be transferred)
    const leftoverRelIds = [
      ...secondary.relationshipsFrom.map((r) => r.id),
      ...secondary.relationshipsTo.map((r) => r.id),
    ].filter((id) => !transferredRelIds.has(id));

    // Run everything in a single transaction
    const raceMappingInfo = await prisma.$transaction(async (tx): Promise<CardDavMappingInfo | null> => {
      // (a) Apply scalar field overrides to the primary contact
      if (Object.keys(scalarUpdates).length > 0) {
        await tx.person.update({
          where: { id: primaryId },
          data: scalarUpdates,
        });
      }

      // (b) Re-parent multi-value fields from secondary to primary

      // Phone numbers (only non-duplicates)
      if (phonesToTransfer.length > 0) {
        await tx.personPhone.updateMany({
          where: { id: { in: phonesToTransfer.map((p) => p.id) } },
          data: { personId: primaryId },
        });
      }

      // Emails (only non-duplicates)
      if (emailsToTransfer.length > 0) {
        await tx.personEmail.updateMany({
          where: { id: { in: emailsToTransfer.map((e) => e.id) } },
          data: { personId: primaryId },
        });
      }

      // Addresses (only non-duplicates)
      if (addressesToTransfer.length > 0) {
        await tx.personAddress.updateMany({
          where: { id: { in: addressesToTransfer.map((a) => a.id) } },
          data: { personId: primaryId },
        });
      }

      // URLs (only non-duplicates)
      if (urlsToTransfer.length > 0) {
        await tx.personUrl.updateMany({
          where: { id: { in: urlsToTransfer.map((u) => u.id) } },
          data: { personId: primaryId },
        });
      }

      // IM handles (only non-duplicates)
      if (imHandlesToTransfer.length > 0) {
        await tx.personIM.updateMany({
          where: { id: { in: imHandlesToTransfer.map((im) => im.id) } },
          data: { personId: primaryId },
        });
      }

      // Locations (only non-duplicates)
      if (locationsToTransfer.length > 0) {
        await tx.personLocation.updateMany({
          where: { id: { in: locationsToTransfer.map((l) => l.id) } },
          data: { personId: primaryId },
        });
      }

      // Custom fields (only non-duplicates)
      if (customFieldsToTransfer.length > 0) {
        await tx.personCustomField.updateMany({
          where: { id: { in: customFieldsToTransfer.map((f) => f.id) } },
          data: { personId: primaryId },
        });
      }

      // Important dates (only non-duplicates)
      if (importantDatesToTransfer.length > 0) {
        await tx.importantDate.updateMany({
          where: { id: { in: importantDatesToTransfer.map((d) => d.id) } },
          data: { personId: primaryId },
        });
      }

      // (c) Transfer groups (secondary's groups the primary doesn't have)
      if (newGroupIds.length > 0) {
        await tx.personGroup.createMany({
          data: newGroupIds.map((groupId) => ({
            personId: primaryId,
            groupId,
          })),
        });
      }

      // (d) Transfer relationships

      // Re-parent relationshipsFrom (personId = secondary -> personId = primary)
      if (relsFromToTransfer.length > 0) {
        await tx.relationship.updateMany({
          where: { id: { in: relsFromToTransfer.map((r) => r.id) } },
          data: { personId: primaryId },
        });
      }

      // Re-parent relationshipsTo (relatedPersonId = secondary -> relatedPersonId = primary)
      if (relsToToTransfer.length > 0) {
        await tx.relationship.updateMany({
          where: { id: { in: relsToToTransfer.map((r) => r.id) } },
          data: { relatedPersonId: primaryId },
        });
      }

      // (e) Delete secondary's CardDAV mapping.
      // Re-check inside transaction to catch mappings created by auto-export
      // between our initial fetch and this transaction (race condition).
      let foundRaceMapping: CardDavMappingInfo | null = null;
      if (!secondary.cardDavMapping) {
        const freshMapping = await tx.cardDavMapping.findUnique({
          where: { personId: secondaryId },
        });
        if (freshMapping) {
          foundRaceMapping = {
            href: freshMapping.href,
            etag: freshMapping.etag,
            connectionId: freshMapping.connectionId,
            uid: freshMapping.uid,
          };
        }
      }
      await tx.cardDavMapping.deleteMany({
        where: { personId: secondaryId },
      });

      // (f) Delete secondary's remaining group memberships and relationships
      await tx.personGroup.deleteMany({
        where: { personId: secondaryId },
      });

      // Soft-delete leftover relationships (self-refs that weren't transferred)
      if (leftoverRelIds.length > 0) {
        await tx.relationship.updateMany({
          where: { id: { in: leftoverRelIds } },
          data: { deletedAt: new Date() },
        });
      }

      // Delete remaining secondary multi-value records (duplicates that weren't transferred)
      await tx.personPhone.deleteMany({ where: { personId: secondaryId } });
      await tx.personEmail.deleteMany({ where: { personId: secondaryId } });
      await tx.personAddress.deleteMany({ where: { personId: secondaryId } });
      await tx.personUrl.deleteMany({ where: { personId: secondaryId } });
      await tx.personIM.deleteMany({ where: { personId: secondaryId } });
      await tx.personLocation.deleteMany({ where: { personId: secondaryId } });
      await tx.personCustomField.deleteMany({ where: { personId: secondaryId } });
      await tx.importantDate.deleteMany({ where: { personId: secondaryId } });

      // (g) Soft-delete the secondary contact
      await tx.person.update({
        where: { id: secondaryId },
        data: { deletedAt: new Date() },
      });

      return foundRaceMapping;
    });

    // Post-transaction: if auto-export created a mapping during our window,
    // clean up the orphaned vCard from the CardDAV server.
    if (raceMappingInfo) {
      try {
        const connection = await prisma.cardDavConnection.findUnique({
          where: { id: raceMappingInfo.connectionId },
        });
        if (connection) {
          const client = await createCardDavClient(connection);
          await withRetry(() => client.deleteVCard({
            url: raceMappingInfo.href,
            etag: raceMappingInfo.etag || '',
            data: '',
          }));
          log.info({ personId: secondaryId }, 'Cleaned up race-condition vCard from CardDAV server');
        }
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err : new Error(String(err)), personId: secondaryId },
          'Failed to clean up race-condition vCard from CardDAV server'
        );
      }
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
