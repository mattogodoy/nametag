'use client';

import { useTranslations } from 'next-intl';
import type { CustomFieldTemplate } from '@prisma/client';
import type { CustomFieldValueInput } from '@/lib/customFields/persistence';

export type { CustomFieldValueInput };

interface Props {
  templates: CustomFieldTemplate[];
  values: CustomFieldValueInput[];
  onChange: (values: CustomFieldValueInput[]) => void;
}

export default function CustomFieldsSection({ templates, values, onChange }: Props) {
  const t = useTranslations('customFields');

  if (templates.length === 0) return null;

  const valueByTemplate = new Map(values.map((v) => [v.templateId, v.value]));

  const setValue = (templateId: string, raw: string) => {
    const trimmed = raw.trim();
    const next = values.filter((v) => v.templateId !== templateId);
    if (trimmed.length > 0) next.push({ templateId, value: raw });
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {templates.map((template) => {
        const current = valueByTemplate.get(template.id) ?? '';
        return (
          <div key={template.id}>
            <label className="block text-sm font-medium text-foreground mb-1">
              {template.name}
            </label>
            {renderInput(template, current, (next) => setValue(template.id, next), t)}
          </div>
        );
      })}
    </div>
  );
}

function renderInput(
  template: CustomFieldTemplate,
  current: string,
  set: (next: string) => void,
  t: ReturnType<typeof useTranslations>
) {
  const inputClass =
    'w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground';

  switch (template.type) {
    case 'TEXT':
      return (
        <input
          type="text"
          value={current}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
          maxLength={2000}
        />
      );
    case 'NUMBER':
      return (
        <input
          type="number"
          step="any"
          value={current}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
        />
      );
    case 'BOOLEAN':
      return (
        <select
          value={current}
          onChange={(e) => set(e.target.value)}
          className={inputClass}
        >
          <option value="">{t('person.booleanNotSet')}</option>
          <option value="true">{t('person.booleanYes')}</option>
          <option value="false">{t('person.booleanNo')}</option>
        </select>
      );
    case 'SELECT': {
      const isStaleValue =
        current.length > 0 && !template.options.includes(current);
      return (
        <div className="space-y-1">
          <select
            value={current}
            onChange={(e) => set(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('person.selectEmpty')}</option>
            {isStaleValue && <option value={current}>{current}</option>}
            {template.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {isStaleValue && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('person.valueOutOfOptions')}
            </p>
          )}
        </div>
      );
    }
  }
}
