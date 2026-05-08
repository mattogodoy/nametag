import type { CustomFieldType } from '@prisma/client';

/**
 * Returns the X- vCard property key for a custom field template slug.
 * e.g. 'dietary-restriction' → 'X-NAMETAG-FIELD-DIETARY-RESTRICTION'
 */
export function customFieldXKey(slug: string): string {
  return `X-NAMETAG-FIELD-${slug.toUpperCase()}`;
}

export interface SerializeInput {
  template: { slug: string; type: CustomFieldType; deletedAt: Date | null };
  value: string;
}

export interface XLine {
  key: string;
  params: { TYPE: string };
  value: string;
}

/**
 * Build vCard X- lines for active template-backed custom field values.
 * Skips soft-deleted templates.
 */
export function buildCustomFieldXLines(inputs: SerializeInput[]): XLine[] {
  const out: XLine[] = [];
  for (const input of inputs) {
    if (input.template.deletedAt !== null) continue;
    out.push({
      key: customFieldXKey(input.template.slug),
      params: { TYPE: `NAMETAG-FIELD-${input.template.type}` },
      value: input.value,
    });
  }
  return out;
}

/**
 * Filter a list of free-form custom field entries, removing any whose key
 * appears in the blocked set (i.e. already emitted as a template-backed line).
 */
export function filterFreeFormCustomFieldsAgainstTemplates<T extends { key: string }>(
  freeForm: T[],
  templateKeys: string[]
): T[] {
  const blocked = new Set(templateKeys);
  return freeForm.filter((f) => !blocked.has(f.key));
}
