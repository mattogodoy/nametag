import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.join(process.cwd(), 'locales');
const REFERENCE = 'en.json';

/**
 * Keys that are already inconsistent across locale files on master, recorded
 * here so this test can guard against NEW drift without requiring unrelated
 * translation work first.
 *
 * Do not add to this list. When one of these is fixed, delete it from here and
 * the test will keep it fixed.
 */
const KNOWN_MISSING: Record<string, string[]> = {};

/** Keys present in a translation file but absent from en.json. Dead keys. */
const KNOWN_EXTRA: Record<string, string[]> = {};

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function leafKeys(value: Json, prefix = ''): string[] {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).flatMap((key) =>
      leafKeys(value[key], prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

function load(file: string): Json {
  return JSON.parse(readFileSync(path.join(LOCALES_DIR, file), 'utf8')) as Json;
}

const localeFiles = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
const referenceKeys = leafKeys(load(REFERENCE));

describe('locale key parity', () => {
  it('finds all nine locale files', () => {
    expect(localeFiles).toEqual([
      'de-DE.json', 'en.json', 'es-ES.json', 'it-IT.json', 'ja-JP.json',
      'nb-NO.json', 'nl-NL.json', 'ru-RU.json', 'zh-CN.json',
    ]);
  });

  it('en.json has no duplicate leaf keys', () => {
    expect(referenceKeys.length).toBe(new Set(referenceKeys).size);
  });

  for (const file of localeFiles) {
    if (file === REFERENCE) continue;

    describe(file, () => {
      const keys = new Set(leafKeys(load(file)));
      const referenceSet = new Set(referenceKeys);

      it('is missing only the documented baseline keys', () => {
        const missing = referenceKeys.filter((k) => !keys.has(k));
        expect(missing.sort()).toEqual([...(KNOWN_MISSING[file] ?? [])].sort());
      });

      it('has no undocumented extra keys', () => {
        const extra = [...keys].filter((k) => !referenceSet.has(k));
        expect(extra.sort()).toEqual([...(KNOWN_EXTRA[file] ?? [])].sort());
      });
    });
  }
});
