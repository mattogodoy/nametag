import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getGoogleAuth } from './auth';
import { syncGmailForUser } from './gmail';
import { ensureRootFolder, ensureContactFolder, uploadFileToDrive } from './drive';
import { processOcrQueue } from './ocr';
import { createModuleLogger } from '@/lib/logger';
import { formatFullName } from '@/lib/nameUtils';

const log = createModuleLogger('google-sync');

export interface GmailSyncResult {
  newEmails: number;
  matchedToContacts: number;
  attachmentsProcessed: number;
  ocrProcessed: number;
  ocrFailed: number;
  errors: string[];
}

/**
 * Full sync pipeline for a single user:
 * 1. Sync Gmail (fetch new emails, match to contacts)
 * 2. Process email attachments (download from Gmail, upload to Drive)
 * 3. Run OCR on pending documents
 */
export async function fullSyncForUser(userId: string): Promise<GmailSyncResult> {
  const result: GmailSyncResult = {
    newEmails: 0,
    matchedToContacts: 0,
    attachmentsProcessed: 0,
    ocrProcessed: 0,
    ocrFailed: 0,
    errors: [],
  };

  try {
    // Step 1: Sync Gmail
    log.info({ userId }, 'Starting Gmail sync');
    const gmailResult = await syncGmailForUser(userId);
    result.newEmails = gmailResult.newEmails;
    result.matchedToContacts = gmailResult.matchedToContacts;
    result.errors.push(...gmailResult.errors);

    // Step 2: Process attachments for new emails that have them
    log.info({ userId }, 'Processing email attachments');
    const attachmentCount = await processNewAttachments(userId);
    result.attachmentsProcessed = attachmentCount;

    // Step 3: Run OCR queue
    log.info({ userId }, 'Processing OCR queue');
    const ocrResult = await processOcrQueue(userId);
    result.ocrProcessed = ocrResult.processed;
    result.ocrFailed = ocrResult.failed;

    log.info({ userId, ...result }, 'Full sync completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    log.error({ userId, error: message }, 'Full sync failed');
  }

  return result;
}

/**
 * Process attachments for emails that have them but haven't been processed yet.
 * Downloads attachments from Gmail and uploads them to Google Drive.
 */
async function processNewAttachments(userId: string): Promise<number> {
  const { auth, integration } = await getGoogleAuth(userId);

  if (!integration.driveSyncEnabled) {
    log.debug({ userId }, 'Drive sync not enabled, skipping attachment processing');
    return 0;
  }

  const gmail = google.gmail({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Find emails with attachments that don't have associated documents yet
  const emailsWithAttachments = await prisma.emailLog.findMany({
    where: {
      integrationId: integration.id,
      hasAttachments: true,
      documents: { none: {} },
    },
    include: {
      people: {
        include: {
          person: {
            select: {
              id: true,
              name: true,
              surname: true,
              middleName: true,
              secondLastName: true,
            },
          },
        },
      },
    },
    take: 50, // Process in batches to avoid timeouts
  });

  if (emailsWithAttachments.length === 0) {
    return 0;
  }

  // Ensure root folder exists
  const rootFolderId = await ensureRootFolder(drive, integration);
  let processedCount = 0;

  for (const emailLog of emailsWithAttachments) {
    try {
      // Fetch the full message to get attachment data
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: emailLog.gmailMessageId,
        format: 'full',
      });

      if (!message.data.payload) continue;

      const attachments = extractAttachmentParts(message.data.payload);

      for (const attachment of attachments) {
        try {
          if (!attachment.body?.attachmentId) continue;

          // Download attachment data
          const attachmentData = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: emailLog.gmailMessageId,
            id: attachment.body.attachmentId,
          });

          if (!attachmentData.data.data) continue;

          // Decode base64url data
          const buffer = Buffer.from(attachmentData.data.data, 'base64url');
          const fileName = attachment.filename || 'attachment';
          const mimeType = attachment.mimeType || 'application/octet-stream';

          // Determine which contact folder to use (first matched person, or a general folder)
          let folderId = rootFolderId;
          let personId: string | null = null;

          if (emailLog.people.length > 0) {
            const firstPerson = emailLog.people[0].person;
            personId = firstPerson.id;
            const contactName = formatFullName(firstPerson);
            folderId = await ensureContactFolder(drive, rootFolderId, contactName);
          }

          // Upload to Drive
          const { fileId, webViewLink } = await uploadFileToDrive(
            drive,
            folderId,
            fileName,
            mimeType,
            buffer,
          );

          // Create Document record
          await prisma.document.create({
            data: {
              integrationId: integration.id,
              personId,
              emailLogId: emailLog.id,
              driveFileId: fileId,
              driveFolderId: folderId,
              driveWebViewUrl: webViewLink,
              fileName,
              mimeType,
              fileSize: buffer.length,
              source: 'email_attachment',
              ocrStatus: 'pending',
            },
          });

          processedCount++;
        } catch (attachError) {
          const msg = attachError instanceof Error ? attachError.message : String(attachError);
          log.error(
            { userId, emailLogId: emailLog.id, fileName: attachment.filename, error: msg },
            'Failed to process attachment',
          );
        }
      }
    } catch (emailError) {
      const msg = emailError instanceof Error ? emailError.message : String(emailError);
      log.error(
        { userId, emailLogId: emailLog.id, error: msg },
        'Failed to process email attachments',
      );
    }
  }

  return processedCount;
}

/**
 * Recursively extract attachment parts from a Gmail message payload.
 */
function extractAttachmentParts(
  payload: { parts?: Array<{ filename?: string | null; mimeType?: string | null; body?: { attachmentId?: string | null; size?: number | null } | null; parts?: Array<unknown> }>; filename?: string | null; mimeType?: string | null; body?: { attachmentId?: string | null; size?: number | null } | null },
): Array<{ filename: string | null; mimeType: string | null; body: { attachmentId: string | null; size: number | null } | null }> {
  const attachments: Array<{ filename: string | null; mimeType: string | null; body: { attachmentId: string | null; size: number | null } | null }> = [];

  // Check current part
  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({
      filename: payload.filename,
      mimeType: payload.mimeType || null,
      body: payload.body ? { attachmentId: payload.body.attachmentId || null, size: payload.body.size || null } : null,
    });
  }

  // Recurse into sub-parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const subPart = part as typeof payload;
      attachments.push(...extractAttachmentParts(subPart));
    }
  }

  return attachments;
}

/**
 * Upload a file manually to Google Drive and create a Document record.
 * Used for user-initiated uploads (not from email).
 */
export async function uploadDocumentForPerson(
  userId: string,
  personId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<{ documentId: string; driveWebViewUrl: string | null }> {
  const { auth, integration } = await getGoogleAuth(userId);
  const drive = google.drive({ version: 'v3', auth });

  // Get person name for folder
  const person = await prisma.person.findUnique({
    where: { id: personId, userId, deletedAt: null },
    select: { id: true, name: true, surname: true, middleName: true, secondLastName: true },
  });

  if (!person) {
    throw new Error('Person not found');
  }

  // Ensure folder structure
  const rootFolderId = await ensureRootFolder(drive, integration);
  const contactName = formatFullName(person);
  const folderId = await ensureContactFolder(drive, rootFolderId, contactName);

  // Upload
  const { fileId, webViewLink } = await uploadFileToDrive(drive, folderId, fileName, mimeType, data);

  // Create Document record
  const document = await prisma.document.create({
    data: {
      integrationId: integration.id,
      personId,
      driveFileId: fileId,
      driveFolderId: folderId,
      driveWebViewUrl: webViewLink,
      fileName,
      mimeType,
      fileSize: data.length,
      source: 'manual_upload',
      ocrStatus: 'pending',
    },
  });

  return { documentId: document.id, driveWebViewUrl: webViewLink };
}
