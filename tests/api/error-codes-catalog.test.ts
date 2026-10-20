import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_ERRORS, genericCodeFor } from '@/lib/api-errors';

const SNAPSHOT_PATH = join(process.cwd(), 'tests', 'api', 'error-codes-snapshot.json');

describe('error code catalog', () => {
  it('uses snake_case codes, 4xx/5xx statuses and clean descriptions', () => {
    for (const [code, { status, description }] of Object.entries(API_ERRORS)) {
      expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(status >= 400 && status < 600).toBe(true);
      expect(description.length).toBeGreaterThan(0);
      expect(description).not.toMatch(/[\u2013\u2014]/);
    }
  });
  it('every generic code exists with its own status', () => {
    for (const s of [400, 401, 403, 404, 409, 413, 429, 500, 503]) {
      expect(API_ERRORS[genericCodeFor(s)].status).toBe(s);
    }
  });
  it('never removes, renames or re-statuses a shipped code', () => {
    const shipped: Record<string, number> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    for (const [code, status] of Object.entries(shipped)) {
      expect(API_ERRORS, `code ${code} was removed`).toHaveProperty(code);
      expect(API_ERRORS[code as keyof typeof API_ERRORS].status, `status of ${code} changed`).toBe(status);
    }
  });
  it('snapshot lists every current code (update the snapshot when adding one)', () => {
    const shipped: Record<string, number> = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    expect(Object.keys(API_ERRORS).sort()).toEqual(Object.keys(shipped).sort());
  });
});
