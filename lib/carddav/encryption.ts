import crypto from 'crypto';
import { env } from '@/lib/env';

/**
 * Encryption utilities for CardDAV passwords
 * Uses AES-256-GCM for secure, reversible encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from NEXTAUTH_SECRET
 * We use NEXTAUTH_SECRET as the base for our encryption key
 */
function getEncryptionKey(): Buffer {
  const secret = env.NEXTAUTH_SECRET;
  // Derive a 32-byte key from NEXTAUTH_SECRET using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a password for storage in the database
 */
export function encryptPassword(plainPassword: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a password from the database
 */
export function decryptPassword(encryptedPassword: string): string {
  const key = getEncryptionKey();

  // Parse the encrypted string
  const parts = encryptedPassword.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted password format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
