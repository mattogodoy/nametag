import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { savePhotoFromBuffer, deletePersonPhotos } from '@/lib/photo-storage';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('user-photo');

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const USER_PHOTO_ID = '_avatar';

// POST /api/user/photo - Upload the logged-in user's photo
export const POST = withAuth(async (request, session) => {
  try {
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

    if (file.size > MAX_UPLOAD_SIZE) {
      return apiResponse.error(`Photo exceeds maximum size of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let filename: string;
    try {
      filename = await savePhotoFromBuffer(session.user.id, USER_PHOTO_ID, buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process photo';
      return apiResponse.error(message);
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { photo: filename },
    });

    log.info({ userId: session.user.id, filename }, 'User photo uploaded');

    return apiResponse.ok({ photo: filename });
  } catch (error) {
    return handleApiError(error, 'POST /api/user/photo');
  }
});

// DELETE /api/user/photo - Delete the logged-in user's photo
export const DELETE = withAuth(async (_request, session) => {
  try {
    await deletePersonPhotos(session.user.id, USER_PHOTO_ID);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { photo: null },
    });

    log.info({ userId: session.user.id }, 'User photo deleted');

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/user/photo');
  }
});
