/**
 * Tests for PUT /api/carddav/connection endpoint.
 *
 * Verifies that sync settings can be updated independently
 * without requiring serverUrl/username, and that full connection
 * updates still work when all fields are provided.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '@/app/api/carddav/connection/route';
import { auth } from '@/lib/auth';

// ── hoisted mocks ───────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  findUniqueConnection: vi.fn(),
  updateConnection: vi.fn(),
  encryptPassword: vi.fn(),
  validateServerUrl: vi.fn(),
}));

vi.mock('@/lib/auth');

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findUnique: mocks.findUniqueConnection,
      update: mocks.updateConnection,
    },
  },
}));

vi.mock('@/lib/carddav/encryption', () => ({
  encryptPassword: mocks.encryptPassword,
}));

vi.mock('@/lib/carddav/url-validation', () => ({
  validateServerUrl: mocks.validateServerUrl,
}));

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── helpers ─────────────────────────────────────────────────────────────────
function putConnection(body: Record<string, unknown>) {
  return PUT(
    new Request('http://localhost/api/carddav/connection', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

const existingConnection = {
  id: 'conn-1',
  userId: 'user-1',
  serverUrl: 'https://carddav.example.com',
  username: 'testuser',
  password: 'encrypted-pw',
  provider: 'generic',
  syncEnabled: true,
  autoExportNew: true,
  autoSyncInterval: 43200,
  importMode: 'manual',
  lastSyncAt: null,
  syncToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── tests ───────────────────────────────────────────────────────────────────
describe('PUT /api/carddav/connection', () => {
  const session = { user: { id: 'user-1', email: 'u@example.com' } };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);
    mocks.findUniqueConnection.mockResolvedValue(existingConnection);
    mocks.validateServerUrl.mockResolvedValue(undefined);
    mocks.encryptPassword.mockReturnValue('encrypted-new-pw');
    mocks.updateConnection.mockImplementation(({ data }) => {
      return Promise.resolve({ ...existingConnection, ...data });
    });
  });

  it('updates sync settings without serverUrl or username', async () => {
    const res = await putConnection({
      syncEnabled: false,
      autoExportNew: false,
      importMode: 'auto',
    });

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.syncEnabled).toBe(false);
    expect(data.autoExportNew).toBe(false);
    expect(data.importMode).toBe('auto');

    // Should not have called URL validation since no URL was sent
    expect(mocks.validateServerUrl).not.toHaveBeenCalled();

    // Should only include the provided fields in the update
    expect(mocks.updateConnection).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        syncEnabled: false,
        autoExportNew: false,
        importMode: 'auto',
      },
    });
  });

  it('updates only importMode alone', async () => {
    const res = await putConnection({ importMode: 'notify' });

    expect(res.status).toBe(200);
    expect(mocks.updateConnection).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { importMode: 'notify' },
    });
  });

  it('updates all fields including serverUrl and username', async () => {
    const res = await putConnection({
      serverUrl: 'https://new-server.example.com',
      username: 'newuser',
      password: 'newpass',
      provider: 'google',
      syncEnabled: true,
      autoExportNew: false,
      autoSyncInterval: 3600,
      importMode: 'auto',
    });

    expect(res.status).toBe(200);
    expect(mocks.validateServerUrl).toHaveBeenCalledWith('https://new-server.example.com');
    expect(mocks.encryptPassword).toHaveBeenCalledWith('newpass');
    expect(mocks.updateConnection).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        serverUrl: 'https://new-server.example.com',
        username: 'newuser',
        password: 'encrypted-new-pw',
        provider: 'google',
        syncEnabled: true,
        autoExportNew: false,
        autoSyncInterval: 3600,
        importMode: 'auto',
      },
    });
  });

  it('does not include password in response', async () => {
    const res = await putConnection({ syncEnabled: true });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.password).toBeUndefined();
  });

  it('returns 401 when not authenticated', async () => {
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await putConnection({ syncEnabled: false });

    expect(res.status).toBe(401);
  });

  it('returns 404 when no connection exists', async () => {
    mocks.findUniqueConnection.mockResolvedValue(null);

    const res = await putConnection({ syncEnabled: false });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('not found');
  });

  it('returns 400 for invalid importMode value', async () => {
    const res = await putConnection({ importMode: 'invalid' });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid input');
  });

  it('returns 400 for invalid autoSyncInterval', async () => {
    const res = await putConnection({ autoSyncInterval: 10 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when serverUrl is invalid', async () => {
    mocks.validateServerUrl.mockRejectedValue(new Error('URL not allowed'));

    const res = await putConnection({
      serverUrl: 'https://evil.internal',
      username: 'user',
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('URL not allowed');
  });

  it('skips password encryption when password is not provided', async () => {
    await putConnection({ syncEnabled: true });

    expect(mocks.encryptPassword).not.toHaveBeenCalled();
  });
});
