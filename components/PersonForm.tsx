'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import PersonAutocomplete from './PersonAutocomplete';
import GroupsSelector from './GroupsSelector';
import ImportantDatesManager from './ImportantDatesManager';

type ReminderIntervalUnit = 'WEEKS' | 'MONTHS' | 'YEARS';

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

  const selectedBasePerson = knownThroughId !== 'user'
    ? availablePeople.find(p => p.id === knownThroughId)
    : null;

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

  const peopleWithUser = [
    { id: 'user', name: 'You', surname: null, nickname: null, groups: [] },
    ...availablePeople
  ];

  const handleSubmit = async (e: FormEvent<HTMLFormElement>, addAnother = false) => {
    e.preventDefault();
    setError('');

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

      const displayName = `${formData.name}${formData.surname ? ' ' + formData.surname : ''}`;
      toast.success(
        mode === 'create'
          ? `${displayName} has been added to your network`
          : `${displayName}'s information has been updated`
      );

      if (mode === 'edit' && person?.id) {
        router.push(`/people/${person.id}`);
        router.refresh();
      } else if (mode === 'create' && addAnother) {
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
        <div className="alert alert-error">
          <span className="icon-[tabler--alert-circle] size-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Details Section */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-lg">Details</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-control">
                <label htmlFor="name" className="label">
                  <span className="label-text">Name *</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>

              <div className="form-control">
                <label htmlFor="surname" className="label">
                  <span className="label-text">Surname</span>
                </label>
                <input
                  type="text"
                  id="surname"
                  value={formData.surname}
                  onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                  className="input"
                />
              </div>

              <div className="form-control">
                <label htmlFor="nickname" className="label">
                  <span className="label-text">Nickname</span>
                </label>
                <input
                  type="text"
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            {mode === 'create' && (
              <div className="form-control">
                <label htmlFor="knownThrough" className="label">
                  <span className="label-text">Known Through</span>
                </label>
                <PersonAutocomplete
                  people={peopleWithUser}
                  value={knownThroughId}
                  onChange={handleKnownThroughChange}
                  placeholder="Search for a person..."
                />
                <label className="label">
                  <span className="label-text-alt">
                    Select who connects you to this person.
                  </span>
                </label>
                {knownThroughId !== 'user' && selectedBasePerson && selectedBasePerson.groups.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="inheritGroups"
                      checked={inheritGroups}
                      onChange={(e) => handleInheritGroupsChange(e.target.checked)}
                      className="checkbox checkbox-primary checkbox-sm"
                    />
                    <label htmlFor="inheritGroups" className="label-text text-sm">
                      Inherit groups from {selectedBasePerson.name}{selectedBasePerson.surname ? ' ' + selectedBasePerson.surname : ''}
                    </label>
                  </div>
                )}
              </div>
            )}

            {mode === 'edit' && person?.relationshipToUserId && (
              <div className="form-control">
                <label htmlFor="relationshipToUserId" className="label">
                  <span className="label-text">Relationship to You</span>
                </label>
                <select
                  id="relationshipToUserId"
                  value={formData.relationshipToUserId}
                  onChange={(e) => setFormData({ ...formData, relationshipToUserId: e.target.value })}
                  className="select"
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
              <div className="alert alert-info">
                <span className="icon-[tabler--info-circle] size-5" />
                <span>This person is connected to you through other people in your network, not directly.</span>
              </div>
            )}

            {mode === 'create' && (
              <div className="form-control">
                <label htmlFor="relationshipToUserId" className="label">
                  <span className="label-text">Relationship to {knownThroughName} *</span>
                </label>
                <select
                  id="relationshipToUserId"
                  required
                  value={formData.relationshipToUserId}
                  onChange={(e) => setFormData({ ...formData, relationshipToUserId: e.target.value })}
                  className="select"
                >
                  <option value="">Select a relationship...</option>
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {knownThroughId !== 'user' && (
                  <label className="label">
                    <span className="label-text-alt">
                      This person will be connected to {knownThroughName}, not directly to you.
                    </span>
                  </label>
                )}
              </div>
            )}

            <div className="form-control">
              <label htmlFor="notes" className="label">
                <span className="label-text">Notes</span>
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="textarea"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Groups Section */}
      {groups.length > 0 && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title text-lg">Groups</h3>
            <GroupsSelector
              availableGroups={groups}
              selectedGroupIds={formData.groupIds}
              onChange={(groupIds) => setFormData({ ...formData, groupIds })}
            />
          </div>
        </div>
      )}

      {/* Last Contact Section */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-lg">Last Contact</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="date"
                id="lastContact"
                value={formData.lastContact}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, lastContact: e.target.value })}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={setLastContactToToday}
                className="btn btn-neutral"
              >
                Today
              </button>
            </div>

            {/* Contact Reminder */}
            <div className="p-3 bg-base-300 rounded-lg">
              <div className="flex items-center flex-wrap gap-2">
                <input
                  type="checkbox"
                  id="contact-reminder-toggle"
                  checked={formData.contactReminderEnabled}
                  onChange={() => setFormData({ ...formData, contactReminderEnabled: !formData.contactReminderEnabled })}
                  className="toggle toggle-primary toggle-sm"
                />
                <label
                  htmlFor="contact-reminder-toggle"
                  className={`text-sm ${formData.contactReminderEnabled ? '' : 'opacity-50'}`}
                >
                  Remind me to catch up after
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  disabled={!formData.contactReminderEnabled}
                  value={formData.contactReminderInterval}
                  onChange={(e) => setFormData({ ...formData, contactReminderInterval: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="input input-sm w-16"
                />
                <select
                  disabled={!formData.contactReminderEnabled}
                  value={formData.contactReminderIntervalUnit}
                  onChange={(e) => setFormData({ ...formData, contactReminderIntervalUnit: e.target.value as ReminderIntervalUnit })}
                  className="select select-sm"
                >
                  <option value="WEEKS">weeks</option>
                  <option value="MONTHS">months</option>
                  <option value="YEARS">years</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Dates Section */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title text-lg">Important Dates</h3>
          <ImportantDatesManager
            personId={person?.id}
            initialDates={importantDates}
            onChange={setImportantDates}
            mode={mode}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Link href="/people" className="btn btn-outline">
          Cancel
        </Link>

        {mode === 'create' ? (
          <div className="dropdown dropdown-end">
            <div className="join">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary join-item"
              >
                {isLoading && <span className="loading loading-spinner loading-sm" />}
                {isLoading ? 'Saving...' : 'Create'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowDropdown(!showDropdown)}
                className="btn btn-primary join-item"
              >
                <span className="icon-[tabler--chevron-down] size-4" />
              </button>
            </div>

            {showDropdown && (
              <ul className="dropdown-menu dropdown-open:opacity-100 mt-2 min-w-48">
                <li>
                  <button
                    type="button"
                    onClick={(e) => {
                      setShowDropdown(false);
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        if (form.checkValidity()) {
                          const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                          Object.defineProperty(submitEvent, 'target', { value: form, enumerable: true });
                          handleSubmit(submitEvent as unknown as FormEvent<HTMLFormElement>, true);
                        } else {
                          form.reportValidity();
                        }
                      }
                    }}
                    className="dropdown-item"
                  >
                    <span className="icon-[tabler--plus] size-4" />
                    Create and add another
                  </button>
                </li>
              </ul>
            )}
          </div>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading && <span className="loading loading-spinner loading-sm" />}
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
    </form>
  );
}
