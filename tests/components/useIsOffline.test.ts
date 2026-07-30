import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsOffline } from '@/hooks/useIsOffline';

/** navigator.onLine is read-only in jsdom by default, so it needs stubbing. */
function stubOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    writable: true,
    configurable: true,
    value,
  });
}

describe('useIsOffline', () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  afterEach(() => {
    // A leaked stub would silently affect every later test in the suite.
    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original);
    }
  });

  it('reports offline when navigator.onLine is false', () => {
    stubOnLine(false);

    const { result } = renderHook(() => useIsOffline());

    expect(result.current).toBe(true);
  });

  it('reports online when navigator.onLine is true', () => {
    stubOnLine(true);

    const { result } = renderHook(() => useIsOffline());

    expect(result.current).toBe(false);
  });

  it('flips to offline when the browser fires an offline event', () => {
    stubOnLine(true);

    const { result } = renderHook(() => useIsOffline());
    expect(result.current).toBe(false);

    stubOnLine(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(true);
  });

  it('flips back to online when the browser fires an online event', () => {
    stubOnLine(false);

    const { result } = renderHook(() => useIsOffline());
    expect(result.current).toBe(true);

    stubOnLine(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(false);
  });
});
