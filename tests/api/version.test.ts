import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/version', () => ({
  getVersion: () => '1.0.0',
}));

import { GET } from '../../app/api/version/route';

describe('GET /api/version', () => {
  it('should return the application version', async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ version: '1.0.0' });
  });
});
