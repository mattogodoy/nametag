import { describe, it, expect } from 'vitest';
import { getLODTier } from '../../../components/graph/lod';

describe('getLODTier', () => {
  it('returns "dots" below k=0.6', () => {
    expect(getLODTier(0.1)).toBe('dots');
    expect(getLODTier(0.59)).toBe('dots');
  });

  it('returns "labels" between k=0.6 and k=1.2', () => {
    expect(getLODTier(0.6)).toBe('labels');
    expect(getLODTier(1.0)).toBe('labels');
    expect(getLODTier(1.19)).toBe('labels');
  });

  it('returns "full" at and above k=1.2', () => {
    expect(getLODTier(1.2)).toBe('full');
    expect(getLODTier(3.0)).toBe('full');
  });
});
