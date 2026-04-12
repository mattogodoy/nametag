'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type EmailSummary = {
  id: string;
  subject: string | null;
  snippet: string | null;
  fromEmail: string;
  fromName: string | null;
  date: string;
  hasAttachments: boolean;
  isRead: boolean;
};

interface EmailsSectionProps {
  personId: string;
  emailCount: number;
  latestEmails: EmailSummary[];
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'Just now' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function EmailsSection({ personId, emailCount, latestEmails }: EmailsSectionProps) {
  const t = useTranslations('emailsUi');

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          {t('title')}
        </h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-muted">
          {t('count', { count: emailCount })}
        </span>
      </div>

      {latestEmails.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">
          {t('empty')}
        </p>
      ) : (
      <div className="space-y-2">
        {latestEmails.map((email) => (
          <div
            key={email.id}
            className="flex items-start gap-3 p-3 bg-surface-elevated rounded-lg"
          >
            {/* Unread indicator */}
            <div className="flex-shrink-0 mt-1.5">
              {!email.isRead ? (
                <div className="w-2 h-2 rounded-full bg-primary" />
              ) : (
                <div className="w-2 h-2" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Subject */}
              <div className={`text-sm truncate ${!email.isRead ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                {email.subject || '(No subject)'}
              </div>

              {/* From + date */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted truncate">
                  {email.fromName || email.fromEmail}
                </span>
                <span className="text-xs text-muted flex-shrink-0">
                  {formatRelativeDate(email.date)}
                </span>
              </div>

              {/* Snippet */}
              {email.snippet && (
                <p className="text-xs text-muted mt-1 line-clamp-1">
                  {email.snippet}
                </p>
              )}
            </div>

            {/* Attachment icon */}
            {email.hasAttachments && (
              <div className="flex-shrink-0 mt-1" title={t('attachment')}>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {emailCount > 5 && (
        <div className="mt-3 pt-3 border-t border-border">
          <Link
            href={`/people/${personId}/emails`}
            className="text-sm text-primary hover:text-primary-dark transition-colors"
          >
            {t('viewAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
