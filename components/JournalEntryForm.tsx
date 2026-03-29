'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import MarkdownEditor from '@/components/MarkdownEditor';
import PillSelector from '@/components/PillSelector';
import { Button } from '@/components/ui/Button';
import { formatFullName } from '@/lib/nameUtils';

interface PersonOption {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
}

interface JournalEntryFormProps {
  mode: 'create' | 'edit';
  entryId?: string;
  initialData?: {
    title: string;
    date: string;
    body: string;
    personIds: string[];
  };
  availablePeople: PersonOption[];
  nameOrder?: 'WESTERN' | 'EASTERN';
  dateFormat?: 'MDY' | 'DMY' | 'YMD';
}

interface PillPerson {
  id: string;
  label: string;
}

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function JournalEntryForm({
  mode,
  entryId,
  initialData,
  availablePeople,
  nameOrder,
}: JournalEntryFormProps) {
  const t = useTranslations('journal.form');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  // Build pill-compatible list from availablePeople
  const pillPeople: PillPerson[] = availablePeople.map((p) => ({
    id: p.id,
    label: formatFullName(p, nameOrder),
  }));

  // Resolve initial selected people
  const resolveInitialSelected = (): PillPerson[] => {
    if (!initialData?.personIds?.length) return [];
    return initialData.personIds
      .map((id) => pillPeople.find((p) => p.id === id))
      .filter((p): p is PillPerson => p !== undefined);
  };

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [date, setDate] = useState(initialData?.date ?? getTodayString());
  const [body, setBody] = useState(initialData?.body ?? '');
  const [selectedPeople, setSelectedPeople] = useState<PillPerson[]>(resolveInitialSelected);
  const [updateLastContact, setUpdateLastContact] = useState(mode === 'create');

  // Pre-populate person from ?person=id query param
  useEffect(() => {
    const personId = searchParams.get('person');
    if (!personId) return;
    const match = pillPeople.find((p) => p.id === personId);
    if (match) {
      setSelectedPeople((prev) => {
        if (prev.some((p) => p.id === personId)) return prev;
        return [...prev, match];
      });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/journal' : `/api/journal/${entryId}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const payload = {
        title,
        date,
        body,
        personIds: selectedPeople.map((p) => p.id),
        updateLastContact: selectedPeople.length > 0 ? updateLastContact : false,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { entry?: { id: string }; error?: string };

      if (!response.ok) {
        setError(data.error ?? t('save'));
        return;
      }

      const newId = data.entry?.id ?? entryId;
      router.push(`/journal/${newId}`);
      router.refresh();
    } catch {
      setError(t('save'));
    } finally {
      setIsLoading(false);
    }
  };

  const cancelHref = mode === 'edit' && entryId ? `/journal/${entryId}` : '/journal';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="journal-title" className="block text-sm font-medium text-muted mb-1">
          {t('titleLabel')} <span className="text-destructive" aria-hidden="true">*</span>
        </label>
        <input
          type="text"
          id="journal-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Date */}
      <div>
        <label htmlFor="journal-date" className="block text-sm font-medium text-muted mb-1">
          {t('dateLabel')}
        </label>
        <input
          type="date"
          id="journal-date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* People */}
      <div>
        <PillSelector<PillPerson>
          label={t('peopleLabel')}
          selectedItems={selectedPeople}
          availableItems={pillPeople}
          onAdd={(item) => setSelectedPeople((prev) => [...prev, item])}
          onRemove={(itemId) =>
            setSelectedPeople((prev) => prev.filter((p) => p.id !== itemId))
          }
          placeholder={t('peoplePlaceholder')}
          showAllOnFocus
          isLoading={isLoading}
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="journal-body" className="block text-sm font-medium text-muted mb-1">
          {t('bodyLabel')}
        </label>
        <MarkdownEditor
          id="journal-body"
          value={body}
          onChange={setBody}
          placeholder={t('bodyPlaceholder')}
          rows={10}
        />
        <p className="mt-1 text-xs text-muted">{t('markdownSupport')}</p>
      </div>

      {/* Update last contact checkbox — only visible when people are tagged */}
      {selectedPeople.length > 0 && (
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="update-last-contact"
            checked={updateLastContact}
            onChange={(e) => setUpdateLastContact(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-2 cursor-pointer"
          />
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="update-last-contact"
              className="text-sm text-foreground cursor-pointer select-none"
            >
              {t('updateLastContact')}
            </label>
            {/* Tooltip */}
            <div className="relative inline-flex items-center">
              <button
                type="button"
                className="flex items-center justify-center w-4 h-4 rounded-full bg-surface-elevated border border-border text-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
                aria-describedby="update-last-contact-tooltip"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <div
                id="update-last-contact-tooltip"
                role="tooltip"
                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 text-xs text-foreground bg-surface-elevated border border-border rounded-lg shadow-lg z-50 transition-opacity ${
                  showTooltip ? 'opacity-100 visible' : 'opacity-0 invisible'
                }`}
              >
                {t('updateLastContactTooltip')}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-surface-elevated border-r border-b border-border rotate-45" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" href={cancelHref}>
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '…' : t('save')}
        </Button>
      </div>
    </form>
  );
}
