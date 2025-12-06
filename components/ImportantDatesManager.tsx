'use client';

import { useState } from 'react';

type ReminderType = 'ONCE' | 'RECURRING';
type ReminderIntervalUnit = 'WEEKS' | 'MONTHS' | 'YEARS';

interface ImportantDate {
  id?: string;
  title: string;
  date: string; // ISO date string
  reminderEnabled?: boolean;
  reminderType?: ReminderType | null;
  reminderInterval?: number | null;
  reminderIntervalUnit?: ReminderIntervalUnit | null;
}

interface ImportantDatesManagerProps {
  personId?: string;
  initialDates?: ImportantDate[];
  onChange?: (dates: ImportantDate[]) => void;
  mode: 'create' | 'edit';
}

const defaultNewDate: ImportantDate = {
  title: '',
  date: '',
  reminderEnabled: false,
  reminderType: null,
  reminderInterval: 1,
  reminderIntervalUnit: 'YEARS',
};

export default function ImportantDatesManager({
  personId,
  initialDates = [],
  onChange,
  mode,
}: ImportantDatesManagerProps) {
  const [dates, setDates] = useState<ImportantDate[]>(initialDates);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState<ImportantDate>({ ...defaultNewDate });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<ImportantDate | null>(null);

  const isDateInFuture = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const handleAdd = () => {
    if (!newDate.title.trim() || !newDate.date) return;

    const dateToAdd: ImportantDate = {
      ...newDate,
      id: undefined,
      reminderType: newDate.reminderEnabled ? newDate.reminderType : null,
      reminderInterval: newDate.reminderEnabled && newDate.reminderType === 'RECURRING' ? newDate.reminderInterval : null,
      reminderIntervalUnit: newDate.reminderEnabled && newDate.reminderType === 'RECURRING' ? newDate.reminderIntervalUnit : null,
    };

    const updatedDates = [...dates, dateToAdd];
    setDates(updatedDates);
    if (onChange) {
      onChange(updatedDates);
    }
    setNewDate({ ...defaultNewDate });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingDate({
      ...dates[index],
      reminderInterval: dates[index].reminderInterval ?? 1,
      reminderIntervalUnit: dates[index].reminderIntervalUnit ?? 'YEARS',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDate || editingIndex === null) return;
    if (!editingDate.title.trim() || !editingDate.date) return;

    const dateToSave: ImportantDate = {
      ...editingDate,
      reminderType: editingDate.reminderEnabled ? editingDate.reminderType : null,
      reminderInterval: editingDate.reminderEnabled && editingDate.reminderType === 'RECURRING' ? editingDate.reminderInterval : null,
      reminderIntervalUnit: editingDate.reminderEnabled && editingDate.reminderType === 'RECURRING' ? editingDate.reminderIntervalUnit : null,
    };

    if (dateToSave.id && mode === 'edit' && personId) {
      try {
        const response = await fetch(`/api/people/${personId}/important-dates/${dateToSave.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: dateToSave.title,
            date: dateToSave.date,
            reminderEnabled: dateToSave.reminderEnabled,
            reminderType: dateToSave.reminderType,
            reminderInterval: dateToSave.reminderInterval,
            reminderIntervalUnit: dateToSave.reminderIntervalUnit,
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
    updatedDates[editingIndex] = dateToSave;
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

  const getReminderDescription = (date: ImportantDate) => {
    if (!date.reminderEnabled) return null;
    if (date.reminderType === 'ONCE') {
      return 'Remind once';
    }
    if (date.reminderType === 'RECURRING' && date.reminderInterval && date.reminderIntervalUnit) {
      const unit = date.reminderIntervalUnit.toLowerCase();
      return `Remind every ${date.reminderInterval} ${date.reminderInterval === 1 ? unit.slice(0, -1) : unit}`;
    }
    return null;
  };

  const ReminderFields = ({
    date,
    onChange,
    idPrefix,
  }: {
    date: ImportantDate;
    onChange: (updates: Partial<ImportantDate>) => void;
    idPrefix: string;
  }) => {
    const isFuture = isDateInFuture(date.date);

    return (
      <div className="mt-3 pt-3 border-t border-base-content/10">
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id={`${idPrefix}-reminder-toggle`}
            checked={date.reminderEnabled}
            onChange={() => onChange({
              reminderEnabled: !date.reminderEnabled,
              reminderType: !date.reminderEnabled ? (isFuture ? 'ONCE' : 'RECURRING') : date.reminderType,
            })}
            className="toggle toggle-primary toggle-sm"
          />
          <label
            htmlFor={`${idPrefix}-reminder-toggle`}
            className="text-xs font-medium"
          >
            Remind me
          </label>
        </div>

        {date.reminderEnabled && (
          <div className="space-y-3">
            <div className="space-y-2">
              {isFuture && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`${idPrefix}-reminder-type`}
                    checked={date.reminderType === 'ONCE'}
                    onChange={() => onChange({ reminderType: 'ONCE' })}
                    className="radio radio-primary radio-sm"
                  />
                  <span className="text-xs">
                    Only once on the specified date
                  </span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer flex-wrap">
                <input
                  type="radio"
                  name={`${idPrefix}-reminder-type`}
                  checked={date.reminderType === 'RECURRING'}
                  onChange={() => onChange({ reminderType: 'RECURRING' })}
                  className="radio radio-primary radio-sm"
                />
                <span className="text-xs">Every</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={date.reminderInterval ?? 1}
                  onChange={(e) => onChange({ reminderInterval: Math.max(1, parseInt(e.target.value) || 1) })}
                  disabled={date.reminderType !== 'RECURRING'}
                  className="input input-xs w-14"
                />
                <select
                  value={date.reminderIntervalUnit ?? 'YEARS'}
                  onChange={(e) => onChange({ reminderIntervalUnit: e.target.value as ReminderIntervalUnit })}
                  disabled={date.reminderType !== 'RECURRING'}
                  className="select select-xs"
                >
                  <option value="WEEKS">weeks</option>
                  <option value="MONTHS">months</option>
                  <option value="YEARS">years</option>
                </select>
                <span className={`text-xs ${date.reminderType === 'RECURRING' ? '' : 'opacity-50'}`}>
                  starting from the specified date
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {!isAdding && editingIndex === null && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="btn btn-ghost btn-sm text-primary"
          >
            <span className="icon-[tabler--plus] size-4" />
            Add Date
          </button>
        </div>
      )}

      <div className="space-y-2">
        {dates.map((date, index) => (
          <div
            key={index}
            className="card bg-base-200 p-3"
          >
            {editingIndex === index && editingDate ? (
              <div className="space-y-3">
                <div className="form-control">
                  <label htmlFor={`edit-date-title-${index}`} className="label py-1">
                    <span className="label-text text-xs">Title</span>
                  </label>
                  <input
                    type="text"
                    id={`edit-date-title-${index}`}
                    value={editingDate.title}
                    onChange={(e) => setEditingDate({ ...editingDate, title: e.target.value })}
                    className="input input-sm"
                  />
                </div>
                <div className="form-control">
                  <label htmlFor={`edit-date-date-${index}`} className="label py-1">
                    <span className="label-text text-xs">Date</span>
                  </label>
                  <input
                    type="date"
                    id={`edit-date-date-${index}`}
                    value={editingDate.date}
                    onChange={(e) => setEditingDate({ ...editingDate, date: e.target.value })}
                    className="input input-sm"
                  />
                </div>
                <ReminderFields
                  date={editingDate}
                  onChange={(updates) => setEditingDate({ ...editingDate, ...updates })}
                  idPrefix={`edit-${index}`}
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn btn-ghost btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={!editingDate.title.trim() || !editingDate.date}
                    className="btn btn-primary btn-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {date.title}
                  </div>
                  <div className="text-xs text-base-content/60">
                    {new Date(date.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  {getReminderDescription(date) && (
                    <div className="text-xs text-primary mt-1 flex items-center gap-1">
                      <span className="icon-[tabler--bell] size-3" />
                      {getReminderDescription(date)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(index)}
                    disabled={editingIndex !== null || isAdding}
                    className="btn btn-ghost btn-square btn-sm"
                    title="Edit"
                  >
                    <span className="icon-[tabler--edit] size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index, date.id)}
                    disabled={editingIndex !== null || isAdding}
                    className="btn btn-ghost btn-square btn-sm text-error"
                    title="Delete"
                  >
                    <span className="icon-[tabler--trash] size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="card bg-base-200 p-3 space-y-3">
            <div className="form-control">
              <label htmlFor="new-date-title" className="label py-1">
                <span className="label-text text-xs">Title</span>
              </label>
              <input
                type="text"
                id="new-date-title"
                value={newDate.title}
                onChange={(e) => setNewDate({ ...newDate, title: e.target.value })}
                placeholder="e.g., Birthday, Anniversary"
                className="input input-sm"
                autoFocus
              />
            </div>
            <div className="form-control">
              <label htmlFor="new-date-date" className="label py-1">
                <span className="label-text text-xs">Date</span>
              </label>
              <input
                type="date"
                id="new-date-date"
                value={newDate.date}
                onChange={(e) => setNewDate({ ...newDate, date: e.target.value })}
                className="input input-sm"
              />
            </div>
            <ReminderFields
              date={newDate}
              onChange={(updates) => setNewDate({ ...newDate, ...updates })}
              idPrefix="new"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewDate({ ...defaultNewDate });
                }}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!newDate.title.trim() || !newDate.date}
                className="btn btn-primary btn-sm"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {dates.length === 0 && !isAdding && (
          <p className="text-sm text-base-content/60 py-2">
            No important dates added yet.
          </p>
        )}
      </div>
    </div>
  );
}
