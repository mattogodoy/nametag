'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CustomFieldType } from '@prisma/client';
import { TemplateWithCount } from './CustomFieldsManager';

interface CustomFieldTemplateFormProps {
  mode: 'create' | 'edit';
  template?: TemplateWithCount;
  onSaved: () => void;
  onCancel: () => void;
}

const FIELD_TYPES: CustomFieldType[] = ['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT'];

const TYPE_LABEL_KEYS: Record<CustomFieldType, string> = {
  TEXT: 'typeText',
  NUMBER: 'typeNumber',
  BOOLEAN: 'typeBoolean',
  SELECT: 'typeSelect',
};

export default function CustomFieldTemplateForm({
  mode,
  template,
  onSaved,
  onCancel,
}: CustomFieldTemplateFormProps) {
  const t = useTranslations('customFields.form');
  const tErrors = useTranslations('customFields.errors');

  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState<CustomFieldType>(template?.type ?? 'TEXT');
  const [options, setOptions] = useState<string[]>(
    template?.options.length ? template.options : ['']
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';
  const showOptions = type === 'SELECT';

  const handleOptionChange = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
  };

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload =
      type === 'SELECT'
        ? { name, type, options: options.filter((o) => o.trim() !== '') }
        : { name, type, options: [] };

    try {
      const url = isEdit
        ? `/api/custom-field-templates/${template!.id}`
        : '/api/custom-field-templates';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSaved();
      } else {
        const data = (await res.json()) as { error?: string };
        // Map known statuses to translated strings; fall back to the API's
        // raw message for cases we haven't mapped (already English-only).
        if (res.status === 409) {
          setError(tErrors('duplicateName'));
        } else {
          setError(data.error ?? tErrors('somethingWentWrong'));
        }
      }
    } catch {
      setError(tErrors('cannotConnect'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label htmlFor="cf-name" className="block text-sm font-medium text-foreground mb-1">
          {t('nameLabel')}
        </label>
        <input
          id="cf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          maxLength={60}
          required
          className="w-full rounded-lg border border-border bg-surface text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Type */}
      <div>
        <span className="block text-sm font-medium text-foreground mb-2">{t('typeLabel')}</span>
        {isEdit && (
          <p className="text-xs text-muted mb-2">{t('typeLockedNotice')}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {FIELD_TYPES.map((ft) => (
            <label
              key={ft}
              className={`inline-flex items-center gap-2 cursor-pointer ${
                isEdit ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <input
                type="radio"
                name="cf-type"
                value={ft}
                checked={type === ft}
                onChange={() => !isEdit && setType(ft)}
                disabled={isEdit}
                className="text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">{t(TYPE_LABEL_KEYS[ft])}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Options (SELECT only) */}
      {showOptions && (
        <div>
          <span className="block text-sm font-medium text-foreground mb-2">
            {t('optionsLabel')}
          </span>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`${t('optionPlaceholder')} ${idx + 1}`}
                  className="flex-1 rounded-lg border border-border bg-surface text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                {options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-sm text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    {t('removeOption')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-2 text-sm text-primary hover:underline"
          >
            + {t('addOption')}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? t('savingButton') : t('saveButton')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border border-border text-muted rounded-lg text-sm font-medium hover:bg-surface-elevated transition-colors disabled:opacity-50"
        >
          {t('cancelButton')}
        </button>
      </div>
    </form>
  );
}
