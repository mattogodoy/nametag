import { describe, it, expect } from 'vitest';
import { resolveGraphMode } from '../../../components/graph/mode-resolution';

describe('resolveGraphMode', () => {
  it('returns "individuals" when explicitly set', () => {
    expect(resolveGraphMode('individuals')).toBe('individuals');
  });

  it('returns "bubbles" when explicitly set', () => {
    expect(resolveGraphMode('bubbles')).toBe('bubbles');
  });

  it('defaults to "individuals" when unset', () => {
    expect(resolveGraphMode(null)).toBe('individuals');
  });
});
