// Route files that still build error responses by hand. Sweep tasks delete entries.
// One entry per line so removals are one-line diffs.
export const RAW_ERROR_ALLOWLIST = new Map<string, string>([
  ['app/api/vcard/import/route.ts', 'pending error-code sweep'],
  ['app/api/webhooks/stripe/route.ts', 'pending error-code sweep'],
]);
