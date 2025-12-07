import { vi } from 'vitest';

// Mock session for authenticated user
export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test',
    surname: 'User',
    nickname: null,
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

// Mock unauthenticated session
export const nullSession = null;

// Mock auth function
export const mockAuth = vi.fn(() => Promise.resolve(mockSession));

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

export function setAuthSession(session: typeof mockSession | null) {
  mockAuth.mockResolvedValue(session as typeof mockSession);
}

export function resetAuthMocks() {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(mockSession);
}
