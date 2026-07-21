import sharp from 'sharp';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { isHeicBuffer } from '@/lib/photo-storage';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('photos-convert');

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
const SHARP_MAX_INPUT_PIXELS = 100 * 1024 * 1024;

function getJpegQuality(): number {
  return Number(process.env.PHOTO_QUALITY) || 80;
}

export const POST = withAuth(async (request) => {
  try {
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

    if (!isHeicBuffer(buffer)) {
      return apiResponse.error('File is not HEIC/HEIF format. Only HEIC files need conversion.');
    }

    const jpegBuffer = await sharp(buffer, { limitInputPixels: SHARP_MAX_INPUT_PIXELS })
      .rotate()
      .jpeg({ quality: getJpegQuality() })
      .toBuffer();

    log.info('Converted HEIC to JPEG');

    return new Response(new Uint8Array(jpegBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(jpegBuffer.length),
      },
    });
  } catch (error) {
    return handleApiError(error, 'POST /api/photos/convert');
  }
});
