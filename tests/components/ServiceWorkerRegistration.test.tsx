import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

/**
 * vitest.config.ts sets NODE_ENV=test for the whole suite, and the component
 * only registers when NODE_ENV is 'production', so the production path here
 * needs vi.stubEnv rather than relying on the ambient value.
 */
describe('ServiceWorkerRegistration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('does not register outside production', () => {
    const register = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      configurable: true,
      value: { register, getRegistrations: vi.fn().mockResolvedValue([]) },
    });

    render(<ServiceWorkerRegistration />);

    expect(register).not.toHaveBeenCalled();
  });

  it('posts RECACHE_OFFLINE to the active worker after registering in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const postMessage = vi.fn();
    const register = vi.fn().mockResolvedValue({ active: { postMessage } });
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js');
      expect(postMessage).toHaveBeenCalledWith({ type: 'RECACHE_OFFLINE' });
    });
  });

  it('does not throw when active is null right after a first-ever registration', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    // `active` is null while the worker is still installing. The refresh
    // should simply be skipped rather than throw, landing on the next load.
    const register = vi.fn().mockResolvedValue({ active: null });
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      configurable: true,
      value: { register },
    });

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow();

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith('/sw.js');
    });
  });
});
