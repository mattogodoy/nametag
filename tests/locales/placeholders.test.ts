import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

// Every ICU argument in en.json must also appear in each translation: a dropped
// or renamed one ({name} for {personName}) never gets its value, and next-intl
// reports an error instead of the text. Extra arguments are allowed — ru-RU adds
// {daysWord}, which lib/email.ts passes for Russian plural word forms.

const dir = path.join(__dirname, '../../locales');
type Messages = { [key: string]: string | Messages };

function flatten(obj: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

function args(message: string): string[] {
  const found = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if ('value' in el && el.type !== TYPE.literal) found.add(String(el.value));
      if ('options' in el) for (const opt of Object.values(el.options)) walk(opt.value);
      if (el.type === TYPE.tag) walk(el.children);
    }
  };
  walk(parse(message, { ignoreTag: false }));
  return [...found].sort();
}

const load = (file: string) => flatten(JSON.parse(readFileSync(path.join(dir, file), 'utf8')));
const en = load('en.json');
const locales = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json');

describe('locale placeholders match en.json', () => {
  it.each(locales)('%s', (file) => {
    const target = load(file);
    const missing = Object.keys(en)
      .filter((key) => typeof target[key] === 'string')
      .map((key) => ({ key, lost: args(en[key]).filter((a) => !args(target[key]).includes(a)) }))
      .filter(({ lost }) => lost.length > 0)
      .map(({ key, lost }) => `${key}: missing {${lost.join('}, {')}}`);
    expect(missing).toEqual([]);
  });
});
