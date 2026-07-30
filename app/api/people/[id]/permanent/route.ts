import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { deletePersonPhotos } from '@/lib/photo-storage';

// DELETE /api/people/[id]/permanent - Permanently delete a trashed person
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const person = await prismaIncludingDeleted.person.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    if (!person.deletedAt) {
      return apiResponse.error('Person is not deleted');
    }

    // Delete photo files
    await deletePersonPhotos(session.user.id, id);

    // Delete child records in FK order
    await prismaIncludingDeleted.journalEntryPerson.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.duplicateDismissal.deleteMany({
      where: { OR: [{ personAId: id }, { personBId: id }] },
    });
    await prismaIncludingDeleted.cardDavMapping.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personCustomFieldValue.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personCustomField.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personLocation.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personIM.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personUrl.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personAddress.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personEmail.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.personPhone.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.importantDate.deleteMany({ where: { personId: id } });
    await prismaIncludingDeleted.relationship.deleteMany({
      where: { OR: [{ personId: id }, { relatedPersonId: id }] },
    });
    await prismaIncludingDeleted.personGroup.deleteMany({ where: { personId: id } });

    // Delete the person
    await prismaIncludingDeleted.person.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'people-permanent-delete');
  }
});
