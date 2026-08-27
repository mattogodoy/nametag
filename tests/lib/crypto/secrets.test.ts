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

    // Flip the last hex digit to something guaranteed different. Replacing it
    // with a fixed character is a no-op whenever it already matches, which
    // leaves the ciphertext untampered and the test passing for the wrong
    // reason.
    const tampered = data.slice(0, -1) + (data.endsWith('0') ? '1' : '0');

    expect(() => decryptSecret(`${iv}:${tag}:${tampered}`)).toThrow();
  });

  it('rejects a malformed value', () => {
    expect(() => decryptSecret('nope')).toThrow('Invalid encrypted password format');
  });

  it('stays compatible with the CardDAV aliases, so stored rows still decrypt', () => {
    expect(decryptSecret(encryptPassword('legacy'))).toBe('legacy');
    expect(decryptPassword(encryptSecret('legacy'))).toBe('legacy');
  });

  /*
   * A ciphertext produced by the known-good implementation and frozen here on
   * purpose. Every other test in this file encrypts and decrypts with the same
   * code in the same run, so all of them would still pass if the key
   * derivation, the algorithm, the IV length, or the separator changed in a
   * self-consistent way. Only a fixed ciphertext catches that, and that change
   * is exactly what would make every CardDAV password already sitting in a
   * user's database undecryptable.
   *
   * If this test fails, do not regenerate the constant. The wire format
   * changed, and existing stored secrets are about to stop working.
   */
  it('decrypts a ciphertext frozen from the known-good implementation', () => {
    const GOLDEN =
      '16ab42b696283eb0edea98ce:1af3828426bcb7e474f861e9763dc9a1:b9e61c5c2483dabf32880540514a2cd5c401e0b5';

    expect(decryptSecret(GOLDEN)).toBe('golden-fixture-value');
  });
});
