'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import TypeComboBox from './TypeComboBox';

interface PersonPhone {
  id?: string;
  type: string;
  number: string;
}

interface PersonPhoneManagerProps {
  initialPhones?: PersonPhone[];
  onChange?: (phones: PersonPhone[]) => void;
}

const defaultNewPhone: PersonPhone = {
  type: 'Mobile',
  number: '',
};

export default function PersonPhoneManager({
  initialPhones = [],
  onChange,
}: PersonPhoneManagerProps) {
  const t = useTranslations('people.form.phones');
  const [phones, setPhones] = useState<PersonPhone[]>(initialPhones);
  const [isAdding, setIsAdding] = useState(false);
  const [newPhone, setNewPhone] = useState<PersonPhone>({ ...defaultNewPhone });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingPhone, setEditingPhone] = useState<PersonPhone | null>(null);

  const handleAdd = () => {
    if (!newPhone.number.trim()) return;

    const phoneToAdd: PersonPhone = {
      ...newPhone,
      id: undefined,
    };

    const updatedPhones = [...phones, phoneToAdd];
    setPhones(updatedPhones);
    if (onChange) {
      onChange(updatedPhones);
    }
    setNewPhone({ ...defaultNewPhone });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingPhone({ ...phones[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingPhone) return;
    if (!editingPhone.number.trim()) return;

    const updatedPhones = [...phones];
    updatedPhones[editingIndex] = {
      ...editingPhone,
      id: phones[editingIndex].id,
    };

    setPhones(updatedPhones);
    if (onChange) {
      onChange(updatedPhones);
    }
    setEditingIndex(null);
    setEditingPhone(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingPhone(null);
  };

  const handleRemove = (index: number) => {
    const updatedPhones = phones.filter((_, i) => i !== index);
    setPhones(updatedPhones);
    if (onChange) {
      onChange(updatedPhones);
    }
  };

  const typeOptions = [
    { value: 'Mobile', label: t('types.mobile') },
    { value: 'Home', label: t('types.home') },
    { value: 'Work', label: t('types.work') },
    { value: 'Fax', label: t('types.fax') },
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

      {/* Existing phones */}
      <div className="space-y-2">
        {phones.map((phone, index) => (
          <div
            key={phone.id || `new-${index}`}
            className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingPhone ? (
              <>
                <TypeComboBox
                  value={editingPhone.type}
                  onChange={(newType) =>
                    setEditingPhone({
                      ...editingPhone,
                      type: newType,
                    })
                  }
                  options={typeOptions}
                  placeholder={t('typePlaceholder')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0 w-32"
                />
                <input
                  type="tel"
                  value={editingPhone.number}
                  onChange={(e) =>
                    setEditingPhone({ ...editingPhone, number: e.target.value })
                  }
                  placeholder={t('numberPlaceholder')}
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
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {phone.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                    {phone.number}
                  </p>
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

      {/* Add new phone */}
      {isAdding && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <TypeComboBox
            value={newPhone.type}
            onChange={(newType) =>
              setNewPhone({
                ...newPhone,
                type: newType,
              })
            }
            options={typeOptions}
            placeholder={t('typePlaceholder')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-shrink-0 w-32"
          />
          <input
            type="tel"
            value={newPhone.number}
            onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })}
            placeholder={t('numberPlaceholder')}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newPhone.number.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('add')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewPhone({ ...defaultNewPhone });
            }}
            className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {phones.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noPhones')}
        </p>
      )}
    </div>
  );
}
