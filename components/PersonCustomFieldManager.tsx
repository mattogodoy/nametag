'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PersonCustomField {
  id?: string;
  key: string;
  value: string;
  type?: string;
}

interface PersonCustomFieldManagerProps {
  initialFields?: PersonCustomField[];
  onChange?: (fields: PersonCustomField[]) => void;
}

const defaultNewField: PersonCustomField = {
  key: '',
  value: '',
};

// Common custom field presets
const COMMON_FIELDS = [
  'X-SPOUSE',
  'X-MANAGER',
  'X-ASSISTANT',
  'X-TWITTER',
  'X-LINKEDIN',
  'X-FACEBOOK',
  'X-INSTAGRAM',
  'X-GITHUB',
  'X-CUSTOM',
] as const;

export default function PersonCustomFieldManager({
  initialFields = [],
  onChange,
}: PersonCustomFieldManagerProps) {
  const t = useTranslations('people.form.customFields');
  const [fields, setFields] = useState<PersonCustomField[]>(initialFields);
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState<PersonCustomField>({ ...defaultNewField });
  const [selectedPreset, setSelectedPreset] = useState<string>('X-CUSTOM');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<PersonCustomField | null>(null);

  const handleAdd = () => {
    if (!newField.key.trim() || !newField.value.trim()) return;

    // Ensure key starts with X- for vCard compatibility
    const key = newField.key.startsWith('X-')
      ? newField.key.toUpperCase()
      : `X-${newField.key.toUpperCase()}`;

    const fieldToAdd: PersonCustomField = {
      key,
      value: newField.value.trim(),
      id: undefined,
    };

    const updatedFields = [...fields, fieldToAdd];
    setFields(updatedFields);
    if (onChange) {
      onChange(updatedFields);
    }
    setNewField({ ...defaultNewField });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingField({ ...fields[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingField) return;
    if (!editingField.key.trim() || !editingField.value.trim()) return;

    // Ensure key starts with X- for vCard compatibility
    const key = editingField.key.startsWith('X-')
      ? editingField.key.toUpperCase()
      : `X-${editingField.key.toUpperCase()}`;

    const updatedFields = [...fields];
    updatedFields[editingIndex] = {
      ...editingField,
      key,
      value: editingField.value.trim(),
      id: fields[editingIndex].id,
    };

    setFields(updatedFields);
    if (onChange) {
      onChange(updatedFields);
    }
    setEditingIndex(null);
    setEditingField(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingField(null);
  };

  const handleRemove = (index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index);
    setFields(updatedFields);
    if (onChange) {
      onChange(updatedFields);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('label')}
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            + {t('add')}
          </button>
        )}
      </div>

      {/* Info text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('description')}
      </p>

      {/* Existing Fields */}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id || `new-${index}`}
            className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingField ? (
              <>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={editingField.key}
                    onChange={(e) =>
                      setEditingField({ ...editingField, key: e.target.value })
                    }
                    placeholder={t('keyPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <textarea
                    value={editingField.value}
                    onChange={(e) =>
                      setEditingField({ ...editingField, value: e.target.value })
                    }
                    placeholder={t('valuePlaceholder')}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {t('save')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="mb-1">
                    <span className="text-xs font-mono px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                      {field.key}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {field.value}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(index)}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    {t('remove')}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new field */}
      {isAdding && (
        <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
          {/* Preset selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('preset')}
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                if (e.target.value !== 'X-CUSTOM') {
                  setNewField({ ...newField, key: e.target.value });
                } else {
                  setNewField({ ...newField, key: '' });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {COMMON_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {t(`presets.${field.toLowerCase().replace('x-', '')}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom key input (only if X-CUSTOM selected) */}
          {selectedPreset === 'X-CUSTOM' && (
            <input
              type="text"
              value={newField.key}
              onChange={(e) => setNewField({ ...newField, key: e.target.value })}
              placeholder={t('keyPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
          )}

          {/* Value input */}
          <textarea
            value={newField.value}
            onChange={(e) => setNewField({ ...newField, value: e.target.value })}
            placeholder={t('valuePlaceholder')}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus={selectedPreset !== 'X-CUSTOM'}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newField.key.trim() || !newField.value.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('add')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewField({ ...defaultNewField });
                setSelectedPreset('X-CUSTOM');
              }}
              className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {fields.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noFields')}
        </p>
      )}
    </div>
  );
}
