import { describe, it, expect } from 'vitest';
import {
  challengeFromVerifier,
  verifyPkce,
  STATE_PATTERN,
  CHALLENGE_PATTERN,
  VERIFIER_PATTERN,
} from '@/lib/native-auth/pkce';

// RFC 7636 Appendix B
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

describe('PKCE', () => {
  it('derives the RFC 7636 S256 challenge', () => {
    expect(challengeFromVerifier(VERIFIER)).toBe(CHALLENGE);
  });

  it('accepts the matching verifier and rejects any other', () => {
    expect(verifyPkce(VERIFIER, CHALLENGE)).toBe(true);
    expect(verifyPkce(`${VERIFIER.slice(0, -1)}l`, CHALLENGE)).toBe(false);
    expect(verifyPkce(VERIFIER, `${CHALLENGE.slice(0, -1)}N`)).toBe(false);
    expect(verifyPkce(VERIFIER, '')).toBe(false);
  });

  it('validates parameter shapes', () => {
    expect(STATE_PATTERN.test('abcdefghijklmnop')).toBe(true);
    expect(STATE_PATTERN.test('short')).toBe(false);
    expect(STATE_PATTERN.test('a'.repeat(129))).toBe(false);
    expect(STATE_PATTERN.test('has spaces in it!!')).toBe(false);
    expect(CHALLENGE_PATTERN.test(CHALLENGE)).toBe(true);
    expect(CHALLENGE_PATTERN.test(`${CHALLENGE}=`)).toBe(false);
    expect(VERIFIER_PATTERN.test(VERIFIER)).toBe(true);
    expect(VERIFIER_PATTERN.test('a'.repeat(42))).toBe(false);
    expect(VERIFIER_PATTERN.test('a'.repeat(129))).toBe(false);
  });
});
