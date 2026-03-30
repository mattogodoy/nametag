'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import TypeComboBox from '@/components/TypeComboBox';
import {
  CUSTOM_FIELD_PRESETS,
  isSafeUrl,
  type FieldConfig,
  type BaseFieldItem,
  type PersonUrl,
  type PersonLocation,
  type PersonCustomField,
} from '@/lib/field-configs';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FieldManagerProps<T extends BaseFieldItem> {
  items: T[];
  onChange: (items: T[]) => void;
  fieldConfig: FieldConfig<T>;
  /** Human-readable section label (already translated by the caller) */
  label: string;
  /** Human-readable empty-state message (already translated by the caller) */
  emptyText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFieldValue(item: BaseFieldItem, fieldKey: string): string {
  const record = item as Record<string, unknown>;
  const val = record[fieldKey];
  if (val === null || val === undefined) return '';
  return String(val);
}

function setFieldValue<T extends BaseFieldItem>(
  item: T,
  fieldKey: string,
  rawValue: string,
  inputType: string
): T {
  if (inputType === 'number') {
    const parsed = parseFloat(rawValue);
    const numericValue = Number.isNaN(parsed) ? 0 : parsed;
    return { ...item, [fieldKey]: numericValue };
  }
  return { ...item, [fieldKey]: rawValue };
}

// ─── Shared input class ───────────────────────────────────────────────────────

const INPUT_BASE =
  'px-3 py-2 border border-border rounded-lg bg-surface text-foreground';

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldManager<T extends BaseFieldItem>({
  items,
  onChange,
  fieldConfig,
  label,
  emptyText,
}: FieldManagerProps<T>) {
  const t = useTranslations(`people.form.${fieldConfig.namespace}`);

  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<T>({ ...fieldConfig.defaultItem } as T);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('X-CUSTOM');

  // ── Derived ──────────────────────────────────────────────────────────────

  const typeOptions = fieldConfig.typeOptions?.map((opt) => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  const isMultiField = fieldConfig.fields.length > 1 || fieldConfig.keyEditable === true;

  // ── Handlers ─────────────────────────────────────────────────────────────

  const commitItem = (item: T): T | null => {
    if (fieldConfig.transform) return fieldConfig.transform(item);
    return item;
  };

  const isValid = (item: T): boolean => {
    if (fieldConfig.validate) return fieldConfig.validate(item);
    return true;
  };

  const handleAdd = () => {
    if (!isValid(newItem)) return;
    const committed = commitItem({ ...newItem, id: undefined } as T);
    if (!committed) return;
    onChange([...items, committed]);
    setNewItem({ ...fieldConfig.defaultItem } as T);
    setIsAdding(false);
    setSelectedPreset('X-CUSTOM');
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingItem({ ...items[index] } as T);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingItem) return;
    if (!isValid(editingItem)) return;
    const committed = commitItem({ ...editingItem, id: items[editingIndex].id } as T);
    if (!committed) return;
    const updated = [...items];
    updated[editingIndex] = committed;
    onChange(updated);
    setEditingIndex(null);
    setEditingItem(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingItem(null);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItem({ ...fieldConfig.defaultItem } as T);
    setSelectedPreset('X-CUSTOM');
  };

  // ── Special view-mode content ─────────────────────────────────────────────

  const renderSpecialViewContent = (item: T): React.ReactNode | null => {
    if (fieldConfig.namespace === 'urls') {
      const urlItem = item as unknown as PersonUrl;
      if (isSafeUrl(urlItem.url)) {
        return (
          <a
            href={urlItem.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline break-all"
          >
            {urlItem.url}
          </a>
        );
      }
      return (
        <span className="text-sm text-foreground break-all">
          {urlItem.url}
        </span>
      );
    }

    if (fieldConfig.namespace === 'locations') {
      const locItem = item as unknown as PersonLocation;
      const coords = `${locItem.latitude.toFixed(6)}, ${locItem.longitude.toFixed(6)}`;
      return (
        <>
          {locItem.label && (
            <span className="text-xs font-medium text-foreground block mb-1">
              {locItem.label}
            </span>
          )}
          <p className="text-sm text-foreground font-mono">{coords}</p>
          <a
            href={`https://www.google.com/maps?q=${locItem.latitude},${locItem.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {t('viewOnMap')}
          </a>
        </>
      );
    }

    if (fieldConfig.namespace === 'customFields') {
      const cfItem = item as unknown as PersonCustomField;
      return (
        <>
          <div className="mb-1">
            <span className="text-xs font-mono px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
              {cfItem.key}
            </span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {cfItem.value}
          </p>
        </>
      );
    }

    return null;
  };

  // ── Multi-field form inputs builder ──────────────────────────────────────

  const buildMultiFieldInputs = (
    item: T,
    onItemChange: (updated: T) => void
  ): React.ReactNode => {
    const fullWidthFields = fieldConfig.fields.filter((f) => f.fullWidth && !f.selectOptions);
    const gridFields = fieldConfig.fields.filter((f) => !f.fullWidth && !f.selectOptions);
    const selectField = fieldConfig.fields.find((f) => f.selectOptions);

    const rows: React.ReactNode[] = [];

    // Full-width fields first
    for (const field of fullWidthFields) {
      if (field.inputType === 'textarea') {
        rows.push(
          <textarea
            key={field.key}
            value={getFieldValue(item, field.key)}
            onChange={(e) =>
              onItemChange(setFieldValue(item, field.key, e.target.value, field.inputType))
            }
            placeholder={t(field.placeholderKey)}
            aria-label={t(field.placeholderKey)}
            rows={2}
            className={`w-full ${INPUT_BASE}`}
          />
        );
      } else {
        rows.push(
          <input
            key={field.key}
            type={field.inputType}
            value={getFieldValue(item, field.key)}
            onChange={(e) =>
              onItemChange(setFieldValue(item, field.key, e.target.value, field.inputType))
            }
            placeholder={t(field.placeholderKey)}
            aria-label={t(field.placeholderKey)}
            className={`w-full ${INPUT_BASE}`}
            {...(field.inputAttrs as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        );
      }
    }

    // Grid-paired fields (2 per row), with the select appended to the last row
    const postalField = gridFields.find((f) => f.key === 'postalCode');
    const nonPostalGridFields = selectField ? gridFields.filter((f) => f.key !== 'postalCode') : gridFields;

    for (let i = 0; i < nonPostalGridFields.length; i += 2) {
      const pair = nonPostalGridFields.slice(i, i + 2);
      rows.push(
        <div key={`grid-${i}`} className="grid grid-cols-2 gap-2">
          {pair.map((field) => (
            <input
              key={field.key}
              type={field.inputType}
              value={getFieldValue(item, field.key)}
              onChange={(e) =>
                onItemChange(setFieldValue(item, field.key, e.target.value, field.inputType))
              }
              placeholder={t(field.placeholderKey)}
              aria-label={t(field.placeholderKey)}
              className={INPUT_BASE}
              {...(field.inputAttrs as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          ))}
        </div>
      );
    }

    // Last row: postalCode + country select (or remaining grid fields + select)
    if (selectField) {
      rows.push(
        <div key="postal-country" className="grid grid-cols-2 gap-2">
          {postalField && (
            <input
              type={postalField.inputType}
              value={getFieldValue(item, postalField.key)}
              onChange={(e) =>
                onItemChange(
                  setFieldValue(item, postalField.key, e.target.value, postalField.inputType)
                )
              }
              placeholder={t(postalField.placeholderKey)}
              aria-label={t(postalField.placeholderKey)}
              className={INPUT_BASE}
            />
          )}
          <select
            value={getFieldValue(item, selectField.key)}
            onChange={(e) =>
              onItemChange(setFieldValue(item, selectField.key, e.target.value, selectField.inputType))
            }
            aria-label={t(selectField.placeholderKey)}
            className={INPUT_BASE}
          >
            <option value="">{t(selectField.placeholderKey)}</option>
            {selectField.selectOptions?.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      );
    } else if (gridFields.length % 2 !== 0) {
      // Odd remaining grid fields — already handled above; just ensure no dangling field
    }

    return <>{rows}</>;
  };

  // ── Inline add/edit form (single-field: phone, email, url) ────────────────

  const renderInlineSingleFieldForm = (
    item: T,
    onItemChange: (updated: T) => void,
    onConfirm: () => void,
    onCancel: () => void,
    confirmLabel: string,
    isAddForm: boolean
  ): React.ReactNode => {
    const field = fieldConfig.fields[0];
    const accentBg = `bg-${fieldConfig.accentColor}-50 dark:bg-${fieldConfig.accentColor}-900/20`;
    const accentBorder = `border-${fieldConfig.accentColor}-200 dark:border-${fieldConfig.accentColor}-800`;

    return (
      <div
        className={`flex items-center gap-2 p-3 ${accentBg} rounded-lg border-2 ${accentBorder}`}
      >
        {typeOptions && (
          <TypeComboBox
            value={getFieldValue(item, 'type')}
            onChange={(val) => onItemChange({ ...item, type: val } as T)}
            options={typeOptions}
            placeholder={t('typePlaceholder')}
            className={`${INPUT_BASE} flex-shrink-0 w-32`}
          />
        )}
        <input
          type={field.inputType}
          value={getFieldValue(item, field.key)}
          onChange={(e) =>
            onItemChange(setFieldValue(item, field.key, e.target.value, field.inputType))
          }
          placeholder={t(field.placeholderKey)}
          aria-label={t(field.placeholderKey)}
          className={`flex-1 ${INPUT_BASE}`}
          autoFocus={isAddForm}
        />
        <button
          type="button"
          onClick={onConfirm}
          disabled={!isValid(item)}
          className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 bg-surface-elevated text-foreground rounded-lg hover:bg-surface-elevated/80"
        >
          {t('cancel')}
        </button>
      </div>
    );
  };

  // ── Block add form (multi-field: address, location, customField) ──────────

  const renderBlockForm = (
    item: T,
    onItemChange: (updated: T) => void,
    onConfirm: () => void,
    onCancel: () => void,
    confirmLabel: string
  ): React.ReactNode => {
    const accentBg = `bg-${fieldConfig.accentColor}-50 dark:bg-${fieldConfig.accentColor}-900/20`;
    const accentBorder = `border-${fieldConfig.accentColor}-200 dark:border-${fieldConfig.accentColor}-800`;

    // Custom field preset selector
    const customKeyElements: React.ReactNode[] = [];
    if (fieldConfig.keyEditable) {
      const cfItem = item as unknown as PersonCustomField;
      customKeyElements.push(
        <div key="preset">
          <label className="block text-xs font-medium text-foreground mb-1">
            {t('preset')}
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedPreset(val);
              if (val !== 'X-CUSTOM') {
                onItemChange({ ...item, key: val } as T);
              } else {
                onItemChange({ ...item, key: '' } as T);
              }
            }}
            aria-label={t('preset')}
            className={`w-full ${INPUT_BASE}`}
          >
            {CUSTOM_FIELD_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t(`presets.${preset.toLowerCase().replace('x-', '')}`)}
              </option>
            ))}
          </select>
        </div>
      );

      if (selectedPreset === 'X-CUSTOM') {
        customKeyElements.push(
          <input
            key="custom-key"
            type="text"
            value={cfItem.key}
            onChange={(e) => onItemChange({ ...item, key: e.target.value } as T)}
            placeholder={t('keyPlaceholder')}
            aria-label={t('keyPlaceholder')}
            className={`w-full ${INPUT_BASE}`}
            autoFocus
          />
        );
      }
    }

    return (
      <div className={`p-3 ${accentBg} rounded-lg border-2 ${accentBorder} space-y-2`}>
        {typeOptions && (
          <div className="flex gap-2">
            <TypeComboBox
              value={getFieldValue(item, 'type')}
              onChange={(val) => onItemChange({ ...item, type: val } as T)}
              options={typeOptions}
              placeholder={t('typePlaceholder')}
              className={`${INPUT_BASE} w-32`}
            />
          </div>
        )}
        {customKeyElements}
        {buildMultiFieldInputs(item, onItemChange)}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isValid(item)}
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 bg-surface-elevated text-foreground rounded-lg hover:bg-surface-elevated/80"
          >
            {t('cancel')}
          </button>
        </div>
        {fieldConfig.namespace === 'locations' && (
          <p className="text-xs text-muted">{t('coordinatesHelp')}</p>
        )}
      </div>
    );
  };

  // ── Edit form for existing item (inline wrapper) ──────────────────────────

  const renderEditInline = (item: T, onItemChange: (updated: T) => void): React.ReactNode => {
    if (!isMultiField) {
      // Single-field: render inline edit in a flex row (already inside the item row)
      const field = fieldConfig.fields[0];
      return (
        <>
          {typeOptions && (
            <TypeComboBox
              value={getFieldValue(item, 'type')}
              onChange={(val) => onItemChange({ ...item, type: val } as T)}
              options={typeOptions}
              placeholder={t('typePlaceholder')}
              className={`${INPUT_BASE} flex-shrink-0 w-32`}
            />
          )}
          <input
            type={field.inputType}
            value={getFieldValue(item, field.key)}
            onChange={(e) =>
              onItemChange(setFieldValue(item, field.key, e.target.value, field.inputType))
            }
            placeholder={t(field.placeholderKey)}
            aria-label={t(field.placeholderKey)}
            className={`flex-1 ${INPUT_BASE}`}
          />
          <button
            type="button"
            onClick={handleSaveEdit}
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-3 py-2 bg-surface-elevated text-foreground rounded-lg hover:bg-surface-elevated/80"
          >
            {t('cancel')}
          </button>
        </>
      );
    }

    // Multi-field edit form
    const customKeyEditElements: React.ReactNode[] = [];
    if (fieldConfig.keyEditable) {
      const cfItem = item as unknown as PersonCustomField;
      customKeyEditElements.push(
        <input
          key="edit-key"
          type="text"
          value={cfItem.key}
          onChange={(e) => onItemChange({ ...item, key: e.target.value } as T)}
          placeholder={t('keyPlaceholder')}
          aria-label={t('keyPlaceholder')}
          className={`w-full ${INPUT_BASE}`}
        />
      );
    }

    return (
      <div className="space-y-3 w-full">
        {typeOptions && (
          <div className="flex gap-2">
            <TypeComboBox
              value={getFieldValue(item, 'type')}
              onChange={(val) => onItemChange({ ...item, type: val } as T)}
              options={typeOptions}
              placeholder={t('typePlaceholder')}
              className={`${INPUT_BASE} w-32`}
            />
          </div>
        )}
        {customKeyEditElements}
        {buildMultiFieldInputs(item, onItemChange)}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveEdit}
            className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            {t('save')}
          </button>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-3 py-2 bg-surface-elevated text-foreground rounded-lg hover:bg-surface-elevated/80"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    );
  };

  // ── View mode item ────────────────────────────────────────────────────────

  const renderViewItem = (item: T, index: number): React.ReactNode => {
    const typeDisplay = typeOptions
      ? (typeOptions.find((o) => o.value === getFieldValue(item, 'type'))?.label ??
          getFieldValue(item, 'type'))
      : null;

    const badgeEl = typeDisplay ? (
      <span className={`text-xs px-2 py-1 rounded ${fieldConfig.badgeClasses}`}>
        {typeDisplay}
      </span>
    ) : null;

    const specialContent = renderSpecialViewContent(item);
    const summaryEl = specialContent ?? (
      <p className="text-sm text-foreground mt-1">
        {fieldConfig.formatSummary(item, t)}
      </p>
    );

    const editBtn = (
      <button
        type="button"
        onClick={() => handleStartEdit(index)}
        className="text-sm text-primary hover:text-primary-dark"
      >
        {t('edit')}
      </button>
    );

    const removeBtn = (
      <button
        type="button"
        onClick={() => handleRemove(index)}
        className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        {t('remove')}
      </button>
    );

    if (!isMultiField) {
      // Single-field inline layout
      return (
        <>
          <div className="flex-1">
            {badgeEl && (
              <div className="flex items-center gap-2 mb-1">{badgeEl}</div>
            )}
            {summaryEl}
          </div>
          {editBtn}
          {removeBtn}
        </>
      );
    }

    // Multi-field layout (address, location, custom)
    return (
      <>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">{badgeEl}</div>
          <div className="flex gap-2">
            {editBtn}
            {removeBtn}
          </div>
        </div>
        {summaryEl}
      </>
    );
  };

  // ── Add form ──────────────────────────────────────────────────────────────

  const addConfirmLabel = t('add');

  const addFormEl = isAdding
    ? isMultiField
      ? renderBlockForm(newItem, setNewItem, handleAdd, handleCancelAdd, addConfirmLabel)
      : renderInlineSingleFieldForm(
          newItem,
          setNewItem,
          handleAdd,
          handleCancelAdd,
          addConfirmLabel,
          true
        )
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-sm text-primary hover:text-primary-dark"
          >
            + {t('add')}
          </button>
        )}
      </div>

      {/* Optional description (custom fields) */}
      {fieldConfig.namespace === 'customFields' && (
        <p className="text-xs text-muted">{t('description')}</p>
      )}

      {/* Existing items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.id ?? `new-${index}`}
            className={`${isMultiField ? 'p-3' : 'flex items-center gap-2 p-3'} bg-surface-elevated rounded-lg`}
          >
            {editingIndex === index && editingItem
              ? renderEditInline(editingItem, (updated) => setEditingItem(updated))
              : renderViewItem(item, index)}
          </div>
        ))}
      </div>

      {/* Add form */}
      {addFormEl}

      {/* Empty state */}
      {items.length === 0 && !isAdding && (
        <p className="text-sm text-muted italic">{emptyText}</p>
      )}
    </div>
  );
}
