import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../../../lib/crypto/secrets';
import { encryptPassword, decryptPassword } from '../../../lib/carddav/encryption';

describe('secret encryption', () => {
  it('round-trips a value', () => {
    expect(decryptSecret(encryptSecret('tk_abc123'))).toBe('tk_abc123');
  });

  it('round-trips unicode', () => {
    expect(decryptSecret(encryptSecret('пароль-密码-🔑'))).toBe('пароль-密码-🔑');
  });

  it('produces a different ciphertext each time, so the IV is not reused', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('emits the iv:authTag:ciphertext format', () => {
    expect(encryptSecret('x').split(':')).toHaveLength(3);
  });

  it('rejects a tampered ciphertext rather than returning garbage', () => {
    const [iv, tag, data] = encryptSecret('x').split(':');
    expect(() => decryptSecret(`${iv}:${tag}:${data.replace(/.$/, '0')}`)).toThrow();
  });

  it('rejects a malformed value', () => {
    expect(() => decryptSecret('nope')).toThrow('Invalid encrypted password format');
  });

  it('stays compatible with the CardDAV aliases, so stored rows still decrypt', () => {
    expect(decryptSecret(encryptPassword('legacy'))).toBe('legacy');
    expect(decryptPassword(encryptSecret('legacy'))).toBe('legacy');
  });
});
