'use client';

import { useTranslations } from 'next-intl';
import { CustomFieldType } from '@prisma/client';
import { TemplateWithCount } from './CustomFieldsManager';
import CustomFieldTemplateForm from './CustomFieldTemplateForm';

interface CustomFieldTemplateRowProps {
  template: TemplateWithCount;
  isEditing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSaved: () => void;
  onCancel: () => void;
}

const TYPE_LABEL_KEYS: Record<CustomFieldType, string> = {
  TEXT: 'typeText',
  NUMBER: 'typeNumber',
  BOOLEAN: 'typeBoolean',
  SELECT: 'typeSelect',
};

export default function CustomFieldTemplateRow({
  template,
  isEditing,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onSaved,
  onCancel,
}: CustomFieldTemplateRowProps) {
  const tSettings = useTranslations('customFields.settings');
  const tForm = useTranslations('customFields.form');
  const tRow = useTranslations('customFields.row');

  if (isEditing) {
    return (
      <div className="px-4 py-4 bg-surface-elevated">
        <CustomFieldTemplateForm
          mode="edit"
          template={template}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-elevated/50 transition-colors">
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={tRow('moveUp')}
          className="p-0.5 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={tRow('moveDown')}
          className="p-0.5 text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground truncate">{template.name}</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary flex-shrink-0">
            {tForm(TYPE_LABEL_KEYS[template.type])}
          </span>
        </div>
        <p className="text-xs text-muted mt-0.5">
          {tSettings('valueCount', { count: template._count.values })}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          aria-label={tRow('edit')}
          className="p-1.5 text-muted hover:text-foreground hover:bg-surface-elevated rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={tRow('delete')}
          className="p-1.5 text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-elevated rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
