'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import PersonAutocomplete from './PersonAutocomplete';
import GroupsSelector from './GroupsSelector';
import ImportantDatesManager from './ImportantDatesManager';
import MarkdownEditor from './MarkdownEditor';
import { Button } from './ui/Button';

type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

// These must be defined OUTSIDE the component to prevent re-renders
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-semibold text-foreground mb-4">
    {children}
  </h3>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-border rounded-lg p-4">
    {children}
  </div>
);

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
    contactReminderEnabled?: boolean;
    contactReminderInterval?: number | null;
    contactReminderIntervalUnit?: ReminderIntervalUnit | null;
    importantDates?: Array<{
      id: string;
      title: string;
      date: Date;
      reminderEnabled?: boolean;
      reminderType?: 'ONCE' | 'RECURRING' | null;
      reminderInterval?: number | null;
      reminderIntervalUnit?: ReminderIntervalUnit | null;
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
  reminderLimit?: {
    canCreate: boolean;
    current: number;
    limit: number;
    isUnlimited: boolean;
  };
}

export default function PersonForm({
  person,
  groups,
  relationshipTypes,
  availablePeople = [],
  mode,
  initialName,
  initialKnownThrough,
  initialRelationshipType,
  reminderLimit,
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
    contactReminderEnabled: person?.contactReminderEnabled || false,
    contactReminderInterval: person?.contactReminderInterval || 1,
    contactReminderIntervalUnit: (person?.contactReminderIntervalUnit || 'MONTHS') as ReminderIntervalUnit,
  });

  const [importantDates, setImportantDates] = useState<Array<{
    id?: string;
    title: string;
    date: string;
    reminderEnabled?: boolean;
    reminderType?: 'ONCE' | 'RECURRING' | null;
    reminderInterval?: number | null;
    reminderIntervalUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS' | null;
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
    } catch {
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

      {/* Details Section */}
      <Section>
        <SectionHeader>Details</SectionHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-muted mb-1"
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
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="surname"
                className="block text-sm font-medium text-muted mb-1"
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
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="nickname"
                className="block text-sm font-medium text-muted mb-1"
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
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {mode === 'create' && (
            <div>
              <label
                htmlFor="knownThrough"
                className="block text-sm font-medium text-muted mb-1"
              >
                Known Through
              </label>
              <PersonAutocomplete
                people={peopleWithUser}
                value={knownThroughId}
                onChange={handleKnownThroughChange}
                placeholder="Search for a person..."
              />
              <p className="text-xs text-muted mt-1">
                Select who connects you to this person. For example, if adding your friend&apos;s child, select your friend.
              </p>
            </div>
          )}

          {mode === 'edit' && person?.relationshipToUserId && (
            <div>
              <label
                htmlFor="relationshipToUserId"
                className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
              >
                Relationship to You
                <div className="group relative inline-block">
                  <svg
                    className="w-4 h-4 text-muted cursor-help"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface-elevated text-foreground text-xs rounded-lg whitespace-nowrap z-10 pointer-events-none">
                    You can create custom relationship types in the Relationships section
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-elevated"></div>
                  </div>
                </div>
              </label>
              <select
                id="relationshipToUserId"
                value={formData.relationshipToUserId}
                onChange={(e) =>
                  setFormData({ ...formData, relationshipToUserId: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
            <div className="bg-primary/10 border border-primary text-primary px-4 py-3 rounded">
              This person is connected to you through other people in your network, not directly.
            </div>
          )}

          {mode === 'create' && knownThroughId === 'user' && (
            <div>
              <label
                htmlFor="relationshipToUserId"
                className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
              >
                Relationship to {knownThroughName} *
                <div className="group relative inline-block">
                  <svg
                    className="w-4 h-4 text-muted cursor-help"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface-elevated text-foreground text-xs rounded-lg whitespace-nowrap z-10 pointer-events-none">
                    You can create custom relationship types in the Relationships section
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-elevated"></div>
                  </div>
                </div>
              </label>
              <select
                id="relationshipToUserId"
                required
                value={formData.relationshipToUserId}
                onChange={(e) =>
                  setFormData({ ...formData, relationshipToUserId: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="flex items-center gap-1.5 text-sm font-medium text-muted mb-1"
              >
                Relationship to {knownThroughName} *
                <div className="group relative inline-block">
                  <svg
                    className="w-4 h-4 text-muted cursor-help"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface-elevated text-foreground text-xs rounded-lg whitespace-nowrap z-10 pointer-events-none">
                    You can create custom relationship types in the Relationships section
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-elevated"></div>
                  </div>
                </div>
              </label>
              <select
                id="relationshipToKnownThrough"
                required
                value={formData.relationshipToUserId}
                onChange={(e) =>
                  setFormData({ ...formData, relationshipToUserId: e.target.value })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a relationship...</option>
                {relationshipTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                This person will be connected to {knownThroughName}, not directly to you.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-muted mb-1"
            >
              Notes
            </label>
            <MarkdownEditor
              id="notes"
              value={formData.notes}
              onChange={(notes) => setFormData({ ...formData, notes })}
              placeholder="Add notes about this person..."
              rows={4}
            />
            <p className="text-xs text-muted mt-1">
              Supports Markdown formatting
            </p>
          </div>
        </div>
      </Section>

      {/* Groups Section */}
      {groups.length > 0 && (
        <Section>
          <SectionHeader>Groups</SectionHeader>
          {mode === 'create' && knownThroughId !== 'user' && selectedBasePerson && selectedBasePerson.groups.length > 0 && (
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="inheritGroups"
                checked={inheritGroups}
                onChange={(e) => handleInheritGroupsChange(e.target.checked)}
                className="w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
              />
              <label htmlFor="inheritGroups" className="ml-2 text-sm text-muted">
                Inherit groups from {selectedBasePerson.name}{selectedBasePerson.surname ? ' ' + selectedBasePerson.surname : ''}
              </label>
            </div>
          )}
          <GroupsSelector
            availableGroups={groups}
            selectedGroupIds={formData.groupIds}
            onChange={(groupIds) => setFormData({ ...formData, groupIds })}
          />
        </Section>
      )}

      {/* Last Contact Section */}
      <Section>
        <SectionHeader>Last Contact</SectionHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="date"
              id="lastContact"
              value={formData.lastContact}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) =>
                setFormData({ ...formData, lastContact: e.target.value })
              }
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={setLastContactToToday}
            >
              Today
            </Button>
          </div>

          {/* Contact Reminder */}
          <div className="p-3 bg-surface-elevated rounded-lg">
            {(() => {
              const canToggleContactReminder = formData.contactReminderEnabled ||
                !reminderLimit || reminderLimit.isUnlimited || reminderLimit.canCreate;
              return (
                <>
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      type="button"
                      id="contact-reminder-toggle"
                      disabled={!canToggleContactReminder}
                      onClick={() => {
                        if (!canToggleContactReminder) return;
                        setFormData({
                          ...formData,
                          contactReminderEnabled: !formData.contactReminderEnabled,
                        });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        formData.contactReminderEnabled
                          ? 'bg-primary'
                          : 'bg-muted'
                      } ${!canToggleContactReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          formData.contactReminderEnabled
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <label
                      htmlFor="contact-reminder-toggle"
                      className={`text-sm ${canToggleContactReminder && formData.contactReminderEnabled ? 'text-muted' : 'text-muted'}`}
                    >
                      Remind me to catch up after
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      disabled={!formData.contactReminderEnabled}
                      value={formData.contactReminderInterval}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactReminderInterval: Math.max(
                            1,
                            parseInt(e.target.value) || 1
                          ),
                        })
                      }
                      className="w-16 px-2 py-1 text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <select
                      disabled={!formData.contactReminderEnabled}
                      value={formData.contactReminderIntervalUnit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactReminderIntervalUnit: e.target
                            .value as ReminderIntervalUnit,
                        })
                      }
                      className="px-2 py-1 text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="DAYS">days</option>
                      <option value="WEEKS">weeks</option>
                      <option value="MONTHS">months</option>
                      <option value="YEARS">years</option>
                    </select>
                  </div>
                  {!canToggleContactReminder && reminderLimit && !reminderLimit.isUnlimited && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      Reminder limit reached ({reminderLimit.limit}). Upgrade to add more.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </Section>

      {/* Important Dates Section */}
      <Section>
        <SectionHeader>Important Dates</SectionHeader>
        <ImportantDatesManager
          personId={person?.id}
          initialDates={importantDates}
          onChange={setImportantDates}
          mode={mode}
          reminderLimit={reminderLimit}
        />
      </Section>

      <div className="flex justify-end space-x-4 pt-4">
        <Link
          href="/people"
          className="px-6 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
        >
          Cancel
        </Link>

        {mode === 'create' ? (
          <div className="relative">
            <div className="flex">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-primary text-white rounded-l-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Create'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-2 py-2 bg-primary text-white border-l border-primary rounded-r-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg bg-surface border border-border z-10">
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
                        handleSubmit(submitEvent as unknown as FormEvent<HTMLFormElement>, true);
                      } else {
                        // Trigger browser's built-in validation UI
                        form.reportValidity();
                      }
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-muted hover:bg-surface-elevated rounded-lg transition-colors"
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
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}
