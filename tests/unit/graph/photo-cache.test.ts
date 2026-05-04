import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getCachedPhoto,
  loadPhoto,
  __resetPhotoCacheForTests,
} from '../../../components/graph/photo-cache';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() { return this._src; }
  set src(v: string) { this._src = v; }
  triggerLoad() { this.onload?.(); }
  triggerError() { this.onerror?.(); }
}

describe('photo-cache', () => {
  let createdImages: FakeImage[];
  let originalImage: typeof Image;

  beforeEach(() => {
    __resetPhotoCacheForTests();
    createdImages = [];
    originalImage = globalThis.Image;
    // @ts-expect-error - test override
    globalThis.Image = class {
      private img: FakeImage;
      private _onload: (() => void) | null = null;
      private _onerror: (() => void) | null = null;

      constructor() {
        this.img = new FakeImage();
        createdImages.push(this.img);
      }

      get src() {
        return this.img.src;
      }

      set src(v: string) {
        this.img.src = v;
      }

      get onload() {
        return this._onload;
      }

      set onload(cb: (() => void) | null) {
        this._onload = cb;
        this.img.onload = cb;
      }

      get onerror() {
        return this._onerror;
      }

      set onerror(cb: (() => void) | null) {
        this._onerror = cb;
        this.img.onerror = cb;
      }
    };
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  it('returns undefined for a person with no cached photo', () => {
    expect(getCachedPhoto('person-1')).toBeUndefined();
  });

  it('creates exactly one Image per person id on repeated loadPhoto calls', () => {
    loadPhoto('person-1', '/api/photos/person-1', () => {});
    loadPhoto('person-1', '/api/photos/person-1', () => {});
    expect(createdImages.length).toBe(1);
  });

  it('caches the Image on successful load and invokes onReady', () => {
    const onReady = vi.fn();
    loadPhoto('person-1', '/api/photos/person-1', onReady);
    expect(getCachedPhoto('person-1')).toBe('loading');
    const fakeImg = createdImages[0];
    fakeImg.triggerLoad();
    expect(onReady).toHaveBeenCalledOnce();
    const cached = getCachedPhoto('person-1');
    expect(cached).not.toBe('loading');
    expect(cached).not.toBe('error');
    expect(typeof cached).toBe('object');
  });

  it('caches the "error" sentinel on load failure and does not retry', () => {
    const onReady = vi.fn();
    loadPhoto('person-1', '/api/photos/person-1', onReady);
    const fakeImg = createdImages[0];
    fakeImg.triggerError();
    expect(getCachedPhoto('person-1')).toBe('error');
    loadPhoto('person-1', '/api/photos/person-1', onReady);
    expect(createdImages.length).toBe(1);
  });
});
