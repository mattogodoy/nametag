'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PersonEmail {
  id?: string;
  type: 'work' | 'home' | 'other';
  email: string;
  isPrimary?: boolean;
}

interface PersonEmailManagerProps {
  initialEmails?: PersonEmail[];
  onChange?: (emails: PersonEmail[]) => void;
}

const defaultNewEmail: PersonEmail = {
  type: 'home',
  email: '',
  isPrimary: false,
};

export default function PersonEmailManager({
  initialEmails = [],
  onChange,
}: PersonEmailManagerProps) {
  const t = useTranslations('people.form.emails');
  const [emails, setEmails] = useState<PersonEmail[]>(initialEmails);
  const [isAdding, setIsAdding] = useState(false);
  const [newEmail, setNewEmail] = useState<PersonEmail>({ ...defaultNewEmail });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingEmail, setEditingEmail] = useState<PersonEmail | null>(null);

  const handleAdd = () => {
    if (!newEmail.email.trim()) return;

    const emailToAdd: PersonEmail = {
      ...newEmail,
      id: undefined,
    };

    const updatedEmails = [...emails, emailToAdd];
    setEmails(updatedEmails);
    if (onChange) {
      onChange(updatedEmails);
    }
    setNewEmail({ ...defaultNewEmail });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingEmail({ ...emails[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingEmail) return;
    if (!editingEmail.email.trim()) return;

    const updatedEmails = [...emails];
    updatedEmails[editingIndex] = {
      ...editingEmail,
      id: emails[editingIndex].id,
    };

    setEmails(updatedEmails);
    if (onChange) {
      onChange(updatedEmails);
    }
    setEditingIndex(null);
    setEditingEmail(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingEmail(null);
  };

  const handleRemove = (index: number) => {
    const updatedEmails = emails.filter((_, i) => i !== index);
    setEmails(updatedEmails);
    if (onChange) {
      onChange(updatedEmails);
    }
  };

  const handleSetPrimary = (index: number) => {
    const updatedEmails = emails.map((email, i) => ({
      ...email,
      isPrimary: i === index,
    }));
    setEmails(updatedEmails);
    if (onChange) {
      onChange(updatedEmails);
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

      {/* Existing emails */}
      <div className="space-y-2">
        {emails.map((email, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingEmail ? (
              <>
                <select
                  value={editingEmail.type}
                  onChange={(e) =>
                    setEditingEmail({
                      ...editingEmail,
                      type: e.target.value as PersonEmail['type'],
                    })
                  }
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0"
                >
                  <option value="home">{t('types.home')}</option>
                  <option value="work">{t('types.work')}</option>
                  <option value="other">{t('types.other')}</option>
                </select>
                <input
                  type="email"
                  value={editingEmail.email}
                  onChange={(e) =>
                    setEditingEmail({ ...editingEmail, email: e.target.value })
                  }
                  placeholder={t('emailPlaceholder')}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                      {t(`types.${email.type}`)}
                    </span>
                    {email.isPrimary && (
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {t('primary')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {email.email}
                  </p>
                </div>
                {!email.isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(index)}
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    {t('setPrimary')}
                  </button>
                )}
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

      {/* Add new email */}
      {isAdding && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
          <select
            value={newEmail.type}
            onChange={(e) =>
              setNewEmail({
                ...newEmail,
                type: e.target.value as PersonEmail['type'],
              })
            }
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0"
          >
            <option value="home">{t('types.home')}</option>
            <option value="work">{t('types.work')}</option>
            <option value="other">{t('types.other')}</option>
          </select>
          <input
            type="email"
            value={newEmail.email}
            onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
            placeholder={t('emailPlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newEmail.isPrimary}
              onChange={(e) =>
                setNewEmail({ ...newEmail, isPrimary: e.target.checked })
              }
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('primary')}
            </span>
          </label>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newEmail.email.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewEmail({ ...defaultNewEmail });
            }}
            className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {emails.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noEmails')}
        </p>
      )}
    </div>
  );
}
