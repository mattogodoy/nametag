import { prisma } from '@/lib/prisma';
import { mergePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { deleteFromCardDav } from '@/lib/carddav/delete-contact';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('merge');

// Full include for fetching a person with all relations
const personFullInclude = {
  groups: true,
  relationshipsFrom: true,
  relationshipsTo: true,
  phoneNumbers: true,
  emails: true,
  addresses: true,
  urls: true,
  imHandles: true,
  locations: true,
  customFields: true,
  importantDates: true,
  cardDavMapping: { include: { connection: true } },
} as const;

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
    // We do this before the transaction because deleteFromCardDav reads the
    // mapping from the database, which will be deleted during the transaction.
    if (secondary.cardDavMapping) {
      await deleteFromCardDav(secondaryId).catch((err) => {
        log.warn(
          { err: err instanceof Error ? err : new Error(String(err)), personId: secondaryId },
          'Failed to delete secondary contact from CardDAV server (proceeding with merge)'
        );
      });
    }

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

    // Collect the group IDs that the primary already has
    const primaryGroupIds = new Set(primary.groups.map((g) => g.groupId));

    // Groups from the secondary that the primary doesn't already belong to
    const newGroupIds = secondary.groups
      .filter((g) => !primaryGroupIds.has(g.groupId))
      .map((g) => g.groupId);

    // Collect existing phone numbers and emails on the primary for deduplication
    const primaryPhoneNumbers = new Set(primary.phoneNumbers.map((p) => p.number));
    const primaryEmails = new Set(primary.emails.map((e) => e.email.toLowerCase()));

    // Secondary phone numbers that aren't duplicates
    const phonesToTransfer = secondary.phoneNumbers.filter(
      (p) => !primaryPhoneNumbers.has(p.number)
    );

    // Secondary emails that aren't duplicates
    const emailsToTransfer = secondary.emails.filter(
      (e) => !primaryEmails.has(e.email.toLowerCase())
    );

    // Build the set of people the primary already has relationships with (both directions)
    const primaryRelatedPersonIds = new Set<string>();
    for (const r of primary.relationshipsFrom) {
      primaryRelatedPersonIds.add(r.relatedPersonId);
    }
    for (const r of primary.relationshipsTo) {
      primaryRelatedPersonIds.add(r.personId);
    }

    // Relationships FROM the secondary: re-parent to primary.
    // Skip if it would create a self-reference (secondary -> primary)
    // or if primary already has a relationship with that person.
    const relsFromToTransfer = secondary.relationshipsFrom.filter((r) => {
      if (r.relatedPersonId === primaryId) return false; // would be self-referential
      if (primaryRelatedPersonIds.has(r.relatedPersonId)) return false; // primary already related
      return true;
    });

    // Relationships TO the secondary: re-parent to primary.
    // Skip if it would create a self-reference (primary -> primary)
    // or if primary already has a relationship with that person.
    const relsToToTransfer = secondary.relationshipsTo.filter((r) => {
      if (r.personId === primaryId) return false; // would be self-referential
      if (primaryRelatedPersonIds.has(r.personId)) return false; // primary already related
      return true;
    });

    // Run everything in a single transaction
    await prisma.$transaction(async (tx) => {
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

      // Addresses - transfer all
      if (secondary.addresses.length > 0) {
        await tx.personAddress.updateMany({
          where: { personId: secondaryId },
          data: { personId: primaryId },
        });
      }

      // URLs - transfer all
      if (secondary.urls.length > 0) {
        await tx.personUrl.updateMany({
          where: { personId: secondaryId },
          data: { personId: primaryId },
        });
      }

      // IM handles - transfer all
      if (secondary.imHandles.length > 0) {
        await tx.personIM.updateMany({
          where: { personId: secondaryId },
          data: { personId: primaryId },
        });
      }

      // Locations - transfer all
      if (secondary.locations.length > 0) {
        await tx.personLocation.updateMany({
          where: { personId: secondaryId },
          data: { personId: primaryId },
        });
      }

      // Custom fields - transfer all
      if (secondary.customFields.length > 0) {
        await tx.personCustomField.updateMany({
          where: { personId: secondaryId },
          data: { personId: primaryId },
        });
      }

      // Important dates - transfer all
      if (secondary.importantDates.length > 0) {
        await tx.importantDate.updateMany({
          where: { personId: secondaryId },
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

      // (e) Delete secondary's CardDAV mapping if it has one
      if (secondary.cardDavMapping) {
        await tx.cardDavMapping.delete({
          where: { id: secondary.cardDavMapping.id },
        });
      }

      // (f) Delete secondary's remaining group memberships and relationships
      await tx.personGroup.deleteMany({
        where: { personId: secondaryId },
      });

      // Delete remaining relationships (ones that weren't transferred - duplicates and self-refs)
      await tx.relationship.deleteMany({
        where: {
          OR: [
            { personId: secondaryId },
            { relatedPersonId: secondaryId },
          ],
        },
      });

      // Delete duplicate phone numbers and emails that weren't transferred
      await tx.personPhone.deleteMany({
        where: { personId: secondaryId },
      });
      await tx.personEmail.deleteMany({
        where: { personId: secondaryId },
      });

      // (g) Soft-delete the secondary contact
      await tx.person.update({
        where: { id: secondaryId },
        data: { deletedAt: new Date() },
      });
    });

    log.info(
      { primaryId, secondaryId, userId: session.user.id },
      'Successfully merged contacts'
    );

    return apiResponse.ok({ mergedInto: primaryId });
  } catch (error) {
    return handleApiError(error, 'people-merge');
  }
});
