/**
 * Checks that a pull request would produce a commit message release-please can
 * parse.
 *
 * release-please runs the whole commit message, not just the header, through the
 * strict PEG grammar in `@conventional-commits/parser`. When that parse throws,
 * release-please logs "commit could not be parsed" at debug level, skips the
 * commit, and still exits green. The commit then contributes nothing: no
 * changelog entry, and no version bump either.
 *
 * That is how #402 shipped in 0.58.5 with no changelog line. Its body contained
 * `formatDateWithoutYear(parseCalendarDate(stored))`, and the grammar uses
 * parentheses for the scope, so a second `(` opening before the first one closes
 * is a parse error even 98 lines below the header, inside backticks, in prose.
 *
 * The parser version here must track the one release-please depends on, so that
 * this check accepts and rejects exactly what release-please does.
 */
import { parser } from '@conventional-commits/parser';

/**
 * Recomposes the commit message that a squash merge will produce. GitHub uses
 * the pull request title with the number appended, then the description as the
 * body.
 */
export function buildSquashCommitMessage(
  title: string,
  body: string | null | undefined,
  prNumber: number
): string {
  const header = `${title.trim()} (#${prNumber})`;
  // The API returns CRLF, git stores LF.
  const trimmedBody = (body ?? '').replace(/\r\n/g, '\n').trim();

  return trimmedBody ? `${header}\n\n${trimmedBody}` : header;
}

/**
 * Returns the parser's complaint, or null when the message parses cleanly.
 */
export function findParseError(message: string): string | null {
  try {
    parser(message);
    return null;
  } catch (error) {
    if (error instanceof Error) {
      // The parser's message carries a rendered snippet of the offending line
      // after the first line. The first line has the position and is enough.
      return error.message.split('\n')[0];
    }
    return String(error);
  }
}
