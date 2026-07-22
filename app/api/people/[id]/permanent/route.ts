import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { deletePersonPhotos } from '@/lib/photo-storage';

// DELETE /api/people/[id]/permanent - Permanently delete a trashed person
export const DELETE = withAuth(async (_request, session, context) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { id } = await context.params;

    const person = await prismaWithDeleted.person.findUnique({
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
    await prismaWithDeleted.journalEntryPerson.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.duplicateDismissal.deleteMany({
      where: { OR: [{ personAId: id }, { personBId: id }] },
    });
    await prismaWithDeleted.cardDavMapping.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personCustomFieldValue.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personCustomField.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personLocation.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personIM.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personUrl.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personAddress.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personEmail.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.personPhone.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.importantDate.deleteMany({ where: { personId: id } });
    await prismaWithDeleted.relationship.deleteMany({
      where: { OR: [{ personId: id }, { relatedPersonId: id }] },
    });
    await prismaWithDeleted.personGroup.deleteMany({ where: { personId: id } });

    // Delete the person
    await prismaWithDeleted.person.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'people-permanent-delete');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
