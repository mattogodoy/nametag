import { google, drive_v3 } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getGoogleAuth } from './auth';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('google-drive');

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/**
 * Find a folder by name under a given parent folder.
 */
export async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string | null> {
  try {
    const response = await drive.files.list({
      q: `mimeType = '${FOLDER_MIME_TYPE}' and name = '${name}' and '${parentId}' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = response.data.files;
    if (files && files.length > 0) {
      return files[0].id ?? null;
    }

    return null;
  } catch (error) {
    logger.error({ error, name, parentId }, 'Failed to find folder');
    throw error;
  }
}

/**
 * Create a new folder under a given parent folder.
 */
export async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  try {
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: FOLDER_MIME_TYPE,
        parents: [parentId],
      },
      fields: 'id',
    });

    const folderId = response.data.id;
    if (!folderId) {
      throw new Error('Drive API returned no folder ID after creation');
    }

    logger.info({ name, parentId, folderId }, 'Created folder');
    return folderId;
  } catch (error) {
    logger.error({ error, name, parentId }, 'Failed to create folder');
    throw error;
  }
}

/**
 * Ensure the root "Nametag" folder exists in the user's Google Drive.
 * If the integration already has a driveRootFolderId, verify it still exists.
 * Otherwise, search for or create it.
 * Saves the folder ID to the integration record and returns it.
 */
export async function ensureRootFolder(
  drive: drive_v3.Drive,
  integration: { id: string; driveRootFolderId: string | null },
): Promise<string> {
  const folderName = 'Nametag';

  // If we already have a root folder ID, verify it still exists
  if (integration.driveRootFolderId) {
    try {
      const existing = await drive.files.get({
        fileId: integration.driveRootFolderId,
        fields: 'id, trashed',
      });

      if (existing.data.id && !existing.data.trashed) {
        logger.debug(
          { folderId: integration.driveRootFolderId },
          'Root folder verified',
        );
        return integration.driveRootFolderId;
      }
    } catch (error) {
      logger.warn(
        { error, folderId: integration.driveRootFolderId },
        'Stored root folder not found, will search or create',
      );
    }
  }

  // Search for an existing "Nametag" folder in root
  try {
    const searchResponse = await drive.files.list({
      q: `mimeType = '${FOLDER_MIME_TYPE}' and name = '${folderName}' and 'root' in parents and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = searchResponse.data.files;
    if (files && files.length > 0 && files[0].id) {
      const folderId = files[0].id;
      logger.info({ folderId }, 'Found existing root folder');

      await prisma.googleIntegration.update({
        where: { id: integration.id },
        data: { driveRootFolderId: folderId },
      });

      return folderId;
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to search for root folder, will create');
  }

  // Create the root folder
  const createResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: FOLDER_MIME_TYPE,
    },
    fields: 'id',
  });

  const folderId = createResponse.data.id;
  if (!folderId) {
    throw new Error('Drive API returned no folder ID when creating root folder');
  }

  logger.info({ folderId }, 'Created root folder');

  await prisma.googleIntegration.update({
    where: { id: integration.id },
    data: { driveRootFolderId: folderId },
  });

  return folderId;
}

/**
 * Ensure the folder structure `Nametag/Contacts/{contactName}/` exists.
 * Returns the contact-specific folder ID.
 */
export async function ensureContactFolder(
  drive: drive_v3.Drive,
  rootFolderId: string,
  contactName: string,
): Promise<string> {
  // Ensure "Contacts" subfolder exists under root
  let contactsFolderId = await findFolder(drive, 'Contacts', rootFolderId);
  if (!contactsFolderId) {
    contactsFolderId = await createFolder(drive, 'Contacts', rootFolderId);
    logger.info({ contactsFolderId }, 'Created "Contacts" subfolder');
  }

  // Ensure contact name subfolder exists under "Contacts"
  let contactFolderId = await findFolder(drive, contactName, contactsFolderId);
  if (!contactFolderId) {
    contactFolderId = await createFolder(drive, contactName, contactsFolderId);
    logger.info(
      { contactFolderId, contactName },
      'Created contact subfolder',
    );
  }

  return contactFolderId;
}

/**
 * Upload a file to Google Drive in the specified folder.
 * Returns the file ID and web view link.
 */
export async function uploadFileToDrive(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<{ fileId: string; webViewLink: string | null }> {
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: data,
      },
      fields: 'id, webViewLink',
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('Drive API returned no file ID after upload');
    }

    const webViewLink = response.data.webViewLink ?? null;

    logger.info(
      { fileId, fileName, folderId, mimeType },
      'Uploaded file to Drive',
    );

    return { fileId, webViewLink };
  } catch (error) {
    logger.error(
      { error, fileName, folderId, mimeType },
      'Failed to upload file to Drive',
    );
    throw error;
  }
}

/**
 * Download file content from Google Drive.
 * Returns the file data as a Buffer.
 */
export async function downloadFileFromDrive(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<Buffer> {
  try {
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      },
    );

    logger.debug({ fileId }, 'Downloaded file from Drive');
    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to download file from Drive');
    throw error;
  }
}

/**
 * Delete a file from Google Drive.
 */
export async function deleteFileFromDrive(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<void> {
  try {
    await drive.files.delete({ fileId });
    logger.info({ fileId }, 'Deleted file from Drive');
  } catch (error) {
    logger.error({ error, fileId }, 'Failed to delete file from Drive');
    throw error;
  }
}

/**
 * Get an authenticated Google Drive client for a user.
 * Convenience wrapper that obtains auth and builds the Drive client.
 */
export async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  const { auth } = await getGoogleAuth(userId);
  return google.drive({ version: 'v3', auth });
}
