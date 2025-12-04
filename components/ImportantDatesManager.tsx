'use client';

import { useState } from 'react';

interface ImportantDate {
  id?: string;
  title: string;
  date: string; // ISO date string
}

interface ImportantDatesManagerProps {
  personId?: string;
  initialDates?: ImportantDate[];
  onChange?: (dates: ImportantDate[]) => void;
  mode: 'create' | 'edit';
}

export default function ImportantDatesManager({
  personId,
  initialDates = [],
  onChange,
  mode,
}: ImportantDatesManagerProps) {
  const [dates, setDates] = useState<ImportantDate[]>(initialDates);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState({ title: '', date: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<ImportantDate | null>(null);

  const handleAdd = () => {
    if (!newDate.title.trim() || !newDate.date) return;

    const updatedDates = [...dates, { ...newDate, id: undefined }];
    setDates(updatedDates);
    if (onChange) {
      onChange(updatedDates);
    }
    setNewDate({ title: '', date: '' });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingDate({ ...dates[index] });
  };

  const handleSaveEdit = async () => {
    if (!editingDate || editingIndex === null) return;
    if (!editingDate.title.trim() || !editingDate.date) return;

    if (editingDate.id && mode === 'edit' && personId) {
      // Update in database
      try {
        const response = await fetch(`/api/people/${personId}/important-dates/${editingDate.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: editingDate.title,
            date: editingDate.date,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update important date');
        }
      } catch (error) {
        console.error('Error updating important date:', error);
        return;
      }
    }

    const updatedDates = [...dates];
    updatedDates[editingIndex] = editingDate;
    setDates(updatedDates);
    if (onChange) {
      onChange(updatedDates);
    }
    setEditingIndex(null);
    setEditingDate(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingDate(null);
  };

  const handleDelete = async (index: number, id?: string) => {
    if (id && mode === 'edit' && personId) {
      // Delete from database
      try {
        const response = await fetch(`/api/people/${personId}/important-dates/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete important date');
        }
      } catch (error) {
        console.error('Error deleting important date:', error);
        return;
      }
    }

    const updatedDates = dates.filter((_, i) => i !== index);
    setDates(updatedDates);
    if (onChange) {
      onChange(updatedDates);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Important Dates
        </label>
        {!isAdding && editingIndex === null && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
          >
            + Add Date
          </button>
        )}
      </div>

      <div className="space-y-2">
        {dates.map((date, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            {editingIndex === index ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={`edit-date-title-${index}`}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id={`edit-date-title-${index}`}
                    value={editingDate?.title || ''}
                    onChange={(e) => setEditingDate(editingDate ? { ...editingDate, title: e.target.value } : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`edit-date-date-${index}`}
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    id={`edit-date-date-${index}`}
                    value={editingDate?.date || ''}
                    onChange={(e) => setEditingDate(editingDate ? { ...editingDate, date: e.target.value } : null)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!editingDate?.title.trim() || !editingDate?.date}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {date.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(date.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(index)}
                    disabled={editingIndex !== null || isAdding}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    onClick={() => handleDelete(index, date.id)}
                    disabled={editingIndex !== null || isAdding}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            )}
          </div>
        ))}

        {isAdding && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
            <div>
              <label
                htmlFor="new-date-title"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Title
              </label>
              <input
                type="text"
                id="new-date-title"
                value={newDate.title}
                onChange={(e) => setNewDate({ ...newDate, title: e.target.value })}
                placeholder="e.g., Birthday, Anniversary"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="new-date-date"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Date
              </label>
              <input
                type="date"
                id="new-date-date"
                value={newDate.date}
                onChange={(e) => setNewDate({ ...newDate, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewDate({ title: '', date: '' });
                }}
                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newDate.title.trim() || !newDate.date}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {dates.length === 0 && !isAdding && (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
            No important dates added yet.
          </p>
        )}
      </div>
    </div>
  );
}
