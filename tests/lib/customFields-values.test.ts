import { describe, it, expect } from 'vitest';
import {
  validateRawValue,
  isEmptyRawValue,
} from '../../lib/customFields/values';

describe('isEmptyRawValue', () => {
  it('treats empty string and whitespace as empty', () => {
    expect(isEmptyRawValue('')).toBe(true);
    expect(isEmptyRawValue('   ')).toBe(true);
  });

  it('treats any non-blank string as non-empty', () => {
    expect(isEmptyRawValue('false')).toBe(false);
    expect(isEmptyRawValue('0')).toBe(false);
  });
});

describe('validateRawValue', () => {
  it('accepts any non-empty string for TEXT', () => {
    expect(validateRawValue('TEXT', 'anything', [])).toEqual({ ok: true });
  });

  it('rejects non-numeric strings for NUMBER', () => {
    expect(validateRawValue('NUMBER', 'abc', [])).toEqual({
      ok: false,
      error: 'NOT_A_NUMBER',
    });
  });

  it('accepts decimals and negatives for NUMBER', () => {
    expect(validateRawValue('NUMBER', '-3.14', [])).toEqual({ ok: true });
  });

  it('rejects Infinity / NaN for NUMBER', () => {
    expect(validateRawValue('NUMBER', 'Infinity', [])).toEqual({
      ok: false,
      error: 'NOT_A_NUMBER',
    });
  });

  it('accepts only "true" or "false" for BOOLEAN', () => {
    expect(validateRawValue('BOOLEAN', 'true', [])).toEqual({ ok: true });
    expect(validateRawValue('BOOLEAN', 'false', [])).toEqual({ ok: true });
    expect(validateRawValue('BOOLEAN', 'yes', [])).toEqual({
      ok: false,
      error: 'NOT_BOOLEAN',
    });
  });

  it('accepts SELECT values that are in the options list', () => {
    expect(validateRawValue('SELECT', 'vegan', ['vegan', 'omnivore'])).toEqual({
      ok: true,
    });
  });

  it('rejects SELECT values not in the options list', () => {
    expect(validateRawValue('SELECT', 'pescatarian', ['vegan', 'omnivore'])).toEqual({
      ok: false,
      error: 'NOT_IN_OPTIONS',
    });
  });
});

import {
  customFieldTemplateCreateSchema,
  customFieldTemplateUpdateSchema,
} from '../../lib/validations';

describe('customFieldTemplateCreateSchema', () => {
  it('requires options when type is SELECT', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Diet',
      type: 'SELECT',
    });
    expect(result.success).toBe(false);
  });

  it('accepts SELECT with options', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Diet',
      type: 'SELECT',
      options: ['vegan'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts non-SELECT types without options', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Has pets',
      type: 'BOOLEAN',
    });
    expect(result.success).toBe(true);
  });
});

describe('customFieldTemplateUpdateSchema', () => {
  it('rejects empty objects', () => {
    expect(customFieldTemplateUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('accepts partial updates', () => {
    expect(customFieldTemplateUpdateSchema.safeParse({ name: 'New' }).success).toBe(true);
  });
});
