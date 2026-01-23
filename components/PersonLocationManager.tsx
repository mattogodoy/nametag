'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PersonLocation {
  id?: string;
  type: 'home' | 'work' | 'other';
  latitude: number;
  longitude: number;
  label?: string;
}

interface PersonLocationManagerProps {
  initialLocations?: PersonLocation[];
  onChange?: (locations: PersonLocation[]) => void;
}

const defaultNewLocation: PersonLocation = {
  type: 'home',
  latitude: 0,
  longitude: 0,
  label: '',
};

export default function PersonLocationManager({
  initialLocations = [],
  onChange,
}: PersonLocationManagerProps) {
  const t = useTranslations('people.form.locations');
  const [locations, setLocations] = useState<PersonLocation[]>(initialLocations);
  const [isAdding, setIsAdding] = useState(false);
  const [newLocation, setNewLocation] = useState<PersonLocation>({ ...defaultNewLocation });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingLocation, setEditingLocation] = useState<PersonLocation | null>(null);

  const isValidCoordinate = (lat: number, lon: number): boolean => {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  };

  const handleAdd = () => {
    if (!isValidCoordinate(newLocation.latitude, newLocation.longitude)) return;

    const locationToAdd: PersonLocation = {
      ...newLocation,
      id: undefined,
      label: newLocation.label?.trim() || undefined,
    };

    const updatedLocations = [...locations, locationToAdd];
    setLocations(updatedLocations);
    if (onChange) {
      onChange(updatedLocations);
    }
    setNewLocation({ ...defaultNewLocation });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingLocation({ ...locations[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingLocation) return;
    if (!isValidCoordinate(editingLocation.latitude, editingLocation.longitude)) return;

    const updatedLocations = [...locations];
    updatedLocations[editingIndex] = {
      ...editingLocation,
      id: locations[editingIndex].id,
      label: editingLocation.label?.trim() || undefined,
    };

    setLocations(updatedLocations);
    if (onChange) {
      onChange(updatedLocations);
    }
    setEditingIndex(null);
    setEditingLocation(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingLocation(null);
  };

  const handleRemove = (index: number) => {
    const updatedLocations = locations.filter((_, i) => i !== index);
    setLocations(updatedLocations);
    if (onChange) {
      onChange(updatedLocations);
    }
  };

  const formatCoordinates = (lat: number, lon: number): string => {
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
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

      {/* Existing locations */}
      <div className="space-y-2">
        {locations.map((location, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingLocation ? (
              <>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={editingLocation.type}
                      onChange={(e) =>
                        setEditingLocation({
                          ...editingLocation,
                          type: e.target.value as PersonLocation['type'],
                        })
                      }
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="home">{t('types.home')}</option>
                      <option value="work">{t('types.work')}</option>
                      <option value="other">{t('types.other')}</option>
                    </select>
                    <input
                      type="text"
                      value={editingLocation.label || ''}
                      onChange={(e) =>
                        setEditingLocation({ ...editingLocation, label: e.target.value })
                      }
                      placeholder={t('labelPlaceholder')}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={editingLocation.latitude}
                      onChange={(e) =>
                        setEditingLocation({ ...editingLocation, latitude: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={t('latitudePlaceholder')}
                      step="0.000001"
                      min="-90"
                      max="90"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="number"
                      value={editingLocation.longitude}
                      onChange={(e) =>
                        setEditingLocation({ ...editingLocation, longitude: parseFloat(e.target.value) || 0 })
                      }
                      placeholder={t('longitudePlaceholder')}
                      step="0.000001"
                      min="-180"
                      max="180"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
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
                    <span className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded">
                      {t(`types.${location.type}`)}
                    </span>
                    {location.label && (
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {location.label}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {formatCoordinates(location.latitude, location.longitude)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('viewOnMap')}
                  </a>
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

      {/* Add new location */}
      {isAdding && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
          <div className="flex gap-2">
            <select
              value={newLocation.type}
              onChange={(e) =>
                setNewLocation({
                  ...newLocation,
                  type: e.target.value as PersonLocation['type'],
                })
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="home">{t('types.home')}</option>
              <option value="work">{t('types.work')}</option>
              <option value="other">{t('types.other')}</option>
            </select>
            <input
              type="text"
              value={newLocation.label || ''}
              onChange={(e) => setNewLocation({ ...newLocation, label: e.target.value })}
              placeholder={t('labelPlaceholder')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={newLocation.latitude}
              onChange={(e) => setNewLocation({ ...newLocation, latitude: parseFloat(e.target.value) || 0 })}
              placeholder={t('latitudePlaceholder')}
              step="0.000001"
              min="-90"
              max="90"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <input
              type="number"
              value={newLocation.longitude}
              onChange={(e) => setNewLocation({ ...newLocation, longitude: parseFloat(e.target.value) || 0 })}
              placeholder={t('longitudePlaceholder')}
              step="0.000001"
              min="-180"
              max="180"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isValidCoordinate(newLocation.latitude, newLocation.longitude)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('add')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewLocation({ ...defaultNewLocation });
              }}
              className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              {t('cancel')}
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('coordinatesHelp')}
          </p>
        </div>
      )}

      {locations.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noLocations')}
        </p>
      )}
    </div>
  );
}
