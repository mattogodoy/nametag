import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  buildSquashCommitMessage,
  findParseError,
} from '@/scripts/conventional-commit';

/**
 * These fixtures are the real commit messages of #402 and #404.
 *
 * #402 was silently dropped from the 0.58.5 changelog because release-please
 * could not parse it, so it is the regression case this guard exists for. It is
 * kept as a file rather than an inline string so nothing reformats it: the
 * failure depends on the exact characters, and a helpful editor rewrapping a
 * line would quietly turn this into a test that passes for the wrong reason.
 */
function fixture(name: string): string {
  return readFileSync(
    path.join(__dirname, 'fixtures', `${name}.commit.txt`),
    'utf8'
  );
}

describe('findParseError', () => {
  it('rejects the #402 message that release-please dropped', () => {
    const error = findParseError(fixture('402-dropped'));

    expect(error).not.toBeNull();
    // Same failure release-please logged in CI, to the line and column.
    expect(error).toContain("unexpected token '('");
    expect(error).toContain('98:41');
  });

  it('accepts the #404 message that release-please released', () => {
    expect(findParseError(fixture('404-released'))).toBeNull();
  });

  it('rejects nested parentheses in the body', () => {
    expect(
      findParseError('fix(dates): subject\n\nfoo(bar(baz)) then done')
    ).not.toBeNull();
  });

  it('accepts an ordinary message with flat parentheses', () => {
    expect(
      findParseError(
        'fix(dates): subject\n\nAnchors the value with parseCalendarDate(stored).'
      )
    ).toBeNull();
  });

  it('accepts a breaking change footer', () => {
    expect(
      findParseError(
        'feat!: redesign authentication\n\nBREAKING CHANGE: users must re-authenticate'
      )
    ).toBeNull();
  });

  it('rejects a title that is not a conventional commit', () => {
    expect(findParseError('Update the readme')).not.toBeNull();
  });
});

describe('buildSquashCommitMessage', () => {
  it('appends the PR number to the title the way a squash merge does', () => {
    expect(buildSquashCommitMessage('fix: a thing', 'The body.', 402)).toBe(
      'fix: a thing (#402)\n\nThe body.'
    );
  });

  it('handles an empty body', () => {
    expect(buildSquashCommitMessage('fix: a thing', '', 7)).toBe(
      'fix: a thing (#7)'
    );
    expect(buildSquashCommitMessage('fix: a thing', null, 7)).toBe(
      'fix: a thing (#7)'
    );
  });

  it('normalises the CRLF line endings the API returns', () => {
    expect(
      buildSquashCommitMessage('fix: a thing', 'One.\r\n\r\nTwo.\r\n', 7)
    ).toBe('fix: a thing (#7)\n\nOne.\n\nTwo.');
  });
});
