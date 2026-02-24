'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import TypeComboBox from './TypeComboBox';

interface PersonUrl {
  id?: string;
  type: string;
  url: string;
}

interface PersonUrlManagerProps {
  initialUrls?: PersonUrl[];
  onChange?: (urls: PersonUrl[]) => void;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

const defaultNewUrl: PersonUrl = {
  type: 'Personal',
  url: '',
};

export default function PersonUrlManager({
  initialUrls = [],
  onChange,
}: PersonUrlManagerProps) {
  const t = useTranslations('people.form.urls');
  const [urls, setUrls] = useState<PersonUrl[]>(initialUrls);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState<PersonUrl>({ ...defaultNewUrl });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingUrl, setEditingUrl] = useState<PersonUrl | null>(null);

  const handleAdd = () => {
    if (!newUrl.url.trim()) return;

    const urlToAdd: PersonUrl = {
      ...newUrl,
      id: undefined,
    };

    const updatedUrls = [...urls, urlToAdd];
    setUrls(updatedUrls);
    if (onChange) {
      onChange(updatedUrls);
    }
    setNewUrl({ ...defaultNewUrl });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingUrl({ ...urls[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingUrl) return;
    if (!editingUrl.url.trim()) return;

    const updatedUrls = [...urls];
    updatedUrls[editingIndex] = {
      ...editingUrl,
      id: urls[editingIndex].id,
    };

    setUrls(updatedUrls);
    if (onChange) {
      onChange(updatedUrls);
    }
    setEditingIndex(null);
    setEditingUrl(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingUrl(null);
  };

  const handleRemove = (index: number) => {
    const updatedUrls = urls.filter((_, i) => i !== index);
    setUrls(updatedUrls);
    if (onChange) {
      onChange(updatedUrls);
    }
  };

  const typeOptions = [
    { value: 'Personal', label: t('types.personal') },
    { value: 'Work', label: t('types.work') },
    { value: 'Other', label: t('types.other') },
  ];

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

      {/* Existing URLs */}
      <div className="space-y-2">
        {urls.map((urlItem, index) => (
          <div
            key={urlItem.id || `new-${index}`}
            className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingUrl ? (
              <>
                <TypeComboBox
                  value={editingUrl.type}
                  onChange={(newType) =>
                    setEditingUrl({
                      ...editingUrl,
                      type: newType,
                    })
                  }
                  options={typeOptions}
                  placeholder={t('typePlaceholder')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0 w-32"
                />
                <input
                  type="url"
                  value={editingUrl.url}
                  onChange={(e) =>
                    setEditingUrl({ ...editingUrl, url: e.target.value })
                  }
                  placeholder={t('urlPlaceholder')}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
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
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-1 bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded">
                      {urlItem.type}
                    </span>
                  </div>
                  {isSafeUrl(urlItem.url) ? (
                    <a
                      href={urlItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {urlItem.url}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-900 dark:text-gray-100 break-all">
                      {urlItem.url}
                    </span>
                  )}
                </div>
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
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new URL */}
      {isAdding && (
        <div className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
          <TypeComboBox
            value={newUrl.type}
            onChange={(newType) =>
              setNewUrl({
                ...newUrl,
                type: newType,
              })
            }
            options={typeOptions}
            placeholder={t('typePlaceholder')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0 w-32"
          />
          <input
            type="url"
            value={newUrl.url}
            onChange={(e) => setNewUrl({ ...newUrl, url: e.target.value })}
            placeholder={t('urlPlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newUrl.url.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewUrl({ ...defaultNewUrl });
            }}
            className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {urls.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noUrls')}
        </p>
      )}
    </div>
  );
}
