/**
 * Fails the build when a pull request's title and description would squash into
 * a commit message release-please cannot parse. See scripts/conventional-commit.ts
 * for why a bad parse is worth blocking a merge over.
 *
 * Reads PR_TITLE, PR_BODY and PR_NUMBER from the environment rather than argv so
 * that nothing in the untrusted text is ever interpreted by the shell.
 */
import { buildSquashCommitMessage, findParseError } from './conventional-commit';

const title = process.env.PR_TITLE;
const prNumber = Number(process.env.PR_NUMBER);

if (!title || !Number.isInteger(prNumber)) {
  console.error('PR_TITLE and PR_NUMBER are required.');
  process.exit(1);
}

const message = buildSquashCommitMessage(title, process.env.PR_BODY, prNumber);
const error = findParseError(message);

if (!error) {
  console.log('Commit message parses as a conventional commit.');
  process.exit(0);
}

const [line, column] = (error.match(/(\d+):(\d+)/)?.slice(1) ?? []).map(Number);
const offendingLine = line ? message.split('\n')[line - 1] : undefined;

console.error(`This pull request's commit message cannot be parsed.

  ${error}
`);

if (offendingLine !== undefined) {
  console.error(`Line ${line}:

  ${offendingLine}
  ${' '.repeat(Math.max(0, column - 1))}^
`);
}

console.error(`release-please parses the whole commit message, which on a squash
merge is this pull request's title plus its description. When the parse fails it
skips the commit silently: no changelog entry, and no version bump. Nothing in
the release turns red, the change just goes missing.

The usual cause is nested parentheses, since the grammar uses them for the
commit scope. Whether a given nesting trips it depends on where in the line it
sits, so treat the position above as the answer and avoid nesting anywhere.
Rewrite "foo(bar(baz))" as "foo() over bar()" or similar, in the description as
well as the title. Backticks and code fences do not exempt it.

Edit the title or the description and this check will re-run.`);

process.exit(1);
