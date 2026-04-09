import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getGoogleAuth } from './auth';
import { env } from '@/lib/env';
import { createModuleLogger } from '@/lib/logger';
import { downloadFileFromDrive } from './drive';

const logger = createModuleLogger('google-ocr');

const OCR_SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);

/**
 * Check if a file type supports OCR processing.
 */
export function isOcrSupported(mimeType: string): boolean {
  return OCR_SUPPORTED_MIME_TYPES.has(mimeType);
}

/**
 * Build metadata JSON for a processed document.
 */
export function extractMetadata(
  mimeType: string,
  fileSize: number | null,
  ocrText: string | null,
): Record<string, unknown> {
  return {
    mimeType,
    fileSize,
    hasText: !!ocrText && ocrText.length > 0,
    textLength: ocrText ? ocrText.length : 0,
    processedAt: new Date().toISOString(),
  };
}

/**
 * Process a single document for OCR using Google Cloud Vision API.
 * Downloads the file from Drive, sends it to the Vision API, and
 * updates the Document record with extracted text.
 */
export async function processDocumentOcr(
  userId: string,
  documentId: string,
): Promise<void> {
  // Check if Vision API is enabled
  if (!env.GOOGLE_VISION_ENABLED) {
    logger.info({ documentId }, 'Google Vision API disabled, skipping OCR');
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: 'skipped' },
    });
    return;
  }

  // Fetch the document record
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      integration: true,
    },
  });

  if (!document) {
    logger.warn({ documentId }, 'Document not found');
    return;
  }

  // Skip if already completed
  if (document.ocrStatus === 'completed') {
    logger.debug({ documentId }, 'OCR already completed, skipping');
    return;
  }

  // Check if file type supports OCR
  if (!isOcrSupported(document.mimeType)) {
    logger.info(
      { documentId, mimeType: document.mimeType },
      'File type does not support OCR, skipping',
    );
    await prisma.document.update({
      where: { id: documentId },
      data: {
        ocrStatus: 'skipped',
        metadata: extractMetadata(document.mimeType, document.fileSize, null),
      },
    });
    return;
  }

  // Mark as processing
  await prisma.document.update({
    where: { id: documentId },
    data: { ocrStatus: 'processing' },
  });

  try {
    // Get authenticated client
    const { auth } = await getGoogleAuth(userId);
    const drive = google.drive({ version: 'v3', auth });

    // Download file content from Drive
    const fileContent = await downloadFileFromDrive(drive, document.driveFileId);

    // Encode content as base64 for the Vision API
    const base64Content = fileContent.toString('base64');

    // Determine the appropriate detection feature
    const isPdf = document.mimeType === 'application/pdf';
    const featureType = isPdf ? 'DOCUMENT_TEXT_DETECTION' : 'TEXT_DETECTION';

    // Call the Vision API
    const vision = google.vision({ version: 'v1', auth });

    const annotateResponse = await vision.images.annotate({
      requestBody: {
        requests: [
          {
            image: {
              content: base64Content,
            },
            features: [
              {
                type: featureType,
              },
            ],
          },
        ],
      },
    });

    // Extract text from the response
    const responses = annotateResponse.data.responses;
    let ocrText: string | null = null;

    if (responses && responses.length > 0) {
      const annotation = responses[0];

      if (annotation.fullTextAnnotation) {
        ocrText = annotation.fullTextAnnotation.text ?? null;
      } else if (
        annotation.textAnnotations &&
        annotation.textAnnotations.length > 0
      ) {
        // Fallback: use the first text annotation (full text)
        ocrText = annotation.textAnnotations[0].description ?? null;
      }

      // Check for errors in the response
      if (annotation.error) {
        logger.error(
          {
            documentId,
            error: annotation.error.message,
            code: annotation.error.code,
          },
          'Vision API returned an error for document',
        );
        throw new Error(
          `Vision API error: ${annotation.error.message ?? 'Unknown error'}`,
        );
      }
    }

    // Update document with OCR results
    const metadata = extractMetadata(
      document.mimeType,
      document.fileSize,
      ocrText,
    );

    await prisma.document.update({
      where: { id: documentId },
      data: {
        ocrText,
        ocrStatus: 'completed',
        metadata,
      },
    });

    logger.info(
      {
        documentId,
        textLength: ocrText?.length ?? 0,
        featureType,
      },
      'OCR processing completed',
    );
  } catch (error) {
    logger.error({ error, documentId }, 'OCR processing failed');

    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: 'failed' },
    });
  }
}

/**
 * Process all pending OCR documents for a user.
 * Finds documents with ocrStatus="pending" and processes each one
 * with error isolation (a failure in one document does not block others).
 */
export async function processOcrQueue(
  userId: string,
): Promise<{ processed: number; failed: number }> {
  // Find the user's Google integration
  const integration = await prisma.googleIntegration.findUnique({
    where: { userId },
  });

  if (!integration) {
    logger.warn({ userId }, 'No Google integration found for user');
    return { processed: 0, failed: 0 };
  }

  // Find all pending documents for this integration
  const pendingDocuments = await prisma.document.findMany({
    where: {
      integrationId: integration.id,
      ocrStatus: 'pending',
    },
    select: { id: true },
  });

  if (pendingDocuments.length === 0) {
    logger.debug({ userId }, 'No pending OCR documents found');
    return { processed: 0, failed: 0 };
  }

  logger.info(
    { userId, count: pendingDocuments.length },
    'Processing OCR queue',
  );

  let processed = 0;
  let failed = 0;

  for (const doc of pendingDocuments) {
    try {
      await processDocumentOcr(userId, doc.id);
      processed++;
    } catch (error) {
      logger.error(
        { error, documentId: doc.id },
        'Failed to process document in OCR queue',
      );
      failed++;
    }
  }

  logger.info(
    { userId, processed, failed, total: pendingDocuments.length },
    'OCR queue processing complete',
  );

  return { processed, failed };
}
