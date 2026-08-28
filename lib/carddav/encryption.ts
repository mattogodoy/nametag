/**
 * Moved to lib/crypto/secrets when notification endpoints began storing
 * secrets too. Names kept here so CardDAV call sites are unchanged.
 *
 * The wire format is identical, so existing encrypted rows still decrypt.
 */
export {
  encryptSecret as encryptPassword,
  decryptSecret as decryptPassword,
} from '@/lib/crypto/secrets';
