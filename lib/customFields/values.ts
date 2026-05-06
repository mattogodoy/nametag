import type { CustomFieldType } from '@prisma/client';

export type ValidationErrorCode = 'NOT_A_NUMBER' | 'NOT_BOOLEAN' | 'NOT_IN_OPTIONS';

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationErrorCode };

export function isEmptyRawValue(raw: string): boolean {
  return raw.trim() === '';
}

export function validateRawValue(
  type: CustomFieldType,
  raw: string,
  options: string[]
): ValidationResult {
  switch (type) {
    case 'TEXT':
      return { ok: true };
    case 'NUMBER': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: 'NOT_A_NUMBER' };
      }
      return { ok: true };
    }
    case 'BOOLEAN':
      if (raw === 'true' || raw === 'false') return { ok: true };
      return { ok: false, error: 'NOT_BOOLEAN' };
    case 'SELECT':
      if (options.includes(raw)) return { ok: true };
      return { ok: false, error: 'NOT_IN_OPTIONS' };
    default:
      const _exhaustive: never = type;
      return _exhaustive;
  }
}

