import { google, gmail_v1 } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { getGoogleAuth } from './auth';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('gmail');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncResult {
  newEmails: number;
  matchedToContacts: number;
  errors: string[];
}

interface ParsedEmailAddress {
  name: string | null;
  email: string;
}

interface AttachmentInfo {
  attachmentId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface ProcessMessageResult {
  emailLog: {
    id: string;
    gmailMessageId: string;
    subject: string | null;
  };
  hasAttachments: boolean;
}

// ---------------------------------------------------------------------------
// 1. Main entry point
// ---------------------------------------------------------------------------

/**
 * Sync Gmail messages for a user. Performs an initial sync (last 30 days) if
 * no historyId exists, otherwise does an incremental sync via history.list.
 */
export async function syncGmailForUser(userId: string): Promise<SyncResult> {
  log.info({ userId }, 'Starting Gmail sync');

  const integration = await prisma.googleIntegration.findUnique({
    where: { userId },
  });

  if (!integration) {
    log.warn({ userId }, 'No Google integration found');
    return { newEmails: 0, matchedToContacts: 0, errors: ['No Google integration configured'] };
  }

  if (!integration.gmailSyncEnabled) {
    log.info({ userId }, 'Gmail sync is disabled for this user');
    return { newEmails: 0, matchedToContacts: 0, errors: ['Gmail sync is disabled'] };
  }

  const { auth } = await getGoogleAuth(userId);
  const gmail = google.gmail({ version: 'v1', auth });

  let result: SyncResult;

  if (!integration.gmailHistoryId) {
    log.info({ userId }, 'No historyId found — performing initial sync');
    result = await initialGmailSync(userId, integration.id, gmail);
  } else {
    log.info({ userId, historyId: integration.gmailHistoryId }, 'Performing incremental sync');
    result = await incrementalGmailSync(userId, integration.id, gmail, integration.gmailHistoryId);
  }

  // Update last sync timestamp
  await prisma.googleIntegration.update({
    where: { id: integration.id },
    data: {
      lastGmailSyncAt: new Date(),
      lastError: null,
      lastErrorAt: null,
    },
  });

  log.info(
    { userId, newEmails: result.newEmails, matchedToContacts: result.matchedToContacts, errorCount: result.errors.length },
    'Gmail sync completed',
  );

  return result;
}

// ---------------------------------------------------------------------------
// 2. Initial sync (last 30 days)
// ---------------------------------------------------------------------------

/**
 * First-time sync: fetch messages from the last 30 days and process them.
 * Handles pagination to retrieve up to 500 messages.
 */
async function initialGmailSync(
  userId: string,
  integrationId: string,
  gmail: gmail_v1.Gmail,
): Promise<SyncResult> {
  const result: SyncResult = { newEmails: 0, matchedToContacts: 0, errors: [] };

  let pageToken: string | undefined;
  let totalFetched = 0;
  const maxResults = 500;

  try {
    do {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: 'newer_than:30d',
        maxResults: Math.min(maxResults - totalFetched, 100),
        pageToken,
      });

      const messages = listResponse.data.messages || [];
      totalFetched += messages.length;

      log.info({ count: messages.length, totalFetched }, 'Fetched message list page');

      for (const msg of messages) {
        if (!msg.id) continue;

        try {
          const processed = await processMessage(userId, integrationId, gmail, msg.id);
          if (processed) {
            result.newEmails++;
            // Count will be tallied after processing via the returned EmailLogPerson records
          }
        } catch (err) {
          const errorMsg = `Failed to process message ${msg.id}: ${err instanceof Error ? err.message : String(err)}`;
          log.error({ messageId: msg.id, err }, 'Error processing message during initial sync');
          result.errors.push(errorMsg);
        }
      }

      pageToken = listResponse.data.nextPageToken ?? undefined;
    } while (pageToken && totalFetched < maxResults);

    // Save current historyId from profile for future incremental syncs
    const profile = await gmail.users.getProfile({ userId: 'me' });
    if (profile.data.historyId) {
      await prisma.googleIntegration.update({
        where: { id: integrationId },
        data: { gmailHistoryId: profile.data.historyId },
      });
      log.info({ historyId: profile.data.historyId }, 'Saved initial historyId');
    }
  } catch (err) {
    const errorMsg = `Initial sync failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, 'Initial Gmail sync failed');
    result.errors.push(errorMsg);

    await prisma.googleIntegration.update({
      where: { id: integrationId },
      data: { lastError: errorMsg, lastErrorAt: new Date() },
    });
  }

  // Count matched contacts
  result.matchedToContacts = await countMatchedContacts(integrationId);

  return result;
}

// ---------------------------------------------------------------------------
// 3. Incremental sync (via history.list)
// ---------------------------------------------------------------------------

/**
 * Incremental sync using Gmail history API. Only processes messages added
 * since the last known historyId.
 */
async function incrementalGmailSync(
  userId: string,
  integrationId: string,
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
): Promise<SyncResult> {
  const result: SyncResult = { newEmails: 0, matchedToContacts: 0, errors: [] };

  try {
    let pageToken: string | undefined;
    const processedIds = new Set<string>();

    do {
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });

      const historyRecords = historyResponse.data.history || [];

      for (const record of historyRecords) {
        const addedMessages = record.messagesAdded || [];
        for (const added of addedMessages) {
          const messageId = added.message?.id;
          if (!messageId || processedIds.has(messageId)) continue;
          processedIds.add(messageId);

          try {
            const processed = await processMessage(userId, integrationId, gmail, messageId);
            if (processed) {
              result.newEmails++;
            }
          } catch (err) {
            const errorMsg = `Failed to process message ${messageId}: ${err instanceof Error ? err.message : String(err)}`;
            log.error({ messageId, err }, 'Error processing message during incremental sync');
            result.errors.push(errorMsg);
          }
        }
      }

      // Save the new historyId after each page for crash resilience
      const newHistoryId = historyResponse.data.historyId;
      if (newHistoryId) {
        await prisma.googleIntegration.update({
          where: { id: integrationId },
          data: { gmailHistoryId: newHistoryId },
        });
      }

      pageToken = historyResponse.data.nextPageToken ?? undefined;
    } while (pageToken);

    log.info({ processedCount: processedIds.size }, 'Incremental sync processed messages');
  } catch (err: unknown) {
    // If historyId is too old, Gmail returns 404. Fall back to initial sync.
    const isHistoryExpired =
      err instanceof Error &&
      ('code' in err && (err as { code: number }).code === 404);

    if (isHistoryExpired) {
      log.warn({ startHistoryId }, 'History expired (404) — falling back to initial sync');
      await prisma.googleIntegration.update({
        where: { id: integrationId },
        data: { gmailHistoryId: null },
      });
      return initialGmailSync(userId, integrationId, gmail);
    }

    const errorMsg = `Incremental sync failed: ${err instanceof Error ? err.message : String(err)}`;
    log.error({ err }, 'Incremental Gmail sync failed');
    result.errors.push(errorMsg);

    await prisma.googleIntegration.update({
      where: { id: integrationId },
      data: { lastError: errorMsg, lastErrorAt: new Date() },
    });
  }

  // Count matched contacts
  result.matchedToContacts = await countMatchedContacts(integrationId);

  return result;
}

// ---------------------------------------------------------------------------
// 4. Process a single message
// ---------------------------------------------------------------------------

/**
 * Fetch, parse, and store a single Gmail message. Deduplicates by
 * gmailMessageId. Matches participants to existing Person records.
 *
 * Returns null if the message already exists (dedup).
 */
async function processMessage(
  userId: string,
  integrationId: string,
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<ProcessMessageResult | null> {
  // Check for existing record (dedup)
  const existing = await prisma.emailLog.findUnique({
    where: {
      integrationId_gmailMessageId: {
        integrationId,
        gmailMessageId: messageId,
      },
    },
  });

  if (existing) {
    log.debug({ messageId }, 'Message already exists — skipping');
    return null;
  }

  // Fetch the full message
  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const message = response.data;
  const headers = message.payload?.headers || [];

  // Parse headers
  const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject');
  const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from');
  const toHeader = headers.find((h) => h.name?.toLowerCase() === 'to');
  const ccHeader = headers.find((h) => h.name?.toLowerCase() === 'cc');
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date');

  const subject = subjectHeader?.value ?? null;
  const from = fromHeader?.value ? parseEmailAddress(fromHeader.value) : { name: null, email: 'unknown' };
  const toAddresses = toHeader?.value ? parseAddressList(toHeader.value) : [];
  const ccAddresses = ccHeader?.value ? parseAddressList(ccHeader.value) : [];
  const date = dateHeader?.value ? new Date(dateHeader.value) : new Date();

  // Extract body
  const body = message.payload ? getPlainTextBody(message.payload) : null;

  // Check for attachments
  const attachments = message.payload ? getAttachmentInfo(message.payload) : [];
  const hasAttachments = attachments.length > 0;

  // Determine read state
  const labelIds = message.labelIds || [];
  const isRead = !labelIds.includes('UNREAD');

  // Create EmailLog record
  const emailLog = await prisma.emailLog.create({
    data: {
      integrationId,
      gmailMessageId: messageId,
      gmailThreadId: message.threadId || messageId,
      subject,
      snippet: message.snippet ?? null,
      body,
      fromEmail: from.email,
      fromName: from.name,
      toEmails: toAddresses.map((a) => a.email),
      ccEmails: ccAddresses.map((a) => a.email),
      date,
      labelIds,
      hasAttachments,
      isRead,
    },
  });

  log.debug({ emailLogId: emailLog.id, messageId, subject }, 'Created EmailLog record');

  // Match participants to Person records and create EmailLogPerson records
  await matchAndLinkParticipants(userId, emailLog.id, from, toAddresses, ccAddresses);

  return {
    emailLog: {
      id: emailLog.id,
      gmailMessageId: messageId,
      subject,
    },
    hasAttachments,
  };
}

// ---------------------------------------------------------------------------
// 5. Parse "Name <email>" format
// ---------------------------------------------------------------------------

/**
 * Parse an email address header value like "John Doe <john@example.com>"
 * or plain "john@example.com".
 */
export function parseEmailAddress(header: string): ParsedEmailAddress {
  const trimmed = header.trim();

  // Match "Name <email>" pattern
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, '').trim();
    return {
      name: name || null,
      email: match[2].trim().toLowerCase(),
    };
  }

  // Plain email address
  return {
    name: null,
    email: trimmed.toLowerCase(),
  };
}

/**
 * Parse a comma-separated list of email addresses.
 * Handles cases where names contain commas within quotes.
 */
function parseAddressList(header: string): ParsedEmailAddress[] {
  const results: ParsedEmailAddress[] = [];
  // Split on commas that are not inside angle brackets or quotes
  const parts = header.match(/(?:[^,"<]*(?:"[^"]*")?[^,"<]*(?:<[^>]*>)?)+/g);

  if (!parts) return [parseEmailAddress(header)];

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      results.push(parseEmailAddress(trimmed));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 6. Match email to Person records
// ---------------------------------------------------------------------------

/**
 * Find Person records that match a given email address.
 * Searches the PersonEmail table with case-insensitive matching,
 * filtering to non-deleted persons owned by the user.
 */
export async function matchEmailToPersons(
  userId: string,
  emailAddress: string,
): Promise<string[]> {
  const matches = await prisma.personEmail.findMany({
    where: {
      email: {
        equals: emailAddress,
        mode: 'insensitive',
      },
      person: {
        userId,
        deletedAt: null,
      },
    },
    select: {
      personId: true,
    },
  });

  return matches.map((m) => m.personId);
}

// ---------------------------------------------------------------------------
// 7. Recursively extract text/plain body from MIME parts
// ---------------------------------------------------------------------------

/**
 * Recursively walk the MIME part tree to find and return the first
 * text/plain body. Handles multipart/alternative, multipart/mixed, etc.
 */
export function getPlainTextBody(payload: gmail_v1.Schema$MessagePart): string | null {
  // Direct text/plain part
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Recurse into sub-parts (multipart/alternative, multipart/mixed, etc.)
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const text = getPlainTextBody(part);
      if (text) return text;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 8. Get attachment info without downloading content
// ---------------------------------------------------------------------------

/**
 * Walk the MIME part tree and return metadata for each attachment.
 * Does not download attachment data.
 */
export function getAttachmentInfo(payload: gmail_v1.Schema$MessagePart): AttachmentInfo[] {
  const attachments: AttachmentInfo[] = [];

  function walk(part: gmail_v1.Schema$MessagePart) {
    // A part is an attachment if it has a filename and an attachmentId in its body
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        fileName: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
      });
    }

    // Recurse into sub-parts
    if (part.parts) {
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);
  return attachments;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decode a base64url-encoded string (as used by Gmail API) to UTF-8 text.
 */
function decodeBase64Url(data: string): string {
  // Replace base64url characters with standard base64
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Match all email participants (from, to, cc) to Person records and
 * create EmailLogPerson join records.
 */
async function matchAndLinkParticipants(
  userId: string,
  emailLogId: string,
  from: ParsedEmailAddress,
  toAddresses: ParsedEmailAddress[],
  ccAddresses: ParsedEmailAddress[],
): Promise<number> {
  let matchedCount = 0;

  // Helper to match and link a single participant
  async function linkParticipant(emailAddress: string, role: string) {
    const personIds = await matchEmailToPersons(userId, emailAddress);
    for (const personId of personIds) {
      try {
        await prisma.emailLogPerson.create({
          data: {
            emailLogId,
            personId,
            role,
          },
        });
        matchedCount++;
      } catch (err) {
        // Unique constraint violation — already linked (safe to ignore)
        if (
          err instanceof Error &&
          err.message.includes('Unique constraint')
        ) {
          log.debug({ emailLogId, personId, role }, 'EmailLogPerson already exists');
        } else {
          throw err;
        }
      }
    }
  }

  // Match from
  await linkParticipant(from.email, 'from');

  // Match to
  for (const addr of toAddresses) {
    await linkParticipant(addr.email, 'to');
  }

  // Match cc
  for (const addr of ccAddresses) {
    await linkParticipant(addr.email, 'cc');
  }

  return matchedCount;
}

/**
 * Count how many distinct persons are linked to emails for a given integration.
 * Used to report matchedToContacts in the sync result.
 */
async function countMatchedContacts(integrationId: string): Promise<number> {
  const result = await prisma.emailLogPerson.findMany({
    where: {
      emailLog: { integrationId },
    },
    select: { personId: true },
    distinct: ['personId'],
  });

  return result.length;
}
