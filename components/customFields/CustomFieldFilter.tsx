'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CustomFieldTemplate } from '@prisma/client';

interface Props {
  templates: CustomFieldTemplate[];
  current: { slug: string; value: string } | null;
  onChange: (cf: string) => void; // pass empty string to clear
}

export default function CustomFieldFilter({ templates, current, onChange }: Props) {
  const t = useTranslations('customFields');
  const tPerson = useTranslations('customFields.person');
  const [pickingTemplate, setPickingTemplate] = useState<CustomFieldTemplate | null>(null);

  if (templates.length === 0) return null;

  // Active filter chip
  if (current) {
    const tpl = templates.find((tt) => tt.slug === current.slug);
    if (tpl) {
      const displayValue =
        tpl.type === 'BOOLEAN'
          ? current.value === 'true'
            ? tPerson('booleanYes')
            : tPerson('booleanNo')
          : current.value;
      return (
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
          title={t('filter.clearLabel')}
        >
          <span>
            {t('filter.chipFormat', { name: tpl.name, value: displayValue })}
          </span>
          <span aria-hidden>✕</span>
        </button>
      );
    }
    // Template was soft-deleted — show stale filter chip so user can clear it
    return (
      <button
        type="button"
        onClick={() => onChange('')}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-amber-500/40 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
        title={t('filter.clearLabel')}
      >
        <span>{t('filter.staleFilter')}</span>
        <span aria-hidden>✕</span>
      </button>
    );
  }

  // Template picker (after user clicked More filters and selected a template)
  if (pickingTemplate) {
    return (
      <CustomFieldValuePicker
        template={pickingTemplate}
        onApply={(value) => {
          if (value) {
            onChange(`${pickingTemplate.slug}:${value}`);
          }
          setPickingTemplate(null);
        }}
        onCancel={() => setPickingTemplate(null)}
      />
    );
  }

  // Default: "More filters" dropdown listing templates
  return (
    <select
      value=""
      onChange={(e) => {
        const tpl = templates.find((tt) => tt.id === e.target.value);
        if (tpl) setPickingTemplate(tpl);
      }}
      className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
    >
      <option value="">{t('filter.moreFilters')}</option>
      {templates.map((tpl) => (
        <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
      ))}
    </select>
  );
}

interface ValuePickerProps {
  template: CustomFieldTemplate;
  onApply: (value: string) => void;
  onCancel: () => void;
}

function CustomFieldValuePicker({ template, onApply, onCancel }: ValuePickerProps) {
  const t = useTranslations('customFields');
  const tPerson = useTranslations('customFields.person');
  const [draft, setDraft] = useState('');

  const inputClass =
    'px-3 py-1.5 text-sm border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary';

  let input: React.ReactNode;
  switch (template.type) {
    case 'TEXT':
      input = (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={template.name}
          className={inputClass}
        />
      );
      break;
    case 'NUMBER':
      input = (
        <input
          type="number"
          step="any"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={template.name}
          className={inputClass}
        />
      );
      break;
    case 'BOOLEAN':
      input = (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        >
          <option value="">{tPerson('booleanNotSet')}</option>
          <option value="true">{tPerson('booleanYes')}</option>
          <option value="false">{tPerson('booleanNo')}</option>
        </select>
      );
      break;
    case 'SELECT':
      input = (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        >
          <option value="">{t('filter.selectField')}</option>
          {template.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
      break;
    default:
      input = null;
  }

  return (
    <div className="flex items-center gap-2">
      {input}
      <button
        type="button"
        onClick={() => onApply(draft.trim())}
        disabled={!draft.trim()}
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
      >
        {t('filter.applyButton')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-1.5 text-sm text-muted hover:text-foreground"
      >
        {t('form.cancelButton')}
      </button>
    </div>
  );
}
