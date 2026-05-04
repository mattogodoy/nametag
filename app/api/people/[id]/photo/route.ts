import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { savePhotoFromBuffer, deletePersonPhotos } from '@/lib/photo-storage';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('people-photo');

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/people/[id]/photo - Upload a person's photo
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiResponse.error('Invalid form data');
    }

    const file = formData.get('photo');
    if (!file || typeof file === 'string') {
      return apiResponse.error('No photo file provided');
    }

    // Check file size before reading full buffer
    if (file.size > MAX_UPLOAD_SIZE) {
      return apiResponse.error(`Photo exceeds maximum size of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
    }

    // Verify person exists and is owned by user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process, validate, and save photo
    let filename: string;
    try {
      filename = await savePhotoFromBuffer(session.user.id, id, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process photo';
      return apiResponse.error(message);
    }

    // Update person record
    await prisma.person.update({
      where: { id },
      data: { photo: filename },
    });

    log.info({ personId: id, filename }, 'Photo uploaded');

    return apiResponse.ok({ photo: filename });
  } catch (error) {
    return handleApiError(error, 'POST /api/people/[id]/photo');
  }
});

// DELETE /api/people/[id]/photo - Delete a person's photo
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Verify person exists and is owned by user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Delete photo files from disk
    await deletePersonPhotos(session.user.id, id);

    // Clear photo field
    await prisma.person.update({
      where: { id },
      data: { photo: null },
    });

    log.info({ personId: id }, 'Photo deleted');

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/people/[id]/photo');
  }
});
