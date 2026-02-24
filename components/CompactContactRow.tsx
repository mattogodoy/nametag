'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import GroupsSelector from './GroupsSelector';

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
  onGroupCreated?: (group: Group) => void;
  parsedData: ParsedVCardData | null;
}

export default function CompactContactRow({
  pendingImport,
  isSelected,
  onToggle,
  availableGroups,
  selectedGroupIds,
  onGroupsChange,
  onGroupCreated,
  parsedData,
}: CompactContactRowProps) {
  const t = useTranslations('settings.carddav.import');
  const [isExpanded, setIsExpanded] = useState(false);

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

        {/* Group pills (read-only display) */}
        {selectedGroupIds.length > 0 && (
          <div className="flex flex-wrap gap-1 flex-shrink-0">
            {selectedGroupIds.map((groupId) => {
              const group = availableGroups.find((g) => g.id === groupId);
              if (!group) return null;
              return (
                <span
                  key={groupId}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-elevated rounded-full text-xs font-medium text-foreground"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color || '#9CA3AF' }}
                  />
                  {group.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700 mt-2">
          {parsedData && (
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
            </div>
          )}
          <div className="mt-3">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('contactGroups')}
            </label>
            <GroupsSelector
              availableGroups={availableGroups}
              selectedGroupIds={selectedGroupIds}
              onChange={(groupIds) => onGroupsChange(pendingImport.id, groupIds)}
              onGroupCreated={onGroupCreated}
              showCreateHint={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
