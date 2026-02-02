'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/date-format';

interface ParsedVCardData {
  name?: string;
  surname?: string;
  middleName?: string;
  prefix?: string;
  suffix?: string;
  nickname?: string;
  organization?: string;
  jobTitle?: string;
  emails?: Array<{ email: string; type: string }>;
  phoneNumbers?: Array<{ number: string; type: string }>;
}

interface PendingImport {
  id: string;
  uid: string;
  href: string;
  vCardData: string;
  displayName: string;
  discoveredAt: Date;
}

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface CompactContactRowProps {
  pendingImport: PendingImport;
  isSelected: boolean;
  onToggle: (id: string) => void;
  availableGroups: Group[];
  selectedGroupIds: string[];
  onGroupsChange: (contactId: string, groupIds: string[]) => void;
  parsedData: ParsedVCardData | null;
}

export default function CompactContactRow({
  pendingImport,
  isSelected,
  onToggle,
  availableGroups,
  selectedGroupIds,
  onGroupsChange,
  parsedData,
}: CompactContactRowProps) {
  const t = useTranslations('settings.carddav.import');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Format full name from parsed vCard data
  const formatFullName = (parsed: ParsedVCardData | null): string => {
    if (!parsed) return pendingImport.displayName;

    const parts = [
      parsed.prefix,
      parsed.name,
      parsed.middleName,
      parsed.surname,
      parsed.suffix,
    ].filter(Boolean);

    let fullName = parts.join(' ');

    if (parsed.nickname) {
      fullName += ` (${parsed.nickname})`;
    }

    return fullName || pendingImport.displayName;
  };

  const fullName = formatFullName(parsedData);

  const handleGroupToggle = (groupId: string) => {
    const newGroupIds = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter((id) => id !== groupId)
      : [...selectedGroupIds, groupId];
    onGroupsChange(pendingImport.id, newGroupIds);
  };

  return (
    <div
      className={`border rounded-lg transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-3 p-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(pendingImport.id)}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0"
          aria-label={`Select ${fullName}`}
        />

        {/* Expand/Collapse button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0"
          aria-label={isExpanded ? t('collapseDetails') : t('expandDetails')}
          aria-expanded={isExpanded}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Full name */}
        <div
          className="flex-1 font-semibold text-foreground cursor-pointer"
          onClick={() => onToggle(pendingImport.id)}
        >
          {fullName}
        </div>

        {/* Groups dropdown */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowGroupDropdown(!showGroupDropdown)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <span className="text-muted">
              {selectedGroupIds.length === 0
                ? t('noGroups')
                : t('groupsCount', { count: selectedGroupIds.length })}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showGroupDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {showGroupDropdown && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowGroupDropdown(false)}
              />

              {/* Dropdown content */}
              <div className="absolute right-0 mt-2 w-64 bg-surface border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                {availableGroups.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted">
                    {t('noGroups')}
                  </div>
                ) : (
                  <div className="py-2">
                    {availableGroups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-surface-elevated cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-foreground flex-1">{group.name}</span>
                        {group.color && (
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && parsedData && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700 mt-2">
          <div className="mt-2 space-y-1 text-sm text-muted">
            {parsedData.organization && (
              <p>
                <span className="font-medium">{t('organization')}:</span>{' '}
                {parsedData.organization}
              </p>
            )}
            {parsedData.jobTitle && (
              <p>
                <span className="font-medium">{t('jobTitle')}:</span>{' '}
                {parsedData.jobTitle}
              </p>
            )}
            {parsedData.emails && parsedData.emails.length > 0 && (
              <p>
                <span className="font-medium">{t('email')}:</span>{' '}
                {parsedData.emails[0].email}
              </p>
            )}
            {parsedData.phoneNumbers && parsedData.phoneNumbers.length > 0 && (
              <p>
                <span className="font-medium">{t('phone')}:</span>{' '}
                {parsedData.phoneNumbers[0].number}
              </p>
            )}
            <p className="text-xs">
              {t('discovered')}: {formatDateTime(pendingImport.discoveredAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
