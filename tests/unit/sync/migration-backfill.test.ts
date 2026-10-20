import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sql = readFileSync(
  path.resolve(__dirname, '../../../prisma/migrations/20261020120000_delta_sync/migration.sql'),
  'utf8'
);

describe('delta sync migration', () => {
  it('backfills existing rows before the stamp triggers are created', () => {
    const call = sql.indexOf('SELECT nametag_sync_backfill();');
    const firstTrigger = sql.indexOf('CREATE TRIGGER sync_stamp');
    expect(call).toBeGreaterThan(sql.indexOf('CREATE OR REPLACE FUNCTION nametag_sync_backfill()'));
    expect(firstTrigger).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(firstTrigger);
  });
});
