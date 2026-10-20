// Route files that still build error responses by hand. Sweep tasks delete entries.
// One entry per line so removals are one-line diffs.
export const RAW_ERROR_ALLOWLIST = new Map<string, string>([
  ['app/api/carddav/backup/route.ts', 'pending error-code sweep'],
  ['app/api/carddav/conflicts/[id]/resolve/route.ts', 'pending error-code sweep'],
  ['app/api/carddav/connection/route.ts', 'pending error-code sweep'],
  ['app/api/carddav/connection/test/route.ts', 'pending error-code sweep'],
  ['app/api/carddav/export-bulk/route.ts', 'pending error-code sweep'],
  ['app/api/carddav/import/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/email/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/endpoints/[id]/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/endpoints/[id]/test/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/endpoints/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/push/public-key/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/push/status/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/push/subscribe/route.ts', 'pending error-code sweep'],
  ['app/api/notifications/push/subscriptions/[id]/route.ts', 'pending error-code sweep'],
  ['app/api/vcard/import/route.ts', 'pending error-code sweep'],
  ['app/api/webhooks/stripe/route.ts', 'pending error-code sweep'],
]);
