import { expect } from 'vitest';
import { getChangesSince, type SyncPage } from '@/lib/sync/changes';

type Client = Parameters<typeof getChangesSince>[0];

/** Calls getChangesSince and asserts the read succeeded, returning the page. */
export async function getPage(
  client: Client, userId: string, cursor: bigint, limit: number
): Promise<SyncPage> {
  const result = await getChangesSince(client, userId, cursor, limit);
  expect(result.status).toBe('ok');
  if (result.status !== 'ok') throw new Error(`unexpected sync status ${result.status}`);
  return result.page;
}
