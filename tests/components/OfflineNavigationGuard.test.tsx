import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import OfflineNavigationGuard from '@/components/OfflineNavigationGuard';

/**
 * Fix 1 only ever matters while offline: the router works fine online, so
 * every "left alone" assertion here is checked in the offline state, which is
 * the harder bar to clear.
 */
describe('OfflineNavigationGuard', () => {
  let assign: ReturnType<typeof vi.fn>;

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value,
    });
  }

  beforeEach(() => {
    assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, assign },
    });
    setOnline(true);
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, 'onLine');
    Reflect.deleteProperty(window, 'location');
    vi.restoreAllMocks();
  });

  it('prevents and hard-navigates a click on an internal link while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="/people">People</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(false); // fireEvent returns false when preventDefault was called
    expect(assign).toHaveBeenCalledWith(`${window.location.origin}/people`);
  });

  it('leaves the click alone while online', () => {
    setOnline(true);
    document.body.innerHTML = '<a href="/people">People</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves an external link alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="https://example.com/page">External</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a hash-only link on the current page alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="#section">Jump</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a target="_blank" link alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="/people" target="_blank">People</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a download link alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="/export.csv" download>Export</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a modifier-clicked link alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="/people">People</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 0, metaKey: true });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a non-primary-button click alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<a href="/people">People</a>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('a')!, { button: 1 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves a click that is not on an anchor alone even while offline', () => {
    setOnline(false);
    document.body.innerHTML = '<button type="button">Click</button>';
    render(<OfflineNavigationGuard />);

    const event = fireEvent.click(document.querySelector('button')!, { button: 0 });

    expect(event).toBe(true);
    expect(assign).not.toHaveBeenCalled();
  });
});
