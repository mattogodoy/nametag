'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type PersonLabel = {
  id: string;
  name: string;
  surname: string | null;
  photo: string | null;
  role: string;
};

type EmailItem = {
  id: string;
  gmailThreadId: string;
  subject: string | null;
  snippet: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  date: string;
  hasAttachments: boolean;
  isRead: boolean;
  persons: PersonLabel[];
};

type EmailDetail = EmailItem & {
  body: string | null;
  ccEmails: string[];
  documents: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number | null;
    driveWebViewUrl: string | null;
  }>;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

interface EmailCenterProps {
  initialEmails: EmailItem[];
  initialPagination: Pagination;
  initialFilter: string;
  initialSearch: string;
  initialPersonId: string;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours === 0) return `${Math.max(1, Math.floor(diffMs / 60000))}m`;
    return `${diffHours}h`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function getInitials(name: string, surname: string | null): string {
  return ((name?.[0] || '') + (surname?.[0] || '')).toUpperCase() || '?';
}

export default function EmailCenter({
  initialEmails,
  initialPagination,
  initialFilter,
  initialSearch,
  initialPersonId,
}: EmailCenterProps) {
  const t = useTranslations('emailCenter');

  const [emails, setEmails] = useState(initialEmails);
  const [pagination, setPagination] = useState(initialPagination);
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [personId, setPersonId] = useState(initialPersonId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarPersons, setSidebarPersons] = useState<Array<{ id: string; name: string; surname: string | null }>>([]);

  // Fetch persons for sidebar
  useEffect(() => {
    fetch('/api/people?limit=200&sortBy=name&order=asc')
      .then(r => r.json())
      .then(data => {
        if (data.people) setSidebarPersons(data.people);
      })
      .catch(() => {});
  }, []);

  const fetchEmails = useCallback(async (params: { page?: number; q?: string; filter?: string; personId?: string }) => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (params.page && params.page > 1) sp.set('page', String(params.page));
      if (params.q) sp.set('q', params.q);
      if (params.filter && params.filter !== 'all') sp.set('filter', params.filter);
      if (params.personId) sp.set('personId', params.personId);
      const res = await fetch(`/api/emails?${sp}`);
      const data = await res.json();
      if (data.success) {
        setEmails(data.data);
        setPagination(data.pagination);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmails({ q: search, filter, personId });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, filter, personId, fetchEmails]);

  // Fetch email detail
  const openEmail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/emails/${id}`);
      const data = await res.json();
      if (data.success) setDetail(data.data);
    } catch { /* silent */ }
    setDetailLoading(false);
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  const filterButtons = [
    { key: 'all', label: t('all') },
    { key: 'unread', label: t('unread') },
    { key: 'attachments', label: t('withAttachments') },
  ];

  return (
    <div className="bg-surface shadow rounded-lg overflow-hidden" style={{ minHeight: 'calc(100vh - 140px)' }}>
      {/* Header: search + filters */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Filter buttons */}
          <div className="flex gap-1">
            {filterButtons.map((fb) => (
              <button
                key={fb.key}
                onClick={() => setFilter(fb.key)}
                className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                  filter === fb.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-muted hover:text-foreground'
                }`}
              >
                {fb.label}
              </button>
            ))}
          </div>
        </div>
        {/* Active person filter badge */}
        {personId && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted">{t('personFilter')}:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {sidebarPersons.find(p => p.id === personId)?.name || personId}
              <button onClick={() => setPersonId('')} className="ml-1 hover:text-primary-dark">&times;</button>
            </span>
          </div>
        )}
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Left sidebar - person labels */}
        <div className="hidden lg:block w-56 border-r border-border overflow-y-auto">
          <div className="px-3 py-2">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{t('people')}</h4>
            <button
              onClick={() => setPersonId('')}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                !personId ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              {t('allEmails')}
            </button>
            {sidebarPersons.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersonId(p.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors truncate ${
                  personId === p.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-surface-elevated'
                }`}
              >
                {p.name}{p.surname ? ` ${p.surname}` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Email list */}
        <div className={`flex-1 overflow-y-auto border-r border-border ${selectedId ? 'hidden md:block md:w-2/5 lg:w-auto' : ''}`}>
          {loading ? (
            <div className="p-8 text-center text-muted text-sm">Loading...</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 text-muted mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p className="text-sm text-muted">{search || personId ? t('noEmailsFiltered') : t('noEmails')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {emails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => openEmail(email.id)}
                  className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface-elevated ${
                    selectedId === email.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'
                  } ${!email.isRead ? 'bg-surface-elevated/50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Sender + date row */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                          {email.fromName || email.fromEmail}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {email.hasAttachments && (
                            <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                          <span className="text-xs text-muted">{formatRelativeDate(email.date)}</span>
                        </div>
                      </div>
                      {/* Subject */}
                      <div className={`text-sm truncate ${!email.isRead ? 'font-medium text-foreground' : 'text-foreground'}`}>
                        {email.subject || '(No subject)'}
                      </div>
                      {/* Snippet */}
                      <div className="text-xs text-muted truncate mt-0.5">
                        {email.snippet}
                      </div>
                      {/* Person tags */}
                      {email.persons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {email.persons.map((p) => (
                            <span
                              key={`${p.id}-${p.role}`}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                            >
                              <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary text-[8px] flex items-center justify-center font-bold">
                                {getInitials(p.name, p.surname)}
                              </span>
                              {p.name}
                              {p.role === 'keyword' && (
                                <span className="text-[9px] text-primary/60">kw</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => fetchEmails({ page: pagination.page - 1, q: search, filter, personId })}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted hover:text-foreground disabled:opacity-30 transition-colors"
              >
                {t('previous')}
              </button>
              <span className="text-xs text-muted">
                {t('page')} {pagination.page} {t('of')} {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchEmails({ page: pagination.page + 1, q: search, filter, personId })}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted hover:text-foreground disabled:opacity-30 transition-colors"
              >
                {t('next')}
              </button>
            </div>
          )}
        </div>

        {/* Email detail panel */}
        <div className={`overflow-y-auto ${selectedId ? 'flex-1' : 'hidden md:flex md:flex-1 md:items-center md:justify-center'}`}>
          {!selectedId ? (
            <div className="text-center p-8">
              <svg className="w-16 h-16 text-muted mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-muted">{t('selectEmail')}</p>
            </div>
          ) : detailLoading ? (
            <div className="p-8 text-center text-muted text-sm">Loading...</div>
          ) : detail ? (
            <div className="p-6">
              {/* Back button (mobile) */}
              <button
                onClick={closeDetail}
                className="md:hidden mb-4 text-sm text-primary flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* Subject */}
              <h2 className="text-xl font-bold text-foreground mb-4">
                {detail.subject || '(No subject)'}
              </h2>

              {/* Metadata */}
              <div className="space-y-2 mb-6 text-sm">
                <div className="flex gap-2">
                  <span className="text-muted w-12">{t('from')}</span>
                  <span className="text-foreground font-medium">
                    {detail.fromName ? `${detail.fromName} <${detail.fromEmail}>` : detail.fromEmail}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted w-12">{t('to')}</span>
                  <span className="text-foreground">{detail.toEmails.join(', ')}</span>
                </div>
                {detail.ccEmails && detail.ccEmails.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-muted w-12">{t('cc')}</span>
                    <span className="text-foreground">{detail.ccEmails.join(', ')}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-muted w-12">{t('date')}</span>
                  <span className="text-foreground">{formatFullDate(detail.date)}</span>
                </div>
              </div>

              {/* Person tags */}
              {detail.persons && detail.persons.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {detail.persons.map((p) => (
                    <Link
                      key={`${p.id}-${p.role}`}
                      href={`/people/${p.id}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">
                        {getInitials(p.name, p.surname)}
                      </span>
                      {p.name}{p.surname ? ` ${p.surname}` : ''}
                      <span className="text-[10px] text-primary/60">({p.role})</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="border-t border-border pt-6">
                {detail.body ? (
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {detail.body}
                  </pre>
                ) : (
                  <p className="text-sm text-muted italic">{t('noBody')}</p>
                )}
              </div>

              {/* Attachments */}
              {detail.documents && detail.documents.length > 0 && (
                <div className="border-t border-border mt-6 pt-6">
                  <h4 className="text-sm font-semibold text-foreground mb-3">{t('attachments')}</h4>
                  <div className="space-y-2">
                    {detail.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 p-2 bg-surface-elevated rounded-lg">
                        <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate">{doc.fileName}</div>
                          <div className="text-xs text-muted">{formatFileSize(doc.fileSize)}</div>
                        </div>
                        {doc.driveWebViewUrl && (
                          <a
                            href={doc.driveWebViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-dark text-xs"
                          >
                            Drive
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
