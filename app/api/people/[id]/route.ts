import { prisma } from '@/lib/prisma';
import { findPersonWithDetails } from '@/lib/prisma-queries';
import { updatePerson, deletePerson } from '@/lib/services/person';
import { updatePersonSchema, deletePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canEnableReminder } from '@/lib/billing';
import { autoExportPerson } from '@/lib/carddav/auto-export';
import { deleteFromCardDav as deleteContactFromCardDav } from '@/lib/carddav/delete-contact';
import { savePhoto, deletePersonPhotos, isPhotoFilename } from '@/lib/photo-storage';
import { createModuleLogger } from '@/lib/logger';
import { applyCustomFieldValues, CustomFieldValidationError } from '@/lib/customFields/persistence';

const log = createModuleLogger('people');

// GET /api/people/[id] - Get a single person
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const person = await findPersonWithDetails(id, session.user.id);

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    return apiResponse.ok({ person });
  } catch (error) {
    return handleApiError(error, 'people-get');
  }
});

// PUT /api/people/[id] - Update a person
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    const body = await parseRequestBody(request);
    const validation = validateRequest(updatePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const {
      photo,
      importantDates,
      contactReminderEnabled,
      cardDavSyncEnabled,
    } = validation.data;

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existingPerson) {
      return apiResponse.notFound('Person not found');
    }

    // Check reminder limits if adding new reminders
    // Get current reminders for this person
    const currentPersonReminders = await prisma.importantDate.count({
      where: { personId: id, reminderEnabled: true, deletedAt: null },
    });
    const currentContactReminder = existingPerson.contactReminderEnabled ? 1 : 0;

    // Calculate new reminders after update
    const newContactReminder = contactReminderEnabled ? 1 : 0;
    const newImportantDateReminders = importantDates?.filter((d) => d.reminderEnabled).length ?? 0;

    // Net change in reminders for this person
    const currentTotal = currentPersonReminders + currentContactReminder;
    const newTotal = newImportantDateReminders + newContactReminder;
    const netChange = newTotal - currentTotal;

    if (netChange > 0) {
      const reminderCheck = await canEnableReminder(session.user.id);
      if (!reminderCheck.isUnlimited) {
        const remainingSlots = reminderCheck.limit - reminderCheck.current;
        if (netChange > remainingSlots) {
          return apiResponse.forbidden(
            `You can only add ${remainingSlots} more reminder(s) on your current plan ` +
            `(limit: ${reminderCheck.limit}). Please upgrade your plan to add more.`
          );
        }
      }
    }

    // Resolve photo field: convert data URI / URL to a stored filename before passing
    // to the service so the DB always contains a filename, never raw image data.
    let resolvedPhoto = photo;
    if (photo !== undefined) {
      if (photo === null || photo === '') {
        // Photo being removed — delete old file
        if (existingPerson.photo && isPhotoFilename(existingPerson.photo)) {
          deletePersonPhotos(session.user.id, id).catch((err) =>
            log.error({ err: err instanceof Error ? err : new Error(String(err)), personId: id }, 'Failed to delete old photo')
          );
        }
        resolvedPhoto = null;
      } else if (photo.startsWith('data:') || photo.startsWith('http://') || photo.startsWith('https://')) {
        // New photo data — save as file
        const photoFilename = await savePhoto(session.user.id, id, photo);
        resolvedPhoto = photoFilename || photo;
      }
      // Otherwise already a filename — keep as-is
    }

    // Apply custom field values BEFORE calling updatePerson so that autoUpdatePerson
    // (which fires inside the service as a background task) reads the fresh values
    // and the exported vCard is complete.
    if (validation.data.customFieldValues !== undefined) {
      try {
        await applyCustomFieldValues(prisma, session.user.id, id, validation.data.customFieldValues);
      } catch (err) {
        if (err instanceof CustomFieldValidationError) {
          return apiResponse.error(err.message);
        }
        throw err;
      }
    }

    // Delegate the DB write (and CardDAV normal-update path) to the service.
    // The service calls autoUpdatePerson when sync is not disabled.
    const serviceData = resolvedPhoto !== photo
      ? { ...validation.data, photo: resolvedPhoto }
      : validation.data;

    const person = await updatePerson(id, session.user.id, serviceData);

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // CardDAV sync logic for toggle state changes not handled by the service:
    if (cardDavSyncEnabled === false && existingPerson.cardDavSyncEnabled === true) {
      // Un-sync: delete from CardDAV server, then remove mapping only if remote delete succeeded
      // Must be sequential — deleteContactFromCardDav reads the mapping to find the server URL
      deleteContactFromCardDav(id)
        .then((deleted) => {
          if (deleted) {
            return prisma.cardDavMapping.deleteMany({ where: { personId: id } });
          }
          log.warn({ personId: id }, 'Remote delete failed, keeping local mapping for reconciliation');
        })
        .catch((error) => {
          log.error({ err: error instanceof Error ? error : new Error(String(error)), personId: id }, 'Failed to delete from CardDAV during un-sync');
        });
    } else if (cardDavSyncEnabled === true && existingPerson.cardDavSyncEnabled !== true) {
      // Re-sync: do a full export to server instead of the normal update
      autoExportPerson(id).catch((error) => {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), personId: id }, 'Auto-export after sync enable failed');
      });
    }
    // Normal update path: the service already called autoUpdatePerson

    return apiResponse.ok({ person });
  } catch (error) {
    return handleApiError(error, 'people-update');
  }
});

// DELETE /api/people/[id] - Delete a person
export const DELETE = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    // Parse request body to check if we should also delete orphans / delete from CardDAV
    const body = await parseRequestBody(request).catch(() => ({}));
    const validation = validateRequest(deletePersonSchema, body);

    // Use validated data, or defaults if body was empty/invalid
    const { deleteOrphans, orphanIds, deleteFromCardDav } = validation.success
      ? validation.data
      : { deleteOrphans: false, orphanIds: [], deleteFromCardDav: false };

    // If requested, delete from CardDAV server before soft-deleting locally
    if (deleteFromCardDav) {
      await deleteContactFromCardDav(id).catch((error) => {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), personId: id }, 'Failed to delete from CardDAV server');
        // Continue with local deletion even if CardDAV delete fails
      });
    }

    // Soft-delete the person (also cleans up CardDAV mapping)
    const deletedId = await deletePerson(id, session.user.id);

    if (!deletedId) {
      return apiResponse.notFound('Person not found');
    }

    // If requested, also soft delete the orphans
    if (deleteOrphans && orphanIds && Array.isArray(orphanIds)) {
      await prisma.person.updateMany({
        where: {
          id: {
            in: orphanIds,
          },
          userId: session.user.id, // Ensure they belong to the user
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    return apiResponse.message('Person deleted successfully');
  } catch (error) {
    return handleApiError(error, 'people-delete');
  }
});
