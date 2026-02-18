/**
 * Unit tests for CardDAV password encryption/decryption utilities
 */

import { describe, it, expect } from 'vitest';
import { encryptPassword, decryptPassword } from '@/lib/carddav/encryption';

describe('encryptPassword / decryptPassword', () => {
  it('round-trips correctly for a normal password', () => {
    const password = 'my-secret-password';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('produces different ciphertext for the same input (random IV)', () => {
    const a = encryptPassword('same-password');
    const b = encryptPassword('same-password');
    expect(a).not.toBe(b);
    // Both should still decrypt to the same value
    expect(decryptPassword(a)).toBe('same-password');
    expect(decryptPassword(b)).toBe('same-password');
  });

  it('produces output in iv:authTag:data hex format', () => {
    const encrypted = encryptPassword('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    // Encrypted data is hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptPassword('test');
    // Tamper with the encrypted data portion
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`;
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const encrypted = encryptPassword('test');
    const parts = encrypted.split(':');
    const tampered = `${parts[0]}:${'00'.repeat(16)}:${parts[2]}`;
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it('throws on tampered IV', () => {
    const encrypted = encryptPassword('test');
    const parts = encrypted.split(':');
    const tampered = `${'00'.repeat(16)}:${parts[1]}:${parts[2]}`;
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it('throws on invalid format with missing parts', () => {
    expect(() => decryptPassword('not-valid-format')).toThrow(
      'Invalid encrypted password format'
    );
  });

  it('throws on invalid format with too many parts', () => {
    expect(() => decryptPassword('a:b:c:d')).toThrow(
      'Invalid encrypted password format'
    );
  });

  it('throws on empty string input to decrypt', () => {
    expect(() => decryptPassword('')).toThrow(
      'Invalid encrypted password format'
    );
  });

  it('handles empty string encryption', () => {
    const encrypted = encryptPassword('');
    expect(decryptPassword(encrypted)).toBe('');
  });

  it('handles unicode characters', () => {
    const password = 'contrase\u00f1a-\u65e5\u672c\u8a9e-\u043f\u0430\u0440\u043e\u043b\u044c';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('handles special characters', () => {
    const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('handles very long passwords', () => {
    const password = 'a'.repeat(1000);
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('handles passwords with newlines and whitespace', () => {
    const password = '  pass\nword\twith\r\nspaces  ';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('handles emoji in passwords', () => {
    const password = 'password-\ud83d\udd11-key';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });
});
