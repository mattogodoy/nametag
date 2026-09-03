'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LabelVariant } from '@/lib/relationship-labels/types';

export interface LabelPreviewPerson {
  id: string;
  name: string;
}

export interface LabelPreviewProps {
  typeLabel: string;
  variants: LabelVariant[];
  people: LabelPreviewPerson[];
}

interface PreviewResult {
  label: string;
  variantIndex: number | null;
}

const DEBOUNCE_MS = 300;

/**
 * A live preview of what a rule set produces for two chosen contacts. It runs
 * against the configuration currently being edited, not what is saved, so it
 * posts to a dedicated preview endpoint rather than reading the database.
 * A failed request never throws: it shows the failure string and clears the
 * stale result, so a network hiccup never blocks the rest of the form.
 */
export default function LabelPreview({ typeLabel, variants, people }: LabelPreviewProps) {
  const t = useTranslations('relationshipTypes.form.conditionalLabels.preview');
  const [describedPersonId, setDescribedPersonId] = useState(people[0]?.id ?? '');
  const [otherPersonId, setOtherPersonId] = useState(people[1]?.id ?? people[0]?.id ?? '');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a superseded response overwriting a newer one: each
  // scheduled request stamps itself with the current counter, and its
  // response is applied only if that stamp still matches when it resolves.
  const requestIdRef = useRef(0);
  const hasVariants = variants.length > 0;
  const canPreview = hasVariants && describedPersonId.length > 0 && otherPersonId.length > 0;

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // A `<details>` element hides its children rather than unmounting them,
    // so this effect still runs when the section is opened with no variants
    // configured. Nothing has been configured yet, so there is nothing
    // useful to preview: skip the request rather than posting an empty
    // variant list for every user who opens the section and configures
    // nothing.
    if (!canPreview) {
      return;
    }

    timerRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;

      fetch('/api/relationship-types/preview-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typeLabel, describedPersonId, otherPersonId, variants }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Preview request failed');
          }
          const data = (await response.json()) as PreviewResult;
          if (requestIdRef.current !== requestId) {
            return;
          }
          setResult(data);
          setFailed(false);
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setResult(null);
          setFailed(true);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [canPreview, describedPersonId, otherPersonId, typeLabel, variants]);

  const describedPerson = people.find((person) => person.id === describedPersonId);
  const otherPerson = people.find((person) => person.id === otherPersonId);

  const selectClass =
    'rounded border border-border bg-surface px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">{t('title')}</p>
      <p className="text-xs text-muted">{t('hint')}</p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('described')}</span>
          <select
            aria-label={t('described')}
            value={describedPersonId}
            onChange={(e) => setDescribedPersonId(e.target.value)}
            className={selectClass}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">{t('other')}</span>
          <select
            aria-label={t('other')}
            value={otherPersonId}
            onChange={(e) => setOtherPersonId(e.target.value)}
            className={selectClass}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canPreview && failed && (
        <p role="alert" className="text-xs text-warning">
          {t('failed')}
        </p>
      )}

      {canPreview && !failed && result && describedPerson && otherPerson && (
        <div className="text-sm text-foreground">
          <p>
            {t('result', { described: describedPerson.name, label: result.label, other: otherPerson.name })}
          </p>
          <p className="text-xs text-muted">
            {result.variantIndex === null ? t('fallback') : t('matched', { index: result.variantIndex + 1 })}
          </p>
        </div>
      )}
    </div>
  );
}
