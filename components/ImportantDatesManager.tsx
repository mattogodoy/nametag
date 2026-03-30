'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseAsLocalDate, formatDate, formatDateWithoutYear } from '@/lib/date-format';
import DatePicker from './ui/DatePicker';
import ComboboxInput from './ui/ComboboxInput';
import { PREDEFINED_DATE_TYPES, getDateDisplayTitle } from '@/lib/important-date-types';

type ReminderType = 'ONCE' | 'RECURRING';
type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

interface ImportantDate {
  id?: string;
  type?: string | null;
  title: string;
  date: string; // ISO date string
  yearUnknown?: boolean;
  reminderEnabled?: boolean;
  reminderType?: ReminderType | null;
  reminderInterval?: number | null;
  reminderIntervalUnit?: ReminderIntervalUnit | null;
}

interface ReminderLimitInfo {
  canCreate: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

interface ImportantDatesManagerProps {
  personId?: string;
  initialDates?: ImportantDate[];
  onChange?: (dates: ImportantDate[]) => void;
  mode: 'create' | 'edit';
  dateFormat?: 'MDY' | 'DMY' | 'YMD';
  reminderLimit?: ReminderLimitInfo;
}

const defaultNewDate: ImportantDate = {
  type: null,
  title: '',
  date: '',
  yearUnknown: false,
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
  dateFormat = 'MDY',
  reminderLimit,
}: ImportantDatesManagerProps) {
  const t = useTranslations('people.form.importantDates');
  const tForm = useTranslations('people.form');

  const comboboxOptions = PREDEFINED_DATE_TYPES.map((type) => ({
    value: type,
    label: t(`types.${type}`),
  }));
  const otherLabel = t('types.other');

  const [dates, setDates] = useState<ImportantDate[]>(initialDates);
  const [isAdding, setIsAdding] = useState(false);
  const [newDate, setNewDate] = useState<ImportantDate>({ ...defaultNewDate });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState<ImportantDate | null>(null);

  // Helper to extract month/day from yearless date (ignores year)
  const handleYearlessDateChange = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      // Extract month and day, set year to 1604 (Apple's convention for unknown year)
      return `1604-${parts[1]}-${parts[2]}`;
    }
    return isoDate;
  };

  // Count currently enabled reminders in local state (for new dates being added)
  const newDateHasReminder = newDate.reminderEnabled ? 1 : 0;
  const editingDateAddsReminder = editingDate?.reminderEnabled && editingIndex !== null && !dates[editingIndex]?.reminderEnabled ? 1 : 0;

  // Check if user can add more reminders
  const canAddReminder = !reminderLimit || reminderLimit.isUnlimited ||
    (reminderLimit.current + newDateHasReminder + editingDateAddsReminder) < reminderLimit.limit;

  const isDateInFuture = (dateStr: string) => {
    if (!dateStr) return false;
    const date = parseAsLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const handleAdd = () => {
    if ((!newDate.type && !newDate.title.trim()) || !newDate.date) return;

    // If year unknown, set year to 1604 (Apple's convention for unknown year)
    let finalDate = newDate.date;
    if (newDate.yearUnknown && newDate.date) {
      const dateParts = newDate.date.split('-');
      if (dateParts.length === 3) {
        finalDate = `1604-${dateParts[1]}-${dateParts[2]}`;
      }
    }

    const dateToAdd: ImportantDate = {
      ...newDate,
      date: finalDate,
      id: undefined,
      // Clear reminder fields if not enabled
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
    const dateToEdit = dates[index];
    const yearUnknown = dateToEdit.date.startsWith('1604-');
    setEditingDate({
      ...dateToEdit,
      yearUnknown,
      reminderInterval: dateToEdit.reminderInterval ?? 1,
      reminderIntervalUnit: dateToEdit.reminderIntervalUnit ?? 'YEARS',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDate || editingIndex === null) return;
    if ((!editingDate.type && !editingDate.title.trim()) || !editingDate.date) return;

    // If year unknown, set year to 1604 (Apple's convention for unknown year)
    let finalDate = editingDate.date;
    if (editingDate.yearUnknown && editingDate.date) {
      const dateParts = editingDate.date.split('-');
      if (dateParts.length === 3) {
        finalDate = `1604-${dateParts[1]}-${dateParts[2]}`;
      }
    }

    const dateToSave: ImportantDate = {
      ...editingDate,
      date: finalDate,
      reminderType: editingDate.reminderEnabled ? editingDate.reminderType : null,
      reminderInterval: editingDate.reminderEnabled && editingDate.reminderType === 'RECURRING' ? editingDate.reminderInterval : null,
      reminderIntervalUnit: editingDate.reminderEnabled && editingDate.reminderType === 'RECURRING' ? editingDate.reminderIntervalUnit : null,
    };

    if (dateToSave.id && mode === 'edit' && personId) {
      // Update in database
      try {
        const response = await fetch(`/api/people/${personId}/important-dates/${dateToSave.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: dateToSave.type ?? null,
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

  const getReminderDescription = (date: ImportantDate) => {
    if (!date.reminderEnabled) return null;
    if (date.reminderType === 'ONCE') {
      return t('remindOnceShort');
    }
    if (date.reminderType === 'RECURRING' && date.reminderInterval && date.reminderIntervalUnit) {
      const unit = date.reminderIntervalUnit.toLowerCase();
      const translatedUnit = date.reminderInterval === 1 ? tForm(unit.slice(0, -1)) : tForm(unit);
      return t('remindEveryShort', { interval: date.reminderInterval, unit: translatedUnit });
    }
    return null;
  };

  const ReminderFields = ({
    date,
    onChange,
    idPrefix,
    canEnable,
    limitMessage,
  }: {
    date: ImportantDate;
    onChange: (updates: Partial<ImportantDate>) => void;
    idPrefix: string;
    canEnable: boolean;
    limitMessage?: string;
  }) => {
    const isFuture = isDateInFuture(date.date);
    // Can toggle on if: already enabled (to disable) OR canEnable is true
    const canToggle = date.reminderEnabled || canEnable;

    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            id={`${idPrefix}-reminder-toggle`}
            disabled={!canToggle}
            onClick={() => {
              if (!canToggle) return;
              onChange({
                reminderEnabled: !date.reminderEnabled,
                reminderType: !date.reminderEnabled ? (isFuture ? 'ONCE' : 'RECURRING') : date.reminderType,
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              date.reminderEnabled ? 'bg-primary' : 'bg-surface-elevated'
            } ${!canToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                date.reminderEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <label
            htmlFor={`${idPrefix}-reminder-toggle`}
            className={`text-xs font-medium ${canToggle ? 'text-muted' : 'text-muted'}`}
          >
            {t('remindMe')}
          </label>
        </div>
        {!canToggle && limitMessage && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
            {t('reminderLimitReached', { limit: reminderLimit?.limit ?? 0 })}
          </p>
        )}

        {date.reminderEnabled && (
          <div className="space-y-3">
            <div className="space-y-2">
              {isFuture && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`${idPrefix}-reminder-type`}
                    checked={date.reminderType === 'ONCE'}
                    onChange={() => onChange({ reminderType: 'ONCE' })}
                    className="h-4 w-4 text-primary border-border focus:ring-primary"
                  />
                  <span className="text-xs text-muted">
                    {t('onlyOnce')}
                  </span>
                </label>
              )}
              <label className="flex items-center space-x-2 cursor-pointer flex-wrap gap-y-1">
                <input
                  type="radio"
                  name={`${idPrefix}-reminder-type`}
                  checked={date.reminderType === 'RECURRING'}
                  onChange={() => onChange({ reminderType: 'RECURRING' })}
                  className="h-4 w-4 text-primary border-border focus:ring-primary"
                />
                <span className="text-xs text-muted">{t('every')}</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={date.reminderInterval ?? 1}
                  onChange={(e) => onChange({ reminderInterval: Math.max(1, parseInt(e.target.value) || 1) })}
                  disabled={date.reminderType !== 'RECURRING'}
                  className="w-14 px-2 py-1 text-xs border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <select
                  value={date.reminderIntervalUnit ?? 'YEARS'}
                  onChange={(e) => onChange({ reminderIntervalUnit: e.target.value as ReminderIntervalUnit })}
                  disabled={date.reminderType !== 'RECURRING'}
                  className="px-2 py-1 text-xs border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="DAYS">{tForm('days')}</option>
                  <option value="WEEKS">{tForm('weeks')}</option>
                  <option value="MONTHS">{tForm('months')}</option>
                  <option value="YEARS">{tForm('years')}</option>
                </select>
                <span className={`text-xs ${date.reminderType === 'RECURRING' ? 'text-muted' : 'text-muted'}`}>
                  {t('startingFrom')}
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
            className="text-sm text-primary hover:text-primary-dark transition-colors"
          >
            {t('addDate')}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {dates.map((date, index) => (
          <div
            key={index}
            className="p-3 bg-surface-elevated rounded-lg"
          >
            {editingIndex === index && editingDate ? (
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={`edit-date-title-${index}`}
                    className="block text-xs font-medium text-muted mb-1"
                  >
                    {t('title')}
                  </label>
                  <ComboboxInput
                    options={comboboxOptions}
                    value={editingDate.type ?? null}
                    customText={editingDate.title}
                    onChange={(type, customText) => {
                      if (type) {
                        setEditingDate({ ...editingDate, type, title: '' });
                      } else {
                        setEditingDate({ ...editingDate, type: null, title: customText ?? '' });
                      }
                    }}
                    placeholder={t('titlePlaceholder')}
                    id={`edit-date-title-${index}`}
                    otherLabel={`${otherLabel}...`}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`edit-date-date-${index}`}
                    className="block text-xs font-medium text-muted mb-1"
                  >
                    {t('date')}
                  </label>
                  <DatePicker
                    value={editingDate.date}
                    onChange={(val) => {
                      const value = editingDate.yearUnknown
                        ? handleYearlessDateChange(val)
                        : val;
                      setEditingDate({ ...editingDate, date: value });
                    }}
                    dateFormat={dateFormat}
                    showYearToggle
                    yearUnknown={editingDate.yearUnknown}
                    onYearUnknownChange={(val) => setEditingDate({ ...editingDate, yearUnknown: val })}
                  />
                </div>
                <ReminderFields
                  date={editingDate}
                  onChange={(updates) => setEditingDate({ ...editingDate, ...updates })}
                  idPrefix={`edit-${index}`}
                  canEnable={canAddReminder || !!editingDate.reminderEnabled}
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm text-muted hover:bg-surface-elevated rounded transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={(!editingDate.type && !editingDate.title.trim()) || !editingDate.date}
                    className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-foreground text-sm">
                    {getDateDisplayTitle(date, t)}
                  </div>
                  <div className="text-xs text-muted">
                    {date.date.startsWith('1604-')
                      ? formatDateWithoutYear(parseAsLocalDate(date.date), dateFormat)
                      : formatDate(parseAsLocalDate(date.date), dateFormat)}
                  </div>
                  {getReminderDescription(date) && (
                    <div className="text-xs text-primary mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      {getReminderDescription(date)}
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(index)}
                    disabled={editingIndex !== null || isAdding}
                    className="text-primary hover:text-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('edit')}
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
                    title={t('delete')}
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
          <div className="p-3 bg-surface-elevated rounded-lg space-y-3">
            <div>
              <label
                htmlFor="new-date-title"
                className="block text-xs font-medium text-muted mb-1"
              >
                {t('title')}
              </label>
              <ComboboxInput
                options={comboboxOptions}
                value={newDate.type ?? null}
                customText={newDate.title}
                onChange={(type, customText) => {
                  if (type) {
                    setNewDate({ ...newDate, type, title: '' });
                  } else {
                    setNewDate({ ...newDate, type: null, title: customText ?? '' });
                  }
                }}
                placeholder={t('titlePlaceholder')}
                id="new-date-title"
                otherLabel={`${otherLabel}...`}
              />
            </div>
            <div>
              <label
                htmlFor="new-date-date"
                className="block text-xs font-medium text-muted mb-1"
              >
                {t('date')}
              </label>
              <DatePicker
                value={newDate.date}
                onChange={(val) => {
                  const value = newDate.yearUnknown
                    ? handleYearlessDateChange(val)
                    : val;
                  setNewDate({ ...newDate, date: value });
                }}
                dateFormat={dateFormat}
                showYearToggle
                yearUnknown={newDate.yearUnknown}
                onYearUnknownChange={(val) => setNewDate({ ...newDate, yearUnknown: val })}
              />
            </div>
            <ReminderFields
              date={newDate}
              onChange={(updates) => setNewDate({ ...newDate, ...updates })}
              idPrefix="new"
              canEnable={canAddReminder}
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewDate({ ...defaultNewDate });
                }}
                className="px-3 py-1.5 text-sm text-muted hover:bg-surface-elevated rounded transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={(!newDate.type && !newDate.title.trim()) || !newDate.date}
                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('add')}
              </button>
            </div>
          </div>
        )}

        {dates.length === 0 && !isAdding && (
          <p className="text-sm text-muted py-2">
            {t('noDatesYet')}
          </p>
        )}
      </div>
    </div>
  );
}
