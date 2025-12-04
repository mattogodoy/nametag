'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import PersonAutocomplete from './PersonAutocomplete';
import GroupsSelector from './GroupsSelector';
import ImportantDatesManager from './ImportantDatesManager';

interface PersonFormProps {
  person?: {
    id: string;
    name: string;
    surname: string | null;
    nickname: string | null;
    lastContact: Date | null;
    notes: string | null;
    relationshipToUserId: string | null;
    relationshipToUser?: {
      label: string;
    } | null;
    groups: Array<{ groupId: string }>;
    importantDates?: Array<{
      id: string;
      title: string;
      date: Date;
      reminderEnabled?: boolean;
      reminderType?: 'ONCE' | 'RECURRING' | null;
      reminderInterval?: number | null;
      reminderIntervalUnit?: 'WEEKS' | 'MONTHS' | 'YEARS' | null;
    }>;
  };
  groups: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  relationshipTypes: Array<{
    id: string;
    label: string;
    color: string | null;
  }>;
  availablePeople?: Array<{
    id: string;
    name: string;
    surname: string | null;
    nickname: string | null;
    groups: Array<{ groupId: string }>;
  }>;
  userName?: string;
  mode: 'create' | 'edit';
  initialName?: string;
  initialKnownThrough?: string;
  initialRelationshipType?: string;
}

export default function PersonForm({
  person,
  groups,
  relationshipTypes,
  availablePeople = [],
  userName = 'You',
  mode,
  initialName,
  initialKnownThrough,
  initialRelationshipType,
}: PersonFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize knownThrough from URL params if provided
  const initialKnownThroughPerson = initialKnownThrough
    ? availablePeople.find(p => p.id === initialKnownThrough)
    : null;

  const [knownThroughId, setKnownThroughId] = useState<string>(
    initialKnownThrough || 'user'
  );
  const [knownThroughName, setKnownThroughName] = useState<string>(
    initialKnownThroughPerson ? `${initialKnownThroughPerson.name}${initialKnownThroughPerson.surname ? ' ' + initialKnownThroughPerson.surname : ''}` : 'You'
  );
  const [inheritGroups, setInheritGroups] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [createAnother, setCreateAnother] = useState(false);

  const [formData, setFormData] = useState({
    name: person?.name || initialName || '',
    surname: person?.surname || '',
    nickname: person?.nickname || '',
    lastContact: person?.lastContact
      ? new Date(person.lastContact).toISOString().split('T')[0]
      : '',
    notes: person?.notes || '',
    relationshipToUserId: person?.relationshipToUserId || initialRelationshipType || '',
    groupIds: person?.groups.map((g) => g.groupId) || [],
  });

  const [importantDates, setImportantDates] = useState<Array<{
    id?: string;
    title: string;
    date: string;
    reminderEnabled?: boolean;
    reminderType?: 'ONCE' | 'RECURRING' | null;
    reminderInterval?: number | null;
    reminderIntervalUnit?: 'WEEKS' | 'MONTHS' | 'YEARS' | null;
  }>>(
    person?.importantDates?.map((d) => ({
      id: d.id,
      title: d.title,
      date: new Date(d.date).toISOString().split('T')[0],
      reminderEnabled: d.reminderEnabled,
      reminderType: d.reminderType,
      reminderInterval: d.reminderInterval,
      reminderIntervalUnit: d.reminderIntervalUnit,
    })) || []
  );

  // Get the selected base person's groups for inheritance
  const selectedBasePerson = knownThroughId !== 'user'
    ? availablePeople.find(p => p.id === knownThroughId)
    : null;

  // Auto-inherit groups when checkbox is checked or base person changes
  const handleInheritGroupsChange = (checked: boolean) => {
    setInheritGroups(checked);
    if (checked && selectedBasePerson) {
      const inheritedGroupIds = selectedBasePerson.groups.map(g => g.groupId);
      setFormData(prev => ({
        ...prev,
        groupIds: Array.from(new Set([...prev.groupIds, ...inheritedGroupIds]))
      }));
    }
  };

  // Update groups when base person changes if inherit is enabled
  const handleKnownThroughChange = (newPersonId: string, newPersonName: string) => {
    setKnownThroughId(newPersonId);
    setKnownThroughName(newPersonName);
    if (inheritGroups && newPersonId !== 'user') {
      const newBasePerson = availablePeople.find(p => p.id === newPersonId);
      if (newBasePerson) {
        const inheritedGroupIds = newBasePerson.groups.map(g => g.groupId);
        setFormData(prev => ({
          ...prev,
          groupIds: Array.from(new Set([...prev.groupIds, ...inheritedGroupIds]))
        }));
      }
    }
  };

  // Create list of people including the user for autocomplete
  const peopleWithUser = [
    { id: 'user', name: 'You', surname: null, nickname: null, groups: [] },
    ...availablePeople
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>, addAnother = false) => {
    e.preventDefault();
    setError('');

    // Set createAnother based on the parameter
    setCreateAnother(addAnother);

    // Client-side validation
    if (formData.lastContact) {
      const lastContactDate = new Date(formData.lastContact);
      if (lastContactDate > new Date()) {
        setError('Last contact date cannot be in the future');
        return;
      }
    }

    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/people' : `/api/people/${person?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          importantDates,
          ...(mode === 'create' && knownThroughId !== 'user' ? { connectedThroughId: knownThroughId } : {})
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      // Show success toast
      const displayName = `${formData.name}${formData.surname ? ' ' + formData.surname : ''}`;
      toast.success(
        mode === 'create'
          ? `${displayName} has been added to your network`
          : `${displayName}'s information has been updated`
      );

      // Redirect logic:
      // - Edit mode: Go to the edited person's detail page
      // - Create mode with "create another": Reload the create page
      // - Create mode with "Known Through" another person: Go to that person's detail page (to see the new relationship)
      // - Create mode direct to user: Go to the newly created person's detail page
      if (mode === 'edit' && person?.id) {
        router.push(`/people/${person.id}`);
        router.refresh();
      } else if (mode === 'create' && addAnother) {
        // Reload the create page to reset the form
        // Preserve query params for knownThrough and relationshipType if they exist
        const params = new URLSearchParams();
        if (initialKnownThrough) {
          params.set('knownThrough', initialKnownThrough);
        }
        if (initialRelationshipType) {
          params.set('relationshipType', initialRelationshipType);
        }
        const queryString = params.toString();
        window.location.href = queryString ? `/people/new?${queryString}` : '/people/new';
      } else if (mode === 'create' && knownThroughId !== 'user') {
        router.push(`/people/${knownThroughId}`);
        router.refresh();
      } else if (mode === 'create' && data.person?.id) {
        router.push(`/people/${data.person.id}`);
        router.refresh();
      } else {
        router.push('/people');
        router.refresh();
      }
    } catch (error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const setLastContactToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...formData, lastContact: today });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="surname"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Surname
          </label>
          <input
            type="text"
            id="surname"
            value={formData.surname}
            onChange={(e) =>
              setFormData({ ...formData, surname: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="nickname"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nickname
          </label>
          <input
            type="text"
            id="nickname"
            value={formData.nickname}
            onChange={(e) =>
              setFormData({ ...formData, nickname: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {mode === 'create' && (
        <div>
          <label
            htmlFor="knownThrough"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Known Through
          </label>
          <PersonAutocomplete
            people={peopleWithUser}
            value={knownThroughId}
            onChange={handleKnownThroughChange}
            placeholder="Search for a person..."
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Select who connects you to this person. For example, if adding your friend&apos;s child, select your friend.
          </p>
          {knownThroughId !== 'user' && selectedBasePerson && selectedBasePerson.groups.length > 0 && (
            <div className="mt-3 flex items-center">
              <input
                type="checkbox"
                id="inheritGroups"
                checked={inheritGroups}
                onChange={(e) => handleInheritGroupsChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="inheritGroups" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Inherit groups from {selectedBasePerson.name}{selectedBasePerson.surname ? ' ' + selectedBasePerson.surname : ''}
              </label>
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && person?.relationshipToUserId && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Relationship to You
          </label>
          <select
            id="relationshipToUserId"
            value={formData.relationshipToUserId}
            onChange={(e) =>
              setFormData({ ...formData, relationshipToUserId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a relationship...</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'edit' && !person?.relationshipToUserId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-4 py-3 rounded">
          This person is connected to you through other people in your network, not directly.
        </div>
      )}

      {mode === 'create' && knownThroughId === 'user' && (
        <div>
          <label
            htmlFor="relationshipToUserId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Relationship to {knownThroughName} *
          </label>
          <select
            id="relationshipToUserId"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              setFormData({ ...formData, relationshipToUserId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a relationship...</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'create' && knownThroughId !== 'user' && (
        <div>
          <label
            htmlFor="relationshipToKnownThrough"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Relationship to {knownThroughName} *
          </label>
          <select
            id="relationshipToKnownThrough"
            required
            value={formData.relationshipToUserId}
            onChange={(e) =>
              setFormData({ ...formData, relationshipToUserId: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a relationship...</option>
            {relationshipTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            This person will be connected to {knownThroughName}, not directly to you.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {groups.length > 0 && (
        <GroupsSelector
          availableGroups={groups}
          selectedGroupIds={formData.groupIds}
          onChange={(groupIds) => setFormData({ ...formData, groupIds })}
        />
      )}

      <div>
        <label
          htmlFor="lastContact"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Last Contact
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            id="lastContact"
            value={formData.lastContact}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) =>
              setFormData({ ...formData, lastContact: e.target.value })
            }
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={setLastContactToToday}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <ImportantDatesManager
        personId={person?.id}
        initialDates={importantDates}
        onChange={setImportantDates}
        mode={mode}
      />

      <div className="flex justify-end space-x-4 pt-4">
        <Link
          href="/people"
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </Link>

        {mode === 'create' ? (
          <div className="relative">
            <div className="flex">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded-l-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Create'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-2 py-2 bg-blue-600 text-white border-l border-blue-500 rounded-r-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    setShowDropdown(false);
                    // Trigger form submission with validation
                    const form = e.currentTarget.closest('form');
                    if (form) {
                      // Check if form is valid using HTML5 validation
                      if (form.checkValidity()) {
                        // Manually create and dispatch submit event
                        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                        Object.defineProperty(submitEvent, 'target', { value: form, enumerable: true });
                        handleSubmit(submitEvent as any, true);
                      } else {
                        // Trigger browser's built-in validation UI
                        form.reportValidity();
                      }
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Create and add another
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}
