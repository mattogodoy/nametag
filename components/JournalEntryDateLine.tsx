'use client';

interface JournalEntryDateLineProps {
  dateIso: string;
  hasTime: boolean;
  locale: string;
}

export default function JournalEntryDateLine({ dateIso, hasTime, locale }: JournalEntryDateLineProps) {
  let displayDate: string;
  let displayTime: string | null = null;

  if (hasTime) {
    const dt = new Date(dateIso);
    displayDate = dt.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    displayTime = dt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  } else {
    // Date-only entries are stored as midnight UTC representing a calendar day.
    // Parse via local components to avoid timezone-shift on the calendar day.
    const dateOnly = dateIso.split('T')[0];
    const [y, m, d] = dateOnly.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    displayDate = dt.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const text = displayTime ? `${displayDate} · ${displayTime}` : displayDate;
  return <p className="text-sm text-muted">{text}</p>;
}
