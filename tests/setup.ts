import '@testing-library/jest-dom';
import { vi, beforeEach, afterAll } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock NextResponse for API tests
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const response = new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init?.headers,
        },
      });
      return response;
    },
    redirect: (url: string) => new Response(null, {
      status: 302,
      headers: { Location: url },
    }),
  },
  NextRequest: class MockNextRequest extends Request {},
}));

// Mock next-auth to avoid import issues with its internal dependencies
vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: {
      GET: vi.fn(),
      POST: vi.fn(),
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(),
  })),
}));

vi.mock('next-auth/next', () => ({
  default: vi.fn(),
}));

vi.mock('next-auth/providers/credentials', () => ({
  default: vi.fn(() => ({})),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
