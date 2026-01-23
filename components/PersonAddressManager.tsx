'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface PersonAddress {
  id?: string;
  type: 'work' | 'home' | 'other';
  street?: string;
  locality?: string; // City
  region?: string; // State/Province
  postalCode?: string;
  country?: string;
  isPrimary?: boolean;
}

interface PersonAddressManagerProps {
  initialAddresses?: PersonAddress[];
  onChange?: (addresses: PersonAddress[]) => void;
}

const defaultNewAddress: PersonAddress = {
  type: 'home',
  street: '',
  locality: '',
  region: '',
  postalCode: '',
  country: '',
  isPrimary: false,
};

export default function PersonAddressManager({
  initialAddresses = [],
  onChange,
}: PersonAddressManagerProps) {
  const t = useTranslations('people.form.addresses');
  const [addresses, setAddresses] = useState<PersonAddress[]>(initialAddresses);
  const [isAdding, setIsAdding] = useState(false);
  const [newAddress, setNewAddress] = useState<PersonAddress>({ ...defaultNewAddress });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingAddress, setEditingAddress] = useState<PersonAddress | null>(null);

  const formatAddress = (addr: PersonAddress): string => {
    const parts = [
      addr.street,
      addr.locality,
      addr.region,
      addr.postalCode,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ') || t('noAddressData');
  };

  const handleAdd = () => {
    // At least one field must be filled
    if (!newAddress.street && !newAddress.locality && !newAddress.region && !newAddress.postalCode && !newAddress.country) {
      return;
    }

    const addressToAdd: PersonAddress = {
      ...newAddress,
      id: undefined,
    };

    const updatedAddresses = [...addresses, addressToAdd];
    setAddresses(updatedAddresses);
    if (onChange) {
      onChange(updatedAddresses);
    }
    setNewAddress({ ...defaultNewAddress });
    setIsAdding(false);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingAddress({ ...addresses[index] });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingAddress) return;

    const updatedAddresses = [...addresses];
    updatedAddresses[editingIndex] = {
      ...editingAddress,
      id: addresses[editingIndex].id,
    };

    setAddresses(updatedAddresses);
    if (onChange) {
      onChange(updatedAddresses);
    }
    setEditingIndex(null);
    setEditingAddress(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingAddress(null);
  };

  const handleRemove = (index: number) => {
    const updatedAddresses = addresses.filter((_, i) => i !== index);
    setAddresses(updatedAddresses);
    if (onChange) {
      onChange(updatedAddresses);
    }
  };

  const handleSetPrimary = (index: number) => {
    const updatedAddresses = addresses.map((addr, i) => ({
      ...addr,
      isPrimary: i === index,
    }));
    setAddresses(updatedAddresses);
    if (onChange) {
      onChange(updatedAddresses);
    }
  };

  const renderAddressForm = (
    address: PersonAddress,
    onChange: (updated: PersonAddress) => void
  ) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select
          value={address.type}
          onChange={(e) =>
            onChange({
              ...address,
              type: e.target.value as PersonAddress['type'],
            })
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="home">{t('types.home')}</option>
          <option value="work">{t('types.work')}</option>
          <option value="other">{t('types.other')}</option>
        </select>
      </div>
      <input
        type="text"
        value={address.street || ''}
        onChange={(e) => onChange({ ...address, street: e.target.value })}
        placeholder={t('streetPlaceholder')}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={address.locality || ''}
          onChange={(e) => onChange({ ...address, locality: e.target.value })}
          placeholder={t('cityPlaceholder')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          value={address.region || ''}
          onChange={(e) => onChange({ ...address, region: e.target.value })}
          placeholder={t('regionPlaceholder')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={address.postalCode || ''}
          onChange={(e) => onChange({ ...address, postalCode: e.target.value })}
          placeholder={t('postalCodePlaceholder')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          value={address.country || ''}
          onChange={(e) => onChange({ ...address, country: e.target.value })}
          placeholder={t('countryPlaceholder')}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  );

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

      {/* Existing addresses */}
      <div className="space-y-2">
        {addresses.map((address, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            {editingIndex === index && editingAddress ? (
              <div className="space-y-3">
                {renderAddressForm(editingAddress, setEditingAddress)}
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
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
                      {t(`types.${address.type}`)}
                    </span>
                    {address.isPrimary && (
                      <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                        {t('primary')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!address.isPrimary && (
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
                  </div>
                </div>
                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">
                  {formatAddress(address)}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new address */}
      {isAdding && (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-800 space-y-3">
          {renderAddressForm(newAddress, setNewAddress)}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newAddress.isPrimary}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, isPrimary: e.target.checked })
                }
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('primary')}
              </span>
            </label>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleAdd}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('add')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewAddress({ ...defaultNewAddress });
              }}
              className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !isAdding && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          {t('noAddresses')}
        </p>
      )}
    </div>
  );
}
